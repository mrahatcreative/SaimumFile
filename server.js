const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const initSqlJs = require('sql.js');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 8335;
const STORAGE_PATH = process.env.STORAGE_PATH || '/data/files';
const DB_PATH = process.env.DB_PATH || '/data/saimum.db';
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

fs.mkdirSync(STORAGE_PATH, { recursive: true });

let db;

function dbGet(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  if (stmt.step()) { const r = stmt.getAsObject(); stmt.free(); return r; }
  stmt.free(); return null;
}

function dbAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function dbRun(sql, params = []) {
  db.run(sql, params);
}

function dbCount(sql, params = []) {
  const r = dbGet(sql, params);
  return r ? Number(Object.values(r)[0]) || 0 : 0;
}

async function initDb() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }
  db.run('PRAGMA journal_mode=WAL');
  db.run(`CREATE TABLE IF NOT EXISTS buckets (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, label TEXT DEFAULT '', access_key TEXT UNIQUE NOT NULL, secret_key TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))`);
  db.run(`CREATE TABLE IF NOT EXISTS files (id TEXT PRIMARY KEY, bucket TEXT NOT NULL, name TEXT NOT NULL, original_name TEXT NOT NULL, storage_path TEXT NOT NULL, size INTEGER NOT NULL DEFAULT 0, mime_type TEXT DEFAULT 'application/octet-stream', folder TEXT NOT NULL DEFAULT '/', created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))`);
  db.run(`CREATE TABLE IF NOT EXISTS folders (id TEXT PRIMARY KEY, bucket TEXT NOT NULL, path TEXT NOT NULL, name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(bucket, path))`);
  saveDb();
}

let saveDbTimer = null;
function saveDb() {
  if (saveDbTimer) clearTimeout(saveDbTimer);
  saveDbTimer = setTimeout(() => {
    const data = db.export();
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, Buffer.from(data));
    saveDbTimer = null;
  }, 1000);
}

function genId() { return crypto.randomUUID(); }
function genKey() { return crypto.randomBytes(24).toString('base64url'); }

/* ─── SigV4 helpers ─── */

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function hmac(key, msg) {
  return crypto.createHmac('sha256', key).update(msg).digest();
}

function getSignatureKey(secret, date, region, service) {
  const kDate = hmac('AWS4' + secret, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

function parseSigV4(auth) {
  const m = auth.match(/Credential=([^/]+)\/(\d{8})\/([^/]+)\/([^/]+)\/aws4_request/);
  if (!m) return null;
  const sh = auth.match(/SignedHeaders=([^,]+)/);
  const sig = auth.match(/Signature=([a-f0-9]+)/);
  if (!sh || !sig) return null;
  return {
    accessKey: m[1], date: m[2], region: m[3], service: m[4],
    signedHeaders: sh[1].split(';').sort(),
    signature: sig[1],
  };
}

function verifySigV4(req, secretKey) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('AWS4-HMAC-SHA256')) return null;
  const p = parseSigV4(auth);
  if (!p) return null;

  const amzDate = req.headers['x-amz-date'] || '';
  const datetime = amzDate;
  if (!datetime) return null;

  const method = req.method;
  let rawPath = req.path;
  const qs = req.url.includes('?') ? req.url.split('?')[1] || '' : '';
  const payloadHash = req.headers['x-amz-content-sha256'] || (Buffer.isBuffer(req.body) && req.body.length ? sha256(req.body) : sha256(''));

  const headers = {};
  for (const h of p.signedHeaders) {
    const val = req.headers[h];
    if (!val) return null;
    headers[h] = (Array.isArray(val) ? val.join(',') : val).trim();
  }
  const canonicalHeaders = p.signedHeaders.map(h => h + ':' + headers[h] + '\n').join('');

  const canonicalRequest = [
    method, rawPath, qs,
    canonicalHeaders,
    p.signedHeaders.join(';'),
    payloadHash,
  ].join('\n');

  const crHash = sha256(canonicalRequest);
  const credentialScope = p.date + '/' + p.region + '/' + p.service + '/aws4_request';
  const stringToSign = ['AWS4-HMAC-SHA256', datetime, credentialScope, crHash].join('\n');
  const signingKey = getSignatureKey(secretKey, p.date, p.region, p.service);
  const expected = hmac(signingKey, stringToSign).toString('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(p.signature)) ? p : null;
  } catch {
    return null;
  }
}

