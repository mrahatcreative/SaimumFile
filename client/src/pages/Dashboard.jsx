import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getBuckets, createBucket, deleteBucket, getStats, getDisk, getBucketKeys, updateBucketLabel, getBucketStats, downloadBackup, restoreBackup } from '../api/client'
import Toast from '../components/Toast'
import { useTheme } from '../components/ThemeContext'

function fmtSize(bytes) {
  if (!bytes) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB']
  let i = 0, s = bytes
  while (s >= 1024 && i < u.length - 1) { s /= 1024; i++ }
  return s.toFixed(1) + ' ' + u[i]
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [buckets, setBuckets] = useState([])
  const [stats, setStats] = useState({ buckets: 0, files: 0, size: 0 })
  const [disk, setDisk] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [keyModal, setKeyModal] = useState(null)
  const [settingsTab, setSettingsTab] = useState('general')
  const [editLabel, setEditLabel] = useState('')
  const [showBackup, setShowBackup] = useState(false)
  const [backupLoading, setBackupLoading] = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [toast, setToast] = useState(null)

  const { theme, toggleTheme } = useTheme()

  useEffect(() => { load(); loadStats(); loadDisk() }, [])

  async function load() {
    const d = await getBuckets()
    setBuckets(d || [])
  }

  async function loadStats() {
    const d = await getStats()
    setStats(d)
  }

  async function loadDisk() {
    const d = await getDisk()
    setDisk(d)
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!newName.trim()) return
    const d = await createBucket(newName.trim(), newName.trim())
    if (d.error) { showToast(d.error, 'error'); return }
    setShowModal(false)
    setNewName('')
    navigate('/b/' + d.name + '?tab=settings')
  }

  async function handleDelete(name, e) {
    e.stopPropagation()
    if (!confirm('Delete bucket "' + name + '" and ALL files?')) return
    await deleteBucket(name)
    showToast('Bucket deleted', 'success')
    load(); loadStats()
    if (keyModal && keyModal.name === name) setKeyModal(null)
  }

  async function handleSaveLabel(e) {
    e?.preventDefault()
    if (!editLabel.trim()) return
    const d = await updateBucketLabel(keyModal.name, editLabel.trim())
    if (d.error) {
      showToast(d.error, 'error')
      return
    }
    showToast('Bucket renamed successfully', 'success')
    setBuckets(prev => prev.map(b => b.name === keyModal.name ? { ...b, label: editLabel.trim() } : b))
    setKeyModal(prev => prev ? { ...prev, label: editLabel.trim() } : null)
  }

  async function handleBackupDownload() {
    setBackupLoading(true)
    try {
      const blob = await downloadBackup()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `saimumfile-backup-${new Date().toISOString().slice(0, 10)}.tar.gz`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      showToast('Backup downloaded successfully', 'success')
    } catch (err) {
      showToast(err.message || 'Backup failed', 'error')
    } finally {
      setBackupLoading(false)
    }
  }

  async function handleRestoreUpload(file) {
    if (!file) return
    if (!confirm('Warning: This will overwrite ALL folders, files, and databases. Proceed?')) return
    setRestoreLoading(true)
    try {
      const res = await restoreBackup(file)
      if (res.error) {
        showToast(res.error, 'error')
        return
      }
      showToast('Restoration successful! Reloading page...', 'success')
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (err) {
      showToast(err.message || 'Restoration failed', 'error')
    } finally {
      setRestoreLoading(false)
    }
  }

  function showToast(msg, type) { setToast({ msg, type }) }

  const storagePct = disk ? Math.min(100, ((stats.size || 0) / ((disk.total || 1) * 1073741824)) * 100) : 0

  return (
    <div className="min-h-screen bg-[#f8fafd] dark:bg-[#1B1B1B] text-gray-700 dark:text-[#e3e3e3] flex flex-col transition-colors duration-200 select-none">
      {/* Header */}
      <header className="bg-[#f8fafd] dark:bg-[#1B1B1B] border-b border-gray-200/50 dark:border-gray-800/80 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-zinc-800 dark:bg-zinc-200 rounded-xl flex items-center justify-center shadow-md shadow-zinc-800/10">
              <svg className="w-5 h-5 text-white dark:text-zinc-900" viewBox="0 0 24 24" fill="currentColor"><path d="M14 10H4v2h10v-2zm0-4H4v2h10V6zM4 16h6v-2H4v2zm18-4v6l-4-4 4-4zm-2-6h-8v2h8V6zm-8 12h8v-2h-8v2z"/></svg>
            </div>
            <span className="text-xl font-medium text-gray-855 dark:text-[#f2f2f2] tracking-tight" style={{ fontFamily: "'Product Sans', 'Google Sans', Arial" }}>SaimumFile</span>
          </div>

          <div className="flex items-center gap-3">
            {disk && (
              <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mr-2">
                <span>{fmtSize(stats.size)} used</span>
                <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-850 rounded-full overflow-hidden">
                  <div className="h-full bg-zinc-800 dark:bg-zinc-300 rounded-full" style={{ width: storagePct + '%' }} />
                </div>
              </div>
            )}

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-full hover:bg-gray-200/60 dark:hover:bg-gray-850 text-gray-500 dark:text-gray-400 cursor-pointer transition-colors"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M14 12a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            <button
              onClick={() => setShowBackup(!showBackup)}
              className={`p-2.5 rounded-full hover:bg-gray-200/60 dark:hover:bg-gray-850 text-gray-500 dark:text-gray-400 cursor-pointer transition-colors ${
                showBackup ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100' : ''
              }`}
              title={showBackup ? 'Back to Buckets' : 'Backup & Restore Data'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </button>

            <button
              onClick={() => { localStorage.removeItem('token'); navigate('/login') }}
              className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-gray-200/50 hover:bg-gray-200 dark:bg-gray-850 dark:hover:bg-gray-800 px-4.5 py-2 rounded-full transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-6 py-8 w-full flex-1">
        {showBackup ? (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-lg font-medium text-gray-800 dark:text-gray-100">Backup & Restore</h2>
                <p className="text-xs text-gray-450 dark:text-gray-500 mt-0.5">Manage SaimumFile database backups and storage archives</p>
              </div>
              <button
                onClick={() => setShowBackup(false)}
                className="flex items-center gap-2 bg-gray-200/50 hover:bg-gray-200 dark:bg-gray-850 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 px-5 py-2.5 rounded-2xl text-sm font-medium transition-colors cursor-pointer"
              >
                Back to Buckets
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Backup */}
              <div className="bg-white dark:bg-[#131314] rounded-[24px] border border-gray-200/60 dark:border-gray-800/70 p-6 flex flex-col justify-between shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                <div>
                  <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-2">Create & Download Backup</h3>
                  <p className="text-xs text-gray-400 dark:text-gray-550 leading-relaxed mb-6">
                    Generates a single compressed archive (`.tar.gz`) containing the SQLite database records, credentials, buckets metadata, and all files stored on this instance.
                  </p>
                </div>
                <button
                  onClick={handleBackupDownload}
                  disabled={backupLoading}
                  className="w-full py-3 bg-zinc-800 hover:bg-zinc-900 dark:bg-zinc-700 dark:hover:bg-zinc-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold cursor-pointer transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  {backupLoading ? (
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  )}
                  {backupLoading ? 'Creating backup archive...' : 'Download Backup Archive'}
                </button>
              </div>

              {/* Restore */}
              <div className="bg-white dark:bg-[#131314] rounded-[24px] border border-gray-200/60 dark:border-gray-800/70 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-2">Restore Backup</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed mb-4">
                  Upload a previously generated backup archive to restore SaimumFile database and files. Warning: This will overwrite and erase all current data.
                </p>

                <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-zinc-400 dark:hover:border-zinc-500 rounded-2xl p-6 text-center cursor-pointer transition-colors relative">
                  <input
                    type="file"
                    accept=".tar.gz"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) handleRestoreUpload(file)
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    disabled={restoreLoading}
                  />
                  <div className="flex flex-col items-center justify-center">
                    {restoreLoading ? (
                      <div className="flex flex-col items-center">
                        <svg className="animate-spin h-8 w-8 text-zinc-700 dark:text-zinc-300 mb-2" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                        <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Restoring system data...</p>
                        <p className="text-[10px] text-gray-450 dark:text-gray-500 mt-0.5">Please do not refresh this page.</p>
                      </div>
                    ) : (
                      <>
                        <svg className="w-10 h-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Click or drag a backup file here</p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">saimumfile-backup-*.tar.gz only</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 tracking-tight" style={{ fontFamily: "'Product Sans', 'Google Sans', Arial" }}>Buckets</h2>
                <p className="text-xs text-gray-450 dark:text-gray-500 mt-0.5">Manage S3-compatible cloud storage buckets</p>
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-900 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white px-5 py-2.5 rounded-2xl text-sm font-medium transition-all shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-md hover:shadow-zinc-805/10 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                New Bucket
              </button>
            </div>

            {/* Stats Summary Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white dark:bg-[#131314] rounded-2xl border border-gray-200/60 dark:border-gray-800/70 p-4.5">
                <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-semibold">Buckets</span>
                <p className="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-1">{stats.buckets}</p>
              </div>
              <div className="bg-white dark:bg-[#131314] rounded-2xl border border-gray-200/60 dark:border-gray-800/70 p-4.5">
                <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-semibold">Total Files</span>
                <p className="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-1">{stats.files}</p>
              </div>
              <div className="bg-white dark:bg-[#131314] rounded-2xl border border-gray-200/60 dark:border-gray-800/70 p-4.5">
                <span className="text-[10px] text-gray-400 dark:text-gray-550 uppercase tracking-wider font-semibold">Storage Used</span>
                <p className="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-1 truncate" title={fmtSize(stats.size)}>{fmtSize(stats.size)}</p>
              </div>
              <div className="bg-white dark:bg-[#131314] rounded-2xl border border-gray-200/60 dark:border-gray-800/70 p-4.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-semibold">Disk Space</span>
                  {disk && <span className="text-[10px] font-mono text-zinc-550">{storagePct.toFixed(0)}%</span>}
                </div>
                {disk ? (
                  <div className="mt-1">
                    <p className="text-base font-bold text-gray-850 dark:text-gray-100">{disk.used} / {disk.total} GB</p>
                    <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mt-1.5">
                      <div className="h-full bg-zinc-800 dark:bg-zinc-300 rounded-full" style={{ width: storagePct + '%' }} />
                    </div>
                  </div>
                ) : (
                  <p className="text-base font-bold text-gray-400 mt-1">N/A</p>
                )}
              </div>
            </div>

            {buckets.length === 0 ? (
              <div className="text-center py-28 bg-white dark:bg-[#131314] rounded-[24px] border border-gray-200/50 dark:border-gray-800/80 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                <svg className="w-20 h-20 text-gray-200 dark:text-gray-800 mx-auto mb-4" fill="none" stroke="currentColor" strokeWidth={0.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <p className="text-gray-550 dark:text-gray-400 text-sm mb-1 font-medium">No buckets available</p>
                <p className="text-gray-400 dark:text-[#a8c7fa] text-xs">Create a bucket to upload, organize, and preview files</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {buckets.map(b => (
                  <div
                    key={b.id}
                    onClick={() => navigate('/b/' + b.name)}
                    className="bg-white dark:bg-[#131314] rounded-2xl border border-gray-200/60 dark:border-gray-800/70 p-5 cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-500 hover:shadow-md transition-all group relative flex flex-col justify-between h-40 animate-fade-in animate-duration-300"
                  >
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-zinc-600 dark:text-zinc-350" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0v3.75m-16.5-3.75v3.75" />
                        </svg>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            navigate('/b/' + b.name + '?tab=settings')
                          }}
                          className="text-gray-400 hover:text-zinc-700 dark:hover:text-zinc-300 p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                          title="Bucket Settings"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                        <button
                          onClick={e => handleDelete(b.name, e)}
                          className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
                          title="Delete Bucket"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{b.label || b.name}</h3>
                      <p className="text-[10px] text-gray-450 dark:text-gray-500 font-mono mt-0.5 truncate">{b.name}</p>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-150/40 dark:border-gray-800/80 flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                      <span>{b.files_count || 0} files</span>
                      <span>{fmtSize(b.total_size)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Create bucket modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-[#2d2e30] border border-gray-200/50 dark:border-gray-700/50 rounded-[24px] shadow-2xl p-6 w-80 animate-scale-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">New Bucket</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Use lowercase letters, numbers, and hyphens only</p>
            <form onSubmit={handleCreate}>
              <input
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 bg-transparent text-gray-800 dark:text-gray-100 rounded-xl text-sm mb-4 focus:outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                placeholder="bucket-name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                autoFocus
                required
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowModal(false)} className="px-4.5 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors cursor-pointer">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-zinc-800 hover:bg-zinc-900 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white rounded-xl text-sm font-medium transition-colors cursor-pointer">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Key display credentials modal */}
      {keyModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in" onClick={() => setKeyModal(null)}>
          <div className="bg-white dark:bg-[#2d2e30] border border-gray-200/50 dark:border-gray-700/50 rounded-[24px] shadow-2xl p-6 w-96 animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 truncate max-w-[280px]" title={keyModal.label || keyModal.name}>
                  {keyModal.label || keyModal.name}
                </h3>
                <p className="text-[10px] text-gray-400 dark:text-gray-550 font-mono mt-0.5">Bucket: {keyModal.name}</p>
              </div>
              <button onClick={() => setKeyModal(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-305 cursor-pointer p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700/80 mb-5">
              <button
                onClick={() => setSettingsTab('general')}
                className={`flex-1 pb-2 text-sm font-medium border-b-2 text-center transition-colors cursor-pointer ${
                  settingsTab === 'general'
                    ? 'border-zinc-800 text-zinc-800 dark:border-zinc-350 dark:text-zinc-300'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                General Settings
              </button>
              <button
                onClick={() => setSettingsTab('keys')}
                className={`flex-1 pb-2 text-sm font-medium border-b-2 text-center transition-colors cursor-pointer ${
                  settingsTab === 'keys'
                    ? 'border-zinc-800 text-zinc-800 dark:border-zinc-350 dark:text-zinc-300'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                S3 Connection (API)
              </button>
            </div>

            {settingsTab === 'general' ? (
              <div>
                {/* Rename field */}
                <div className="mb-5">
                  <label className="text-[10px] text-gray-400 dark:text-gray-550 uppercase tracking-wider font-semibold">Bucket Display Name</label>
                  <form onSubmit={handleSaveLabel} className="flex gap-2 mt-1.5">
                    <input
                      type="text"
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                    className="flex-1 px-3.5 py-2 border border-gray-300 dark:border-gray-700 bg-transparent text-gray-800 dark:text-gray-100 rounded-xl text-sm focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/30"
                      placeholder="Display label"
                      required
                    />
                    <button type="submit" className="px-4 py-2 bg-zinc-800 hover:bg-zinc-900 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white rounded-xl text-sm font-medium cursor-pointer transition-colors shrink-0">Save</button>
                  </form>
                </div>

                {/* Bucket Stats */}
                <label className="text-[10px] text-gray-400 dark:text-gray-550 uppercase tracking-wider font-semibold mb-1.5 block">Bucket Statistics</label>
                <div className="grid grid-cols-3 gap-2.5 mb-6">
                  <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-3 text-center">
                    <span className="text-[10px] text-gray-400 dark:text-gray-550 uppercase font-semibold">Files</span>
                    <p className="text-base font-bold text-gray-805 dark:text-gray-100 mt-0.5">{keyModal.stats?.files || 0}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-3 text-center">
                    <span className="text-[10px] text-gray-400 dark:text-gray-550 uppercase font-semibold">Folders</span>
                    <p className="text-base font-bold text-gray-805 dark:text-gray-100 mt-0.5">{keyModal.stats?.folders || 0}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-3 text-center">
                    <span className="text-[10px] text-gray-400 dark:text-gray-555 uppercase font-semibold">Size</span>
                    <p className="text-xs font-bold text-gray-850 dark:text-gray-100 mt-1.5 truncate" title={fmtSize(keyModal.stats?.size)}>{fmtSize(keyModal.stats?.size)}</p>
                  </div>
                </div>

                {/* Danger zone delete */}
                <div className="border-t border-gray-100 dark:border-gray-800/80 pt-4.5 mb-2">
                  <h4 className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-2.5">Danger Zone</h4>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(keyModal.name, e)}
                    className="w-full py-2.5 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/40 rounded-xl text-xs font-semibold border border-red-200/50 dark:border-red-900/30 transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Delete Bucket and All Files
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs text-zinc-700 bg-zinc-100 dark:bg-zinc-800/30 dark:text-zinc-300 border border-zinc-200/50 dark:border-zinc-800/50 rounded-xl p-3 mb-4 flex items-center gap-2.5">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Use these credentials to configure external S3 clients or SDKs.
                </p>
                {[
                  { label: 'S3 Endpoint', val: `${window.location.protocol}//${window.location.hostname}${window.location.port === '8336' ? ':8335' : (window.location.port ? ':' + window.location.port : ':8335')}` },
                  { label: 'Access Key', val: keyModal.access_key },
                  { label: 'Secret Key', val: keyModal.secret_key },
                  { label: 'Bucket Name', val: keyModal.name },
                ].map(item => (
                  <div key={item.label} className="border border-gray-200/60 dark:border-gray-700 bg-gray-50/50 dark:bg-[#1e1e20]/60 rounded-xl p-3 mb-3">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-semibold">{item.label}</p>
                        <p className="text-sm font-mono text-gray-700 dark:text-gray-300 mt-1 break-all select-all">{item.val}</p>
                      </div>
                      <button
                        onClick={() => { navigator.clipboard.writeText(item.val); showToast('Copied!', 'success') }}
                        className="text-zinc-650 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 shrink-0 ml-2 p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setKeyModal(null)} className="w-full mt-3 py-2.5 bg-zinc-800 hover:bg-zinc-900 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white rounded-xl text-sm font-medium transition-colors cursor-pointer">Done</button>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
