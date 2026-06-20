const API = '/api'

function getToken() {
  return localStorage.getItem('token')
}

export function setToken(t) {
  if (t) localStorage.setItem('token', t)
  else localStorage.removeItem('token')
}

export function isAuth() {
  return !!getToken()
}

export async function login(username, password) {
  const r = await fetch(API + '/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const d = await r.json()
  if (d.token) setToken(d.token)
  return d
}

async function authFetch(url, opts = {}) {
  opts.headers = { ...opts.headers, Authorization: 'Bearer ' + getToken() }
  const r = await fetch(url, opts)
  if (r.status === 401) {
    setToken(null)
    window.location.hash = '#/login'
  }
  return r
}

export async function getBuckets() {
  const r = await authFetch(API + '/buckets')
  return r.json()
}

export async function createBucket(name, label) {
  const r = await authFetch(API + '/buckets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, label }),
  })
  return r.json()
}

export async function deleteBucket(name) {
  const r = await authFetch(API + '/buckets/' + name, { method: 'DELETE' })
  return r.json()
}

export async function getFiles(bucket, folder = '/') {
  const r = await authFetch(API + '/files/' + bucket + '?folder=' + encodeURIComponent(folder))
  return r.json()
}

export async function uploadFile(bucket, file, folder = '/') {
  const form = new FormData()
  form.append('file', file)
  form.append('folder', folder)
  const r = await authFetch(API + '/upload/' + bucket, { method: 'POST', body: form })
  return r.json()
}

export async function downloadFile(bucket, id) {
  const r = await authFetch(API + '/download/' + bucket + '/' + id)
  if (!r.ok) throw new Error('Download failed')
  return r.blob()
}

export async function deleteFile(bucket, id) {
  const r = await authFetch(API + '/files/' + bucket + '/' + id, { method: 'DELETE' })
  return r.json()
}

export async function renameFile(bucket, id, name) {
  const r = await authFetch(API + '/files/' + bucket + '/' + id + '/rename', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  return r.json()
}

export async function createFolder(bucket, folder) {
  const r = await authFetch(API + '/folders/' + bucket, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder }),
  })
  return r.json()
}

export async function deleteFolder(bucket, folder) {
  const r = await authFetch(API + '/folders/' + bucket, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder }),
  })
  return r.json()
}

export async function getStats() {
  const r = await authFetch(API + '/stats')
  return r.json()
}

export async function getDisk() {
  const r = await authFetch(API + '/disk')
  return r.json()
}

export async function getBucketStats(bucket) {
  const r = await authFetch(API + '/stats/' + bucket)
  return r.json()
}

export async function getBucketKeys(name) {
  const r = await authFetch(API + '/buckets/' + name + '/keys')
  return r.json()
}

export async function updateBucketLabel(name, label) {
  const r = await authFetch(API + '/buckets/' + name, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label }),
  })
  return r.json()
}

export async function downloadBackup() {
  const r = await authFetch(API + '/backup')
  if (!r.ok) throw new Error('Backup failed')
  return r.blob()
}

export async function restoreBackup(file) {
  const form = new FormData()
  form.append('file', file)
  const r = await authFetch(API + '/restore', {
    method: 'POST',
    body: form
  })
  return r.json()
}

export async function regenerateBucketKeys(name) {
  const r = await authFetch(API + '/buckets/' + name + '/keys/regenerate', {
    method: 'POST',
  })
  return r.json()
}