function findBucketByAccessKey(accessKey) {
  return dbGet('SELECT * FROM buckets WHERE access_key = ?', [accessKey]);
}

/* ─── S3 XML helpers ─── */

function s3XmlError(code, message) {
  return '<?xml version="1.0" encoding="UTF-8"?><Error><Code>' + code + '</Code><Message>' + message + '</Message><RequestId>1</RequestId></Error>';
}

function s3ListBucketsXml(buckets) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?><ListAllMyBucketsResult><Buckets>';
  for (const b of buckets) {
    xml += '<Bucket><Name>' + escXml(b.name) + '</Name><CreationDate>' + (b.created_at || new Date().toISOString()) + '</CreationDate></Bucket>';
  }
  return xml + '</Buckets></ListAllMyBucketsResult>';
}

function s3ListObjectsXml(bucket, files, folders, prefix, delimiter) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?><ListBucketResult>';
  xml += '<Name>' + escXml(bucket) + '</Name><Prefix>' + escXml(prefix || '') + '</Prefix><Delimiter>' + escXml(delimiter || '') + '</Delimiter><KeyCount>' + (files.length + folders.length) + '</KeyCount><MaxKeys>1000</MaxKeys><IsTruncated>false</IsTruncated>';
  for (const f of folders) {
    xml += '<CommonPrefixes><Prefix>' + escXml(f.path) + '/</Prefix></CommonPrefixes>';
  }
  for (const f of files) {
    const key = (f.folder === '/' ? '' : f.folder.replace(/^\//, '') + '/') + f.original_name;
    xml += '<Contents><Key>' + escXml(key) + '</Key><Size>' + f.size + '</Size><LastModified>' + new Date(f.created_at).toISOString() + '</LastModified><ETag>"' + sha256(f.id).slice(0, 16) + '"</ETag></Contents>';
  }
  return xml + '</ListBucketResult>';
}

function escXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ─── Middleware ─── */

function s3Auth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('AWS4-HMAC-SHA256')) return next();
  const p = parseSigV4(auth);
  if (!p) return res.status(400).type('application/xml').send(s3XmlError('AuthorizationHeaderMalformed', 'The authorization header is malformed'));
  const bucket = findBucketByAccessKey(p.accessKey);
  if (!bucket) return res.status(403).type('application/xml').send(s3XmlError('InvalidAccessKeyId', 'The access key is invalid'));
  if (!verifySigV4(req, bucket.secret_key)) return res.status(403).type('application/xml').send(s3XmlError('SignatureDoesNotMatch', 'The request signature we calculated does not match'));
  req.s3Bucket = bucket;
  req.isS3 = true;
  next();
}

function webAuth(req, res, next) {
  if (req.isS3) return next();
  if (req.path === '/api/login') return next();
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(header.replace('Bearer ', ''), JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

function bucketAuth(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key) return res.status(401).json({ error: 'x-api-key required' });
  const bucket = dbGet('SELECT * FROM buckets WHERE access_key = ?', [key]);
  if (!bucket) return res.status(401).json({ error: 'Invalid API key' });
  req.bucket = bucket;
  next();
}

function sanitizeFolder(f) {
  if (!f || f === '') return '/';
  const p = path.normalize('/' + f).replace(/\\/g, '/');
  return p === '.' ? '/' : p;
}

function resolveBucketPath(bucket) {
  const p = path.join(STORAGE_PATH, bucket);
  fs.mkdirSync(p, { recursive: true });
  return p;
}

function resolveFolderPath(bucket, folder) {
  const f = sanitizeFolder(folder);
  const p = path.join(resolveBucketPath(bucket), f === '/' ? '' : f);
  fs.mkdirSync(p, { recursive: true });
  return p;
}

/* ─── Body parsers + Global Middleware ─── */

app.use(cors());

app.use((req, res, next) => {
  const ct = req.headers['content-type'] || '';
  if (ct.includes('multipart')) return next();
  express.raw({ type: () => true, limit: '50mb' })(req, res, next);
});

app.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'DELETE') {
    req.body = req.body || Buffer.alloc(0);
  }
  next();
});

app.use(s3Auth);

app.use((req, res, next) => {
  if (req.isS3) return next();
  if (Buffer.isBuffer(req.body) && req.body.length > 0) {
    const ct = req.headers['content-type'] || '';
    if (ct.includes('json')) {
      try { req.body = JSON.parse(req.body.toString()); }
      catch { req.body = {}; }
    } else if (ct.includes('multipart')) {
      req.body = {};
    } else if (!ct.length) {
      req.body = {};
    } else {
      req.body = {};
    }
  } else if (!req.body || Buffer.isBuffer(req.body)) {
    req.body = {};
  }
  next();
});

const upload = multer({ dest: '/tmp/saimum-uploads/' });

/* ═══════════════════════════════════════
   S3 API Routes (root level)
   ═══════════════════════════════════════ */

/* GET / → ListBuckets (returns only the bucket matching the access key) */
app.get('/', (req, res, next) => {
  if (!req.isS3) return next();
  const buckets = dbAll('SELECT * FROM buckets WHERE access_key = ?', [req.s3Bucket.access_key]);
  res.type('application/xml').send(s3ListBucketsXml(buckets));
});

/* HEAD /:bucket → HeadBucket (check if bucket exists) */
app.head('/:bucket', (req, res, next) => {
  if (!req.isS3) return next();
  const b = dbGet('SELECT * FROM buckets WHERE name = ? AND access_key = ?', [req.params.bucket, req.s3Bucket.access_key]);
  if (!b) return res.status(404).type('application/xml').send(s3XmlError('NoSuchBucket', 'The specified bucket does not exist'));
  res.status(200).end();
});

/* GET /:bucket → ListObjectsV2 */
app.get('/:bucket', (req, res, next) => {
  if (!req.isS3) return next();
  const b = dbGet('SELECT * FROM buckets WHERE name = ? AND access_key = ?', [req.params.bucket, req.s3Bucket.access_key]);
  if (!b) return res.status(404).type('application/xml').send(s3XmlError('NoSuchBucket', 'The specified bucket does not exist'));

  const prefix = req.query.prefix || '';
  const delimiter = req.query.delimiter || '';
  const folder = '/' + prefix;

  const files = dbAll("SELECT id, original_name, size, folder, created_at FROM files WHERE bucket = ? AND folder = ? AND original_name LIKE ? ORDER BY original_name",
    [req.params.bucket, folder, '%']);

  const allFolders = dbAll("SELECT path, name FROM folders WHERE bucket = ? AND path LIKE ? AND path != '/' ORDER BY path", [req.params.bucket, folder + '%']);

  const subFolders = allFolders.filter(f => {
    const rel = f.path.replace(/^\/+/, '');
    return rel.startsWith(prefix);
  });

  res.type('application/xml').send(s3ListObjectsXml(req.params.bucket, files, subFolders, prefix, delimiter));
});

/* DELETE /:bucket → DeleteBucket */
app.delete('/:bucket', (req, res, next) => {
  if (!req.isS3) return next();
  const b = dbGet('SELECT * FROM buckets WHERE name = ? AND access_key = ?', [req.params.bucket, req.s3Bucket.access_key]);
  if (!b) return res.status(404).type('application/xml').send(s3XmlError('NoSuchBucket', 'The specified bucket does not exist'));

  dbRun('DELETE FROM files WHERE bucket = ?', [req.params.bucket]);
  dbRun('DELETE FROM folders WHERE bucket = ?', [req.params.bucket]);
  dbRun('DELETE FROM buckets WHERE name = ?', [req.params.bucket]);
  saveDb();

  const bp = resolveBucketPath(req.params.bucket);
  if (fs.existsSync(bp)) fs.rmSync(bp, { recursive: true, force: true });
  res.status(204).end();
});

/* Object-level routes */

app.get('/:bucket/*', (req, res, next) => {
  if (!req.isS3) return next();
  const key = req.params[0];
  const name = path.basename(key);
  const folder = '/' + path.dirname(key);
  const cleanFolder = folder === '/.' ? '/' : folder;

  const row = dbGet('SELECT * FROM files WHERE bucket = ? AND original_name = ? AND folder = ?',
    [req.params.bucket, name, cleanFolder]);
  if (!row) return res.status(404).type('application/xml').send(s3XmlError('NoSuchKey', 'The specified key does not exist'));
  if (!fs.existsSync(row.storage_path)) return res.status(404).type('application/xml').send(s3XmlError('NoSuchKey', 'File missing on disk'));

  res.setHeader('Content-Type', row.mime_type);
  res.setHeader('Content-Disposition', 'inline; filename="' + row.original_name + '"');
  res.setHeader('ETag', '"' + sha256(row.id).slice(0, 16) + '"');
  res.setHeader('Content-Length', row.size);
  res.sendFile(row.storage_path);
});

app.head('/:bucket/*', (req, res, next) => {
  if (!req.isS3) return next();
  const key = req.params[0];
  const name = path.basename(key);
  const folder = '/' + path.dirname(key);
  const cleanFolder = folder === '/.' ? '/' : folder;

  const row = dbGet('SELECT * FROM files WHERE bucket = ? AND original_name = ? AND folder = ?',
    [req.params.bucket, name, cleanFolder]);
  if (!row) return res.status(404).type('application/xml').send(s3XmlError('NoSuchKey', 'The specified key does not exist'));

  res.setHeader('Content-Type', row.mime_type);
  res.setHeader('Content-Length', row.size);
  res.setHeader('ETag', '"' + sha256(row.id).slice(0, 16) + '"');
  res.status(200).end();
});

app.put('/:bucket/*', (req, res, next) => {
  if (!req.isS3) return next();
  const b = dbGet('SELECT * FROM buckets WHERE name = ? AND access_key = ?', [req.params.bucket, req.s3Bucket.access_key]);
  if (!b) return res.status(404).type('application/xml').send(s3XmlError('NoSuchBucket', 'The specified bucket does not exist'));

  const key = req.params[0];
  const name = path.basename(key);
  const dir = path.dirname(key);
  const folder = '/' + (dir === '.' ? '' : dir);

  const id = genId();
  const ext = path.extname(name);
  const storedName = id + ext;
  const targetDir = resolveFolderPath(req.params.bucket, folder);
  const targetPath = path.join(targetDir, storedName);

  let bodyBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
  fs.writeFileSync(targetPath, bodyBuffer);

  const mime = req.headers['content-type'] || 'application/octet-stream';
  dbRun('INSERT INTO files (id, bucket, name, original_name, storage_path, size, mime_type, folder) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, req.params.bucket, storedName, name, targetPath, bodyBuffer.length, mime, folder]);
  saveDb();

  res.setHeader('ETag', '"' + sha256(id).slice(0, 16) + '"');
  res.status(200).type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?><PutObjectResult><ETag>"' + sha256(id).slice(0, 16) + '"</ETag></PutObjectResult>');
});

app.delete('/:bucket/*', (req, res, next) => {
  if (!req.isS3) return next();
  const key = req.params[0];
  const name = path.basename(key);
  const folder = '/' + (path.dirname(key) === '.' ? '' : path.dirname(key));

  const row = dbGet('SELECT * FROM files WHERE bucket = ? AND original_name = ? AND folder = ?',
    [req.params.bucket, name, folder]);
  if (!row) return res.status(204).end();

  if (fs.existsSync(row.storage_path)) fs.unlinkSync(row.storage_path);
  dbRun('DELETE FROM files WHERE id = ?', [row.id]);
  saveDb();
  res.status(204).end();
});

/* ═══════════════════════════════════════
   Web API Routes (under /api/)
   ═══════════════════════════════════════ */

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts, please try again after 15 minutes' }
});

/* Login */
app.post('/api/login', loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ username, role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token });
});

app.use('/api', webAuth);

/* Buckets CRUD */
app.get('/api/buckets', (req, res) => {
  const buckets = dbAll(`
    SELECT b.id, b.name, b.label, b.access_key, b.created_at,
           COUNT(f.id) as files_count,
           COALESCE(SUM(f.size), 0) as total_size
    FROM buckets b
    LEFT JOIN files f ON f.bucket = b.name
    GROUP BY b.id, b.name, b.label, b.access_key, b.created_at
    ORDER BY b.created_at DESC
  `);
  res.json(buckets);
});

app.post('/api/buckets', (req, res) => {
  const { name, label } = req.body;
  if (!name || !/^[a-z0-9_-]+$/.test(name)) {
    return res.status(400).json({ error: 'Bucket name must be lowercase alphanumeric with - and _ only' });
  }
  const exists = dbGet('SELECT id FROM buckets WHERE name = ?', [name]);
  if (exists) return res.status(409).json({ error: 'Bucket already exists' });
  const id = genId();
  const accessKey = genKey();
  const secretKey = genKey();
  dbRun('INSERT INTO buckets (id, name, label, access_key, secret_key) VALUES (?, ?, ?, ?, ?)', [id, name, label || name, accessKey, secretKey]);
  saveDb();
  fs.mkdirSync(resolveBucketPath(name), { recursive: true });
  res.json({ id, name, label: label || name, access_key: accessKey, secret_key: secretKey });
});

app.get('/api/buckets/:name/keys', (req, res) => {
  const { name } = req.params;
  const bucket = dbGet('SELECT label, access_key, secret_key FROM buckets WHERE name = ?', [name]);
  if (!bucket) return res.status(404).json({ error: 'Bucket not found' });
  res.json(bucket);
});

app.post('/api/buckets/:name/keys/regenerate', (req, res) => {
  const { name } = req.params;
  const bucket = dbGet('SELECT label FROM buckets WHERE name = ?', [name]);
  if (!bucket) return res.status(404).json({ error: 'Bucket not found' });

  let accessKey;
  let attempts = 0;
  while (attempts < 10) {
    accessKey = genKey();
    const clash = dbGet('SELECT id FROM buckets WHERE access_key = ?', [accessKey]);
    if (!clash) break;
    attempts++;
  }
  const secretKey = genKey();
  dbRun('UPDATE buckets SET access_key = ?, secret_key = ? WHERE name = ?', [accessKey, secretKey, name]);
  saveDb();
  res.json({ name, label: bucket.label, access_key: accessKey, secret_key: secretKey });
});

app.patch('/api/buckets/:name', (req, res) => {
  const { name } = req.params;
  const { label } = req.body;
  if (!label || !label.trim()) {
    return res.status(400).json({ error: 'Label is required' });
  }
  const bucket = dbGet('SELECT * FROM buckets WHERE name = ?', [name]);
  if (!bucket) return res.status(404).json({ error: 'Bucket not found' });
  dbRun('UPDATE buckets SET label = ? WHERE name = ?', [label.trim(), name]);
  saveDb();
  res.json({ ok: true, name, label: label.trim() });
});

app.delete('/api/buckets/:name', (req, res) => {
  const { name } = req.params;
  const bucket = dbGet('SELECT * FROM buckets WHERE name = ?', [name]);
  if (!bucket) return res.status(404).json({ error: 'Bucket not found' });
  dbRun('DELETE FROM files WHERE bucket = ?', [name]);
  dbRun('DELETE FROM folders WHERE bucket = ?', [name]);
  dbRun('DELETE FROM buckets WHERE name = ?', [name]);
  saveDb();
  const bp = resolveBucketPath(name);
  if (fs.existsSync(bp)) fs.rmSync(bp, { recursive: true, force: true });
  res.json({ ok: true });
});

/* Files */
app.get('/api/files/:bucket', (req, res) => {
  const { bucket } = req.params;
  const folder = sanitizeFolder(req.query.folder);
  const b = dbGet('SELECT * FROM buckets WHERE name = ?', [bucket]);
  if (!b) return res.status(404).json({ error: 'Bucket not found' });

  const files = dbAll('SELECT id, original_name, size, mime_type, folder, created_at FROM files WHERE bucket = ? AND folder = ? ORDER BY original_name', [bucket, folder]);
  const allFolders = dbAll('SELECT id, path, name, created_at FROM folders WHERE bucket = ? AND path != ? AND path LIKE ? ORDER BY name', [bucket, folder, folder === '/' ? '/%' : folder + '/%']);
  const immediate = allFolders.filter(f => {
    const rel = f.path.replace(folder, '').replace(/^\//, '');
    return !rel.includes('/');
  });
  res.json({ files, folders: immediate, folder, bucket });
});

app.post('/api/upload/:bucket', upload.single('file'), (req, res) => {
  const { bucket } = req.params;
  const file = req.file;
  const folder = sanitizeFolder(req.body.folder || '/');
  const b = dbGet('SELECT * FROM buckets WHERE name = ?', [bucket]);
  
  if (!b) {
    if (file) fs.unlinkSync(file.path);
    return res.status(404).json({ error: 'Bucket not found' });
  }
  if (!file) return res.status(400).json({ error: 'No file' });

  const id = genId();
  const ext = path.extname(file.originalname);
  const storedName = id + ext;
  const targetDir = resolveFolderPath(bucket, folder);
  const targetPath = path.join(targetDir, storedName);
  fs.copyFileSync(file.path, targetPath);
  fs.unlinkSync(file.path);

  dbRun('INSERT INTO files (id, bucket, name, original_name, storage_path, size, mime_type, folder) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, bucket, storedName, file.originalname, targetPath, file.size, file.mimetype, folder]);
  if (folder !== '/') {
    const fpath = folder.startsWith('/') ? folder : '/' + folder;
    dbRun('INSERT OR IGNORE INTO folders (id, bucket, path, name) VALUES (?, ?, ?, ?)', [genId(), bucket, fpath, path.basename(fpath)]);
  }
  saveDb();
  res.json({ id, name: file.originalname, size: file.size, folder, bucket });
});

app.get('/api/download/:bucket/:id', (req, res) => {
  const { bucket, id } = req.params;
  const row = dbGet('SELECT * FROM files WHERE id = ? AND bucket = ?', [id, bucket]);
  if (!row) return res.status(404).json({ error: 'File not found' });
  if (!fs.existsSync(row.storage_path)) return res.status(404).json({ error: 'File missing on disk' });
  res.setHeader('Content-Type', row.mime_type);
  res.setHeader('Content-Disposition', 'inline; filename="' + row.original_name + '"');
  res.sendFile(row.storage_path);
});

app.delete('/api/files/:bucket/:id', (req, res) => {
  const { bucket, id } = req.params;
  const row = dbGet('SELECT * FROM files WHERE id = ? AND bucket = ?', [id, bucket]);
  if (!row) return res.status(404).json({ error: 'File not found' });
  if (fs.existsSync(row.storage_path)) fs.unlinkSync(row.storage_path);
  dbRun('DELETE FROM files WHERE id = ?', [id]);
  saveDb();
  res.json({ ok: true });
});

app.patch('/api/files/:bucket/:id/rename', (req, res) => {
  const { bucket, id } = req.params;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'New name required' });
  const row = dbGet('SELECT * FROM files WHERE id = ? AND bucket = ?', [id, bucket]);
  if (!row) return res.status(404).json({ error: 'File not found' });
  const ext = path.extname(row.storage_path);
  const newStoredName = genId() + ext;
  const newPath = path.join(path.dirname(row.storage_path), newStoredName);
  fs.renameSync(row.storage_path, newPath);
  dbRun("UPDATE files SET original_name = ?, name = ?, storage_path = ?, updated_at = datetime('now') WHERE id = ?", [name, newStoredName, newPath, id]);
  saveDb();
  res.json({ ok: true, name });
});

/* Folders */
app.post('/api/folders/:bucket', (req, res) => {
  const { bucket } = req.params;
  const folder = sanitizeFolder(req.body.folder);
  if (folder === '/') return res.status(400).json({ error: 'Cannot create root' });
  const b = dbGet('SELECT * FROM buckets WHERE name = ?', [bucket]);
  if (!b) return res.status(404).json({ error: 'Bucket not found' });
  resolveFolderPath(bucket, folder);
  dbRun('INSERT OR IGNORE INTO folders (id, bucket, path, name) VALUES (?, ?, ?, ?)', [genId(), bucket, folder, path.basename(folder)]);
  saveDb();
  res.json({ folder, ok: true });
});

app.delete('/api/folders/:bucket', (req, res) => {
  const { bucket } = req.params;
  const folder = sanitizeFolder(req.body.folder);
  if (folder === '/') return res.status(400).json({ error: 'Cannot delete root' });
  const b = dbGet('SELECT * FROM buckets WHERE name = ?', [bucket]);
  if (!b) return res.status(404).json({ error: 'Bucket not found' });

  const files = dbAll('SELECT * FROM files WHERE bucket = ? AND (folder = ? OR folder LIKE ?)', [bucket, folder, folder + '/%']);
  for (const f of files) {
    if (fs.existsSync(f.storage_path)) fs.unlinkSync(f.storage_path);
  }
  dbRun('DELETE FROM files WHERE bucket = ? AND (folder = ? OR folder LIKE ?)', [bucket, folder, folder + '/%']);
  dbRun('DELETE FROM folders WHERE bucket = ? AND (path = ? OR path LIKE ?)', [bucket, folder, folder + '/%']);
  saveDb();
  const target = path.join(resolveBucketPath(bucket), folder === '/' ? '' : folder);
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
  res.json({ ok: true });
});

/* Stats */
app.get('/api/stats', (req, res) => {
  res.json({
    buckets: dbCount('SELECT COUNT(*) as c FROM buckets'),
    files: dbCount('SELECT COUNT(*) as c FROM files'),
    size: dbCount('SELECT COALESCE(SUM(size), 0) as s FROM files'),
    folders: dbCount('SELECT COUNT(*) as c FROM folders'),
  });
});

app.get('/api/disk', (req, res) => {
  const { execSync } = require('child_process');
  try {
    const out = execSync('df -BG ' + STORAGE_PATH + ' | tail -1').toString();
    const parts = out.trim().split(/\s+/);
    if (parts.length >= 4) {
      const total = parseInt(parts[1].replace('G', ''));
      const used = parseInt(parts[2].replace('G', ''));
      const available = parseInt(parts[3].replace('G', ''));
      return res.json({ total, used, available, path: STORAGE_PATH, unit: 'GB' });
    }
  } catch {}
  res.json({ total: 0, used: 0, available: 0, path: STORAGE_PATH, unit: 'GB' });
});

app.get('/api/stats/:bucket', (req, res) => {
  const { bucket } = req.params;
  const b = dbGet('SELECT * FROM buckets WHERE name = ?', [bucket]);
  if (!b) return res.status(404).json({ error: 'Bucket not found' });
  res.json({
    bucket,
    files: dbCount('SELECT COUNT(*) as c FROM files WHERE bucket = ?', [bucket]),
    size: dbCount('SELECT COALESCE(SUM(size), 0) as s FROM files WHERE bucket = ?', [bucket]),
    folders: dbCount('SELECT COUNT(*) as c FROM folders WHERE bucket = ?', [bucket]),
    access_key: b.access_key, secret_key: b.secret_key,
  });
});

/* External API (bucket key based) */
app.get('/api/external/:bucket/files', bucketAuth, (req, res) => {
  const folder = sanitizeFolder(req.query.folder);
  const files = dbAll('SELECT id, original_name, size, mime_type, folder, created_at FROM files WHERE bucket = ? AND folder = ? ORDER BY original_name', [req.bucket.name, folder]);
  res.json({ files, folder });
});

app.post('/api/external/:bucket/upload', bucketAuth, upload.single('file'), (req, res) => {
  const file = req.file;
  const folder = sanitizeFolder(req.body.folder || '/');
  if (!file) return res.status(400).json({ error: 'No file' });
  const id = genId();
  const ext = path.extname(file.originalname);
  const storedName = id + ext;
  const targetDir = resolveFolderPath(req.bucket.name, folder);
  const targetPath = path.join(targetDir, storedName);
  fs.copyFileSync(file.path, targetPath);
  fs.unlinkSync(file.path);
  dbRun('INSERT INTO files (id, bucket, name, original_name, storage_path, size, mime_type, folder) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, req.bucket.name, storedName, file.originalname, targetPath, file.size, file.mimetype, folder]);
  saveDb();
  res.json({ id, name: file.originalname, size: file.size, folder });
});

app.get('/api/external/:bucket/download/:id', bucketAuth, (req, res) => {
  const row = dbGet('SELECT * FROM files WHERE id = ? AND bucket = ?', [req.params.id, req.bucket.name]);
  if (!row) return res.status(404).json({ error: 'File not found' });
  if (!fs.existsSync(row.storage_path)) return res.status(404).json({ error: 'File missing on disk' });
  res.setHeader('Content-Type', row.mime_type);
  res.setHeader('Content-Disposition', 'inline; filename="' + row.original_name + '"');
  res.sendFile(row.storage_path);
});

app.delete('/api/external/:bucket/files/:id', bucketAuth, (req, res) => {
  const row = dbGet('SELECT * FROM files WHERE id = ? AND bucket = ?', [req.params.id, req.bucket.name]);
  if (!row) return res.status(404).json({ error: 'File not found' });
  if (fs.existsSync(row.storage_path)) fs.unlinkSync(row.storage_path);
  dbRun('DELETE FROM files WHERE id = ?', [req.params.id]);
  saveDb();
  res.json({ ok: true });
});

/* Backup and Restore */
app.get('/api/backup', (req, res) => {
  const tempDir = path.join('/tmp', 'saimum-backup-' + Date.now());
  fs.mkdirSync(tempDir, { recursive: true });
  fs.copyFileSync(DB_PATH, path.join(tempDir, 'saimum.db'));
  
  const cp = require('child_process');
  try {
    cp.execSync(`cp -r ${STORAGE_PATH} ${path.join(tempDir, 'files')}`);
    const backupFile = path.join('/tmp', `saimum-backup-${Date.now()}.tar.gz`);
    cp.execSync(`tar -czf ${backupFile} -C ${tempDir} .`);
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    res.download(backupFile, `saimumfile-backup-${new Date().toISOString().slice(0, 10)}.tar.gz`, (err) => {
      if (fs.existsSync(backupFile)) fs.unlinkSync(backupFile);
    });
  } catch (err) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    res.status(500).json({ error: 'Failed to create backup: ' + err.message });
  }
});

app.post('/api/restore', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No backup file uploaded' });
  const backupFile = req.file.path;
  const tempExtractDir = path.join('/tmp', 'saimum-restore-' + Date.now());
  fs.mkdirSync(tempExtractDir, { recursive: true });

  const cp = require('child_process');
  try {
    cp.execSync(`tar -xzf ${backupFile} -C ${tempExtractDir}`);
    const restoredDb = path.join(tempExtractDir, 'saimum.db');
    const restoredFiles = path.join(tempExtractDir, 'files');

    if (!fs.existsSync(restoredDb) || !fs.existsSync(restoredFiles)) {
      throw new Error('Invalid backup archive structure (missing saimum.db or files)');
    }

    if (db) {
      db.close();
    }

    fs.copyFileSync(restoredDb, DB_PATH);
    fs.rmSync(STORAGE_PATH, { recursive: true, force: true });
    cp.execSync(`cp -r ${restoredFiles} ${STORAGE_PATH}`);

    initDb().then(() => {
      fs.rmSync(tempExtractDir, { recursive: true, force: true });
      if (fs.existsSync(backupFile)) fs.unlinkSync(backupFile);
      res.json({ ok: true });
    }).catch(err => {
      res.status(500).json({ error: 'Failed to re-initialize DB after restore: ' + err.message });
    });
  } catch (err) {
    fs.rmSync(tempExtractDir, { recursive: true, force: true });
    if (fs.existsSync(backupFile)) fs.unlinkSync(backupFile);
    res.status(500).json({ error: err.message || 'Failed to restore backup' });
  }
});

/* ─── Static files + SPA fallback ─── */
app.use(express.static(path.join(__dirname, 'client', 'dist')));
app.get('*', (req, res) => {
  if (req.isS3) return res.status(404).type('application/xml').send(s3XmlError('NoSuchBucket', 'The specified bucket does not exist'));
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});

initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SaimumFile running on http://0.0.0.0:${PORT}`);
    console.log(`Storage: ${STORAGE_PATH}`);
    if (ADMIN_USERNAME === 'admin' && ADMIN_PASSWORD === 'admin123') {
      console.warn('⚠️ WARNING: Using default admin credentials (admin/admin123). Please change them in production! ⚠️');
    }
  });
}).catch(err => {
  console.error('Failed to init:', err);
  process.exit(1);
});
