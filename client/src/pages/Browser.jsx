import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import {
  getFiles, uploadFile, downloadFile, deleteFile, renameFile,
  createFolder, deleteFolder, getDisk, getBucketKeys, updateBucketLabel, getBucketStats, deleteBucket,
  downloadBackup, restoreBackup, regenerateBucketKeys
} from '../api/client'
import Toast from '../components/Toast'
import FileIcon from '../components/FileIcon'
import ContextMenu from '../components/ContextMenu'
import DetailsPanel from '../components/DetailsPanel'
import FilePreview from '../components/FilePreview'
import SearchBar from '../components/SearchBar'
import { useTheme } from '../components/ThemeContext'
import Icon from '../components/Icon'

function fmtSize(bytes) {
  if (!bytes) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB']
  let i = 0, s = bytes
  while (s >= 1024 && i < u.length - 1) { s /= 1024; i++ }
  return s.toFixed(1) + ' ' + u[i]
}

function fmtDate(d) {
  if (!d) return ''
  const date = new Date(d + 'Z')
  const now = new Date()
  const diff = now - date
  if (diff < 86400000 && date.getDate() === now.getDate()) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diff < 172800000) return 'Yesterday'
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

const sidebarNav = [
  { id: 'drive', label: 'My Files', icon: 'folder' },
  { id: 'settings', label: 'Bucket Settings', icon: 'settings' },
  { id: 'backup', label: 'Backup & Restore', icon: 'download' }
]

function FilePreviewThumbnail({ file, bucket }) {
  const [url, setUrl] = useState(null)
  const ext = file.original_name.split('.').pop().toLowerCase()
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext)

  useEffect(() => {
    if (!isImage || !file.id) return
    let active = true
    downloadFile(bucket, file.id).then(blob => {
      if (active) {
        setUrl(URL.createObjectURL(blob))
      }
    }).catch(() => {})

    return () => {
      active = false
    }
  }, [file.id, bucket])

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [url])

  if (url) {
    return <img src={url} alt={file.original_name} className="w-full h-full object-cover" />
  }

  return <FileIcon name={file.original_name} size={48} />
}

export default function Browser() {
  const { bucket } = useParams()
  const navigate = useNavigate()
  const fileInput = useRef(null)
  const dropRef = useRef(null)
  const newMenuRef = useRef(null)

  const { theme, toggleTheme } = useTheme()

  const [files, setFiles] = useState([])
  const [folders, setFolders] = useState([])
  const [folderPath, setFolderPath] = useState('/')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [renameTarget, setRenameTarget] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [viewMode, setViewMode] = useState('grid')
  const [disk, setDisk] = useState(null)
  const [sidebarActive, setSidebarActive] = useState('drive')

  const [contextMenu, setContextMenu] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [selectedFolder, setSelectedFolder] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const [previewFile, setPreviewFile] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [checked, setChecked] = useState(new Set())
  const [dragOver, setDragOver] = useState(false)
  const [showNewMenu, setShowNewMenu] = useState(false)
  const [settingsTab, setSettingsTab] = useState('general')
  const [editLabel, setEditLabel] = useState('')
  const [backupLoading, setBackupLoading] = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [bucketKeys, setBucketKeys] = useState(null)
  const [bucketStats, setBucketStats] = useState(null)

  const totalSize = files.reduce((s, f) => s + (f.size || 0), 0)
  const location = useLocation()

  async function loadSettings() {
    try {
      const keys = await getBucketKeys(bucket)
      const statsData = await getBucketStats(bucket)
      if (keys.error) {
        setToast({ msg: keys.error, type: 'error' })
        return
      }
      setBucketKeys({
        name: bucket,
        label: keys.label || bucket,
        access_key: keys.access_key,
        secret_key: keys.secret_key
      })
      setBucketStats(statsData || { files: 0, folders: 0, size: 0 })
      setEditLabel(keys.label || bucket)
    } catch (err) {
      setToast({ msg: err.message || 'Failed to load settings', type: 'error' })
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const tab = params.get('tab')
    if (tab === 'settings') {
      setSidebarActive('settings')
      loadSettings()
    } else if (tab === 'backup') {
      setSidebarActive('backup')
    } else {
      setSidebarActive('drive')
      setFolderPath('/')
      loadFiles()
    }
    getDisk().then(setDisk)
  }, [bucket, location.search])

  useEffect(() => {
    if (sidebarActive === 'drive') {
      loadFiles()
    }
  }, [folderPath])

  useEffect(() => {
    function handleClickOutside(e) {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target)) {
        setShowNewMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function loadFiles() {
    setLoading(true)
    const d = await getFiles(bucket, folderPath)
    setFiles(d.files || [])
    setFolders(d.folders || [])
    setChecked(new Set())
    setLoading(false)
  }

  async function handleSaveLabel(e) {
    e?.preventDefault()
    if (!editLabel.trim()) return
    const d = await updateBucketLabel(bucket, editLabel.trim())
    if (d.error) {
      setToast({ msg: d.error, type: 'error' })
      return
    }
    setToast({ msg: 'Bucket renamed successfully', type: 'success' })
    setBucketKeys(prev => prev ? { ...prev, label: editLabel.trim() } : null)
  }

  async function handleDeleteBucket() {
    if (!confirm('Delete bucket "' + bucket + '" and ALL files?')) return
    await deleteBucket(bucket)
    navigate('/')
  }

  async function handleRegenerateKeys() {
    if (!confirm('Are you sure you want to regenerate S3 credentials? Any external clients using current keys will be disconnected.')) return
    const d = await regenerateBucketKeys(bucket)
    if (d.error) {
      setToast({ msg: d.error, type: 'error' })
      return
    }
    setToast({ msg: 'S3 Credentials regenerated successfully!', type: 'success' })
    setBucketKeys({
      name: bucket,
      label: d.label || bucket,
      access_key: d.access_key,
      secret_key: d.secret_key
    })
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
      setToast({ msg: 'Backup downloaded successfully', type: 'success' })
    } catch (err) {
      setToast({ msg: err.message || 'Backup failed', type: 'error' })
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
        setToast({ msg: res.error, type: 'error' })
        return
      }
      setToast({ msg: 'Restoration successful! Reloading page...', type: 'success' })
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (err) {
      setToast({ msg: err.message || 'Restoration failed', type: 'error' })
    } finally {
      setRestoreLoading(false)
    }
  }

  function parts() { return folderPath.split('/').filter(Boolean) }

  function goUp() { const p = parts(); p.pop(); setFolderPath('/' + p.join('/')) }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const d = await uploadFile(bucket, file, folderPath)
    if (d.error) showToast(d.error, 'error')
    else showToast('Uploaded ' + d.name, 'success')
    loadFiles()
    e.target.value = ''
  }

  async function handleUploadFiles(fileList) {
    for (const file of Array.from(fileList)) {
      const d = await uploadFile(bucket, file, folderPath)
      if (d.error) showToast(d.error, 'error')
    }
    showToast('Upload complete', 'success')
    loadFiles()
  }

  async function handleDownload(id) {
    try {
      const blob = await downloadFile(bucket, id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = ''
      document.body.appendChild(a); a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch { showToast('Download failed', 'error') }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this file?')) return
    const d = await deleteFile(bucket, id)
    if (d.ok) { showToast('Deleted', 'success'); loadFiles() }
    else showToast(d.error, 'error')
  }

  async function handleFolderDelete(path) {
    if (!confirm('Delete folder and all contents?')) return
    const d = await deleteFolder(bucket, path)
    if (d.ok) { showToast('Folder deleted', 'success'); loadFiles() }
    else showToast(d.error, 'error')
  }

  async function handleRename() {
    if (!renameValue.trim() || !renameTarget) return
    const d = await renameFile(bucket, renameTarget.id, renameValue.trim())
    if (d.ok) { showToast('Renamed', 'success'); loadFiles() }
    else showToast(d.error, 'error')
    setRenameTarget(null); setRenameValue('')
  }

  async function handleCreateFolder(e) {
    e.preventDefault()
    if (!newFolderName.trim()) return
    const path = (folderPath === '/' ? '/' : folderPath + '/') + newFolderName.trim()
    const d = await createFolder(bucket, path)
    if (d.ok) { showToast('Folder created', 'success'); loadFiles() }
    else showToast(d.error, 'error')
    setShowFolderModal(false); setNewFolderName('')
  }

  function showToast(msg, type) { setToast({ msg, type }) }
  function closeModals() { setShowFolderModal(false); setRenameTarget(null) }

  function handleFileClick(f) {
    setPreviewFile(f)
  }

  // Double click logic to enter folder
  function handleFolderClick(f) {
    setFolderPath(f.path)
  }

  function handleContextMenu(e, item, isFolder = false) {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, item, isFolder })
  }

  function handleDetailsClick(f, isFolder = false) {
    if (isFolder) { setSelectedFolder(f); setSelectedFile(null) }
    else { setSelectedFile(f); setSelectedFolder(null) }
    setShowDetails(true)
  }

  const filteredFiles = files.filter(f =>
    !searchQuery || f.original_name.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const filteredFolders = folders.filter(f =>
    !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  function getFileContextItems(f) {
    return [
      { label: 'Preview', icon: 'eye', onClick: () => setPreviewFile(f) },
      { label: 'Download', icon: 'download', onClick: () => handleDownload(f.id) },
      { label: 'Rename', icon: 'pencil', onClick: () => { setRenameTarget(f); setRenameValue(f.original_name) } },
      { label: 'Details', icon: 'info', onClick: () => handleDetailsClick(f) },
      { separator: true },
      { label: 'Delete', icon: 'trash', danger: true, onClick: () => handleDelete(f.id) },
    ]
  }

  function getFolderContextItems(f) {
    return [
      { label: 'Open', icon: 'folder-open', onClick: () => setFolderPath(f.path) },
      { label: 'Details', icon: 'info', onClick: () => handleDetailsClick(f, true) },
      { separator: true },
      { label: 'Delete', icon: 'trash', danger: true, onClick: () => handleFolderDelete(f.path) },
    ]
  }

  function handleDragOver(e) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }

  function handleDragLeave(e) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }

  function handleDrop(e) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) handleUploadFiles(e.dataTransfer.files)
  }

  return (
    <div className="h-screen flex flex-col bg-[#f8fafd] dark:bg-[#1B1B1B] text-gray-700 dark:text-[#e3e3e3] overflow-hidden select-none transition-colors duration-200">
      {/* Top bar */}
      <header className="h-16 flex items-center justify-between px-6 bg-[#f8fafd] dark:bg-[#1B1B1B] shrink-0 select-none">
        <div className="flex items-center gap-3 w-60 shrink-0">
          <button onClick={() => navigate('/')} className="flex items-center gap-2.5 cursor-pointer">
            <div className="w-9 h-9 bg-zinc-800 dark:bg-zinc-200 rounded-xl flex items-center justify-center shadow-md shadow-zinc-800/10">
              <Icon name="layout-grid" size={20} className="text-white dark:text-zinc-900" />
            </div>
            <span className="text-xl font-medium text-gray-800 dark:text-[#f2f2f2] tracking-tight" style={{ fontFamily: "'Product Sans', 'Google Sans', Arial" }}>SaimumFile</span>
          </button>
        </div>

        <div className="flex-1 max-w-[720px] mx-6">
          <SearchBar onSearch={setSearchQuery} />
        </div>

        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-full hover:bg-gray-200/60 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-pointer transition-colors"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Icon name="sun" size={20} /> : <Icon name="moon" size={20} />}
          </button>

          <button
            onClick={() => navigate(`/b/${bucket}?tab=settings`)}
            className="p-2.5 rounded-full hover:bg-gray-200/60 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-pointer transition-colors"
            title="Bucket S3 Settings / Credentials"
          >
            <Icon name="settings" size={20} />
          </button>

          <button
            onClick={() => navigate('/')}
            className="p-2.5 rounded-full hover:bg-gray-200/60 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-pointer transition-colors"
            title="Go to Buckets Dashboard"
          >
            <Icon name="home" size={20} />
          </button>
        </div>
      </header>

      {/* Main Workspace below header */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-64 flex flex-col bg-transparent shrink-0 pl-3 pr-2 py-4 select-none justify-between">
          <div className="flex flex-col">
            {/* "+ New" Dropdown Button */}
            <div className="px-4 mb-6 relative" ref={newMenuRef}>
              <button
                onClick={() => setShowNewMenu(!showNewMenu)}
                className="flex items-center gap-3 px-6 py-3.5 bg-white dark:bg-[#2d2e30] text-gray-700 dark:text-[#e3e3e3] rounded-2xl shadow-[0_1px_3px_1px_rgba(60,64,67,0.15),0_1px_2px_0_rgba(60,64,67,0.3)] hover:shadow-[0_4px_8px_3px_rgba(60,64,67,0.15),0_1px_3px_0_rgba(60,64,67,0.3)] hover:bg-[#fafafa] dark:hover:bg-[#353638] transition-all font-medium text-sm cursor-pointer select-none border border-gray-250/20 dark:border-gray-700/50"
              >
                <Icon name="plus" size={20} className="text-gray-700 dark:text-[#e3e3e3]" strokeWidth={2.5} />
                New
              </button>

              {showNewMenu && (
                <div className="absolute left-4 top-14 mt-1 bg-white dark:bg-[#2d2e30] border border-gray-200/60 dark:border-gray-700 rounded-xl shadow-xl py-1.5 w-48 z-40 animate-scale-in">
                  <button
                    onClick={() => { setShowNewMenu(false); setShowFolderModal(true) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-[#e3e3e3] hover:bg-gray-100 dark:hover:bg-gray-800 text-left cursor-pointer"
                  >
                    <Icon name="folder-plus" size={20} className="text-gray-500 dark:text-gray-400" />
                    New Folder
                  </button>
                  <button
                    onClick={() => { setShowNewMenu(false); fileInput.current?.click() }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-[#e3e3e3] hover:bg-gray-100 dark:hover:bg-gray-800 text-left cursor-pointer"
                  >
                    <Icon name="upload" size={20} className="text-gray-500 dark:text-gray-400" />
                    File Upload
                  </button>
                </div>
              )}
              <input ref={fileInput} type="file" onChange={handleUpload} className="hidden" />
            </div>

            {/* Sidebar Navigation */}
            <nav className="space-y-0.5 pr-2">
              {sidebarNav.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    if (item.id === 'drive') {
                      navigate(`/b/${bucket}`)
                    } else {
                      navigate(`/b/${bucket}?tab=${item.id}`)
                    }
                  }}
                  className={`flex items-center gap-3 px-5 py-2.5 mx-2 rounded-full text-sm cursor-pointer transition-all ${
                    sidebarActive === item.id
                      ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium'
                      : 'text-gray-600 dark:text-[#c4c7c5] hover:bg-gray-200/50 dark:hover:bg-gray-800/40'
                  }`}
                >
                  <Icon name={item.icon} size={20} className="shrink-0" strokeWidth={1.5} />
                  {item.label}
                </div>
              ))}
            </nav>
          </div>

          {/* Storage & Sign Out Info */}
          {disk && (
            <div className="px-4 py-3 mx-2 border-t border-gray-200 dark:border-gray-800">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                <span>Storage</span>
                <span>{fmtSize(totalSize)} / {fmtSize(disk.total * 1073741824)}</span>
              </div>
              <div className="h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-zinc-850 dark:bg-zinc-300 rounded-full" style={{ width: Math.min(100, (totalSize / (disk.total * 1073741824)) * 100) + '%' }} />
              </div>
              <button
                onClick={() => { localStorage.removeItem('token'); navigate('/login') }}
                className="mt-4 w-full flex items-center justify-center gap-2 py-2 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-800 rounded-full transition-colors cursor-pointer border border-transparent hover:border-gray-200/30"
              >
                <Icon name="log-out" size={14} />
                Sign Out
              </button>
            </div>
          )}
        </aside>

        {/* Main Content Area (Rounded Google-style panel) */}
        <div
          ref={dropRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => { setContextMenu(null); if (!showDetails) { setSelectedFile(null); setSelectedFolder(null) } }}
          className={`flex-1 flex bg-white dark:bg-[#131314] rounded-[24px] mr-4 mb-4 overflow-hidden border border-gray-200/50 dark:border-gray-800/80 flex-row min-w-0 shadow-[0_1px_2px_rgba(0,0,0,0.05)] relative ${
            dragOver ? 'ring-2 ring-zinc-800 dark:ring-zinc-400 bg-zinc-500/10' : ''
          }`}
        >
          {/* Drag and Drop visual overlay */}
          {sidebarActive === 'drive' && dragOver && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-zinc-500/5 pointer-events-none">
              <div className="bg-white dark:bg-[#2d2e30] border-2 border-dashed border-zinc-450 dark:border-zinc-600 rounded-3xl p-12 text-center shadow-xl max-w-sm">
                <Icon name="upload-cloud" size={48} className="text-zinc-800 dark:text-zinc-300 mx-auto mb-3 animate-bounce" strokeWidth={1.5} />
                <p className="text-zinc-800 dark:text-zinc-200 font-medium">Drop files to upload</p>
                <p className="text-xs text-gray-400 mt-1">Upload directly into "{parts().pop() || bucket}"</p>
              </div>
            </div>
          )}

          {/* Left partition of main workspace: File details and path */}
          {sidebarActive === 'drive' && (
            <div className="flex-1 flex flex-col min-w-0">
              {/* Header toolbar within rounded container */}
              <header className="h-14 border-b border-gray-100 dark:border-gray-800/80 flex items-center justify-between px-6 bg-transparent shrink-0">
                {/* Title / Breadcrumbs */}
                <div className="flex items-center gap-1 text-sm overflow-x-auto py-1">
                  <button onClick={() => setFolderPath('/')} className="text-gray-800 dark:text-gray-200 hover:text-zinc-900 dark:hover:text-zinc-200 font-semibold px-2.5 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-colors shrink-0">
                    {bucket}
                  </button>
                  {parts().map((p, i) => (
                    <span key={i} className="flex items-center gap-1 shrink-0">
                      <Icon name="chevron-right" size={14} className="text-gray-400" strokeWidth={2.5} />
                      <button onClick={() => setFolderPath('/' + parts().slice(0, i + 1).join('/'))} className="text-gray-800 dark:text-gray-200 hover:text-zinc-900 dark:hover:text-zinc-200 px-2.5 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-colors">{p}</button>
                    </span>
                  ))}
                </div>

                {/* Segmented control view-toggle and details toggle */}
                <div className="flex items-center gap-3">
                  {/* Segmented buttons container */}
                  <div className="flex items-center bg-[#f0f4f9] dark:bg-[#2d2e30] p-0.5 rounded-lg border border-gray-200/20 dark:border-gray-700/20">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded-md transition-all cursor-pointer ${
                        viewMode === 'grid'
                          ? 'bg-white dark:bg-[#1e1e1f] text-zinc-800 dark:text-zinc-200 shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
                          : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400'
                      }`}
                      title="Grid View"
                    >
                      <Icon name="grid-view" size={16} />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-1.5 rounded-md transition-all cursor-pointer ${
                        viewMode === 'list'
                          ? 'bg-white dark:bg-[#1e1e1f] text-zinc-800 dark:text-zinc-200 shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
                          : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400'
                      }`}
                      title="List View"
                    >
                      <Icon name="list-view" size={16} />
                    </button>
                  </div>

                  <button onClick={() => setShowDetails(!showDetails)} className={`p-2 rounded-full ${showDetails ? 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-200' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400'} cursor-pointer transition-colors`} title="Details Panel">
                    <Icon name="info" size={20} strokeWidth={1.5} />
                  </button>
                </div>
              </header>

              <div className="h-12 border-b border-gray-100 dark:border-gray-800/80 flex items-center px-6 gap-2 bg-[#fbfcfd] dark:bg-[#131314] shrink-0 overflow-x-auto scrollbar-none">
                <button
                  onClick={goUp}
                  className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <Icon name="undo-2" size={14} strokeWidth={2.5} />
                  Back Up
                </button>

                <button
                  onClick={() => setShowFolderModal(true)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <Icon name="plus" size={14} strokeWidth={2.5} />
                  New Folder
                </button>
              </div>

              {/* Files & Folders Container */}
              <div className="flex-1 overflow-auto" onClick={() => setContextMenu(null)}>
                {loading ? (
                  <div className="p-6">
                    {/* Folder Section skeleton */}
                    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-800 rounded mb-4" />
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 mb-8">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="animate-pulse bg-gray-100 dark:bg-[#282a2d] h-12 rounded-xl" />
                      ))}
                    </div>

                    {/* File Section skeleton */}
                    <div className="h-4 w-20 bg-gray-200 dark:bg-gray-800 rounded mb-4" />
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="animate-pulse">
                          <div className="h-48 bg-gray-100 dark:bg-[#282a2d] rounded-2xl mb-2" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : filteredFolders.length === 0 && filteredFiles.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center p-6 select-none">
                      {searchQuery ? (
                        <>
                          <Icon name="search" size={64} className="text-gray-300 dark:text-gray-650 mx-auto mb-4" strokeWidth={1} />
                          <p className="text-gray-400 dark:text-gray-500 text-sm">No items matching "{searchQuery}"</p>
                        </>
                      ) : (
                        <>
                          <Icon name="folder-open" size={80} className="text-gray-200 dark:text-gray-800 mx-auto mb-4" strokeWidth={0.8} />
                          <p className="text-gray-400 dark:text-gray-550 text-sm mb-1 font-medium">This folder is empty</p>
                          <p className="text-gray-350 dark:text-gray-600 text-xs">Drag and drop files here to upload instantly</p>
                        </>
                      )}
                    </div>
                  </div>
                ) : viewMode === 'grid' ? (
                  <div className="p-6 select-none">
                    {/* Folders block */}
                    {filteredFolders.length > 0 && (
                      <div className="mb-8 animate-fade-in">
                        <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-505 uppercase tracking-wider mb-4">Folders</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                          {filteredFolders.map(f => (
                            <div
                              key={f.path}
                              onDoubleClick={() => handleFolderClick(f)}
                              onContextMenu={(e) => handleContextMenu(e, f, true)}
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedFolder(f); setSelectedFile(null)
                                if (!showDetails) setSelectedFolder(null)
                              }}
                              className={`group flex items-center gap-3 px-4 h-12 rounded-xl cursor-pointer transition-all border ${
                                selectedFolder?.path === f.path
                                  ? 'bg-[#eeddfa] dark:bg-[#581c87] border-transparent text-[#3b0764] dark:text-[#eeddfa]'
                                  : 'bg-[#f0f4f9] hover:bg-[#e1e5ea] dark:bg-[#282a2d] dark:hover:bg-[#333537] border-transparent text-gray-700 dark:text-gray-200'
                              }`}
                            >
                              <FileIcon name={f.name} isFolder size={20} />
                              <span className="text-sm font-medium truncate flex-1 leading-none">{f.name}</span>

                              <button
                                onClick={(e) => { e.stopPropagation(); handleContextMenu(e, f, true) }}
                                className="p-1 rounded-full text-gray-500 hover:bg-black/5 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                                title="More actions"
                              >
                                <Icon name="three-dots" size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Files block */}
                    {filteredFiles.length > 0 && (
                      <div className="animate-fade-in">
                        <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-505 uppercase tracking-wider mb-4">Files</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                          {filteredFiles.map(f => (
                            <div
                              key={f.id}
                              onDoubleClick={() => handleFileClick(f)}
                              onContextMenu={(e) => handleContextMenu(e, f, false)}
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedFile(f); setSelectedFolder(null)
                                if (!showDetails) setSelectedFile(null)
                              }}
                              className={`group flex flex-col h-48 rounded-2xl cursor-pointer transition-all border overflow-hidden relative ${
                                selectedFile?.id === f.id
                                  ? 'bg-[#eeddfa]/30 dark:bg-[#581c87]/20 border-[#d8b4fe] dark:border-[#581c87]'
                                  : 'bg-[#f0f4f9]/40 hover:bg-[#dfe3e8]/60 dark:bg-[#282a2d]/30 dark:hover:bg-[#333537]/50 border-transparent dark:border-transparent'
                              }`}
                            >
                              {/* Card Header (horizontal styling matching Google Drive) */}
                              <div className="flex items-center gap-2 px-4 py-2.5 shrink-0 min-w-0">
                                <FileIcon name={f.original_name} size={18} />
                                <span className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate flex-1 leading-none" title={f.original_name}>
                                  {f.original_name}
                                </span>

                                {/* Operations trigger on hover */}
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleContextMenu(e, f, false) }}
                                  className="p-1 rounded-full text-gray-500 hover:bg-black/5 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                                  title="More actions"
                                >
                                  <Icon name="three-dots" size={16} />
                                </button>
                              </div>

                              {/* Card preview space (Google Drive style inner card) */}
                              <div className="flex-1 bg-white dark:bg-[#131314] m-1.5 mt-0 rounded-xl flex items-center justify-center border border-gray-150/40 dark:border-gray-800/80 overflow-hidden relative">
                                <FilePreviewThumbnail file={f} bucket={bucket} />
                              </div>

                              {/* Inline rename input overlay */}
                              {renameTarget?.id === f.id && (
                                <div className="absolute inset-0 bg-white/95 dark:bg-[#131314]/95 rounded-2xl flex items-center justify-center p-3.5 z-10 animate-fade-in" onClick={e => e.stopPropagation()}>
                                  <form onSubmit={(e) => { e.preventDefault(); handleRename(); }} className="w-full">
                                    <input className="w-full px-2 py-1.5 border border-zinc-400 rounded-lg text-xs bg-transparent text-gray-855 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-zinc-200" value={renameValue} onChange={e => setRenameValue(e.target.value)} autoFocus />
                                    <div className="flex gap-2 mt-2 justify-center">
                                      <button type="submit" className="text-xs text-white bg-zinc-800 hover:bg-zinc-900 dark:bg-zinc-700 dark:hover:bg-zinc-600 px-3 py-1 rounded-full font-medium cursor-pointer">Save</button>
                                      <button type="button" onClick={() => setRenameTarget(null)} className="text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 px-3 py-1 rounded-full cursor-pointer">Cancel</button>
                                    </div>
                                  </form>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* List view details table */
                  <div className="p-0 select-none">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-800 text-left">
                          <th className="text-xs font-semibold text-gray-400 dark:text-gray-550 uppercase tracking-wider px-6 py-3.5 w-12"></th>
                          <th className="text-xs font-semibold text-gray-400 dark:text-gray-550 uppercase tracking-wider px-3 py-3.5">Name</th>
                          <th className="text-xs font-semibold text-gray-400 dark:text-gray-550 uppercase tracking-wider px-3 py-3.5 w-24 hidden sm:table-cell">Size</th>
                          <th className="text-xs font-semibold text-gray-400 dark:text-gray-550 uppercase tracking-wider px-3 py-3.5 w-36 hidden md:table-cell">Modified</th>
                          <th className="w-16 px-3 py-3.5"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Folder list rows */}
                        {filteredFolders.map(f => (
                          <tr
                            key={f.path}
                            onDoubleClick={() => handleFolderClick(f)}
                            onContextMenu={(e) => handleContextMenu(e, f, true)}
                            onClick={(e) => { e.stopPropagation(); setSelectedFolder(f); setSelectedFile(null); if (!showDetails) setSelectedFolder(null) }}
                            className={`border-b border-gray-50 dark:border-gray-800/40 hover:bg-gray-100/50 dark:hover:bg-gray-850/40 cursor-pointer group transition-colors ${
                              selectedFolder?.path === f.path ? 'bg-zinc-200/30 dark:bg-zinc-800/40' : ''
                            }`}
                          >
                            <td className="px-6 py-3.5">
                              <FileIcon name={f.name} isFolder size={22} />
                            </td>
                            <td className="px-3 py-3.5 text-sm text-gray-700 dark:text-gray-200 font-medium truncate max-w-[200px] sm:max-w-none">{f.name}</td>
                            <td className="px-3 py-3.5 text-xs text-gray-400 dark:text-gray-500 hidden sm:table-cell">—</td>
                            <td className="px-3 py-3.5 text-xs text-gray-400 dark:text-gray-500 hidden md:table-cell">{fmtDate(f.created_at)}</td>
                            <td className="px-3 py-3.5 text-right">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleContextMenu(e, f, true) }}
                                className="p-1 rounded-full text-gray-450 hover:bg-black/5 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                              >
                                <Icon name="three-dots" size={16} className="mx-auto" />
                              </button>
                            </td>
                          </tr>
                        ))}

                        {/* Files list rows */}
                        {filteredFiles.map(f => (
                          <tr
                            key={f.id}
                            onDoubleClick={() => handleFileClick(f)}
                            onContextMenu={(e) => handleContextMenu(e, f, false)}
                            onClick={(e) => { e.stopPropagation(); setSelectedFile(f); setSelectedFolder(null); if (!showDetails) setSelectedFile(null) }}
                            className={`border-b border-gray-50 dark:border-gray-800/40 hover:bg-gray-100/50 dark:hover:bg-gray-855/40 cursor-pointer group transition-colors ${
                              selectedFile?.id === f.id ? 'bg-zinc-200/30 dark:bg-zinc-800/40' : ''
                            }`}
                          >
                            <td className="px-6 py-3.5">
                              <FileIcon name={f.original_name} size={22} />
                            </td>
                            <td className="px-3 py-3.5 text-sm text-gray-700 dark:text-gray-200 font-medium">
                              {renameTarget?.id === f.id ? (
                                <form onSubmit={(e) => { e.preventDefault(); handleRename(); }} className="flex gap-1.5 items-center" onClick={e => e.stopPropagation()}>
                                  <input className="border border-zinc-400 dark:border-zinc-500 bg-transparent text-gray-855 dark:text-gray-100 rounded-lg px-2 py-1 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-zinc-200" value={renameValue} onChange={e => setRenameValue(e.target.value)} autoFocus />
                                  <button type="submit" className="text-xs text-white bg-zinc-800 hover:bg-zinc-900 dark:bg-zinc-700 dark:hover:bg-zinc-600 px-3 py-1.5 rounded-lg cursor-pointer">Save</button>
                                  <button type="button" onClick={() => setRenameTarget(null)} className="text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-150 dark:hover:bg-gray-800 px-3 py-1.5 rounded-lg cursor-pointer">Cancel</button>
                                </form>
                              ) : (
                                <span className="truncate max-w-[200px] sm:max-w-none inline-block" title={f.original_name}>{f.original_name}</span>
                              )}
                            </td>
                            <td className="px-3 py-3.5 text-xs text-gray-400 dark:text-gray-500 hidden sm:table-cell">{fmtSize(f.size)}</td>
                            <td className="px-3 py-3.5 text-xs text-gray-400 dark:text-gray-500 hidden md:table-cell">{fmtDate(f.created_at)}</td>
                            <td className="px-3 py-3.5 text-right">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleContextMenu(e, f, false) }}
                                className="p-1 rounded-full text-gray-455 hover:bg-black/5 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                              >
                                <Icon name="three-dots" size={16} className="mx-auto" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Collapsible Right Details panel inside rounded box container */}
          {sidebarActive === 'drive' && showDetails && (
            <DetailsPanel
              file={selectedFile}
              folder={selectedFolder}
              onClose={() => { setShowDetails(false); setSelectedFile(null); setSelectedFolder(null) }}
              onDownload={handleDownload}
              onRename={(f) => { setRenameTarget(f); setRenameValue(f.original_name) }}
              onDelete={handleDelete}
            />
          )}

          {/* Inline Settings View */}
          {sidebarActive === 'settings' && (
            <div className="flex-1 flex flex-col min-w-0 p-8 overflow-y-auto animate-fade-in">
              <div className="mb-6 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold text-gray-805 dark:text-gray-100">
                    {bucketKeys?.label || bucket} Settings
                  </h2>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Configure friendly name, S3 credentials, or manage bucket</p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-200 dark:border-gray-700/80 mb-6">
                <button
                  onClick={() => setSettingsTab('general')}
                  className={`pb-3 text-sm font-semibold border-b-2 px-6 transition-colors cursor-pointer ${
                    settingsTab === 'general'
                      ? 'border-zinc-800 text-zinc-800 dark:border-zinc-350 dark:text-zinc-300'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-[#c4c7c5]'
                  }`}
                >
                  General Settings
                </button>
                <button
                  onClick={() => setSettingsTab('keys')}
                  className={`pb-3 text-sm font-semibold border-b-2 px-6 transition-colors cursor-pointer ${
                    settingsTab === 'keys'
                      ? 'border-zinc-800 text-zinc-800 dark:border-zinc-350 dark:text-zinc-300'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-[#c4c7c5]'
                  }`}
                >
                  S3 API Connection
                </button>
              </div>

              {settingsTab === 'general' ? (
                <div className="max-w-2xl space-y-6">
                  {/* Rename field */}
                  <div className="bg-[#f8fafd] dark:bg-[#282a2d]/30 border border-gray-200/50 dark:border-gray-800/80 rounded-2xl p-5 animate-fade-in">
                    <label className="text-xs text-gray-450 dark:text-gray-400 font-semibold block mb-2">Bucket Display Name</label>
                    <form onSubmit={handleSaveLabel} className="flex gap-3">
                      <input
                        type="text"
                        value={editLabel}
                        onChange={e => setEditLabel(e.target.value)}
                        className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1e1e1f] text-gray-800 dark:text-gray-100 rounded-xl text-sm focus:outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                        placeholder="Friendly label"
                        required
                      />
                      <button type="submit" className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-900 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white rounded-xl text-sm font-semibold cursor-pointer transition-colors shadow-sm">Save Label</button>
                    </form>
                  </div>

                  {/* Bucket Stats */}
                  <div className="bg-[#f8fafd] dark:bg-[#282a2d]/30 border border-gray-200/50 dark:border-gray-800/80 rounded-2xl p-5 animate-fade-in">
                    <label className="text-xs text-gray-450 dark:text-gray-400 font-semibold mb-3 block">Bucket Statistics</label>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white dark:bg-[#131314] border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-4 text-center">
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-semibold">Files</span>
                        <p className="text-xl font-bold text-gray-800 dark:text-gray-100 mt-1">{bucketStats?.files || 0}</p>
                      </div>
                      <div className="bg-white dark:bg-[#131314] border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-4 text-center">
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-semibold">Folders</span>
                        <p className="text-xl font-bold text-gray-800 dark:text-gray-100 mt-1">{bucketStats?.folders || 0}</p>
                      </div>
                      <div className="bg-white dark:bg-[#131314] border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-4 text-center">
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-semibold">Size</span>
                        <p className="text-base font-bold text-gray-800 dark:text-gray-100 mt-1.5 truncate" title={fmtSize(bucketStats?.size)}>{fmtSize(bucketStats?.size)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Danger zone delete */}
                  <div className="bg-red-50/10 dark:bg-red-950/5 border border-red-200/30 dark:border-red-900/20 rounded-2xl p-5 animate-fade-in">
                    <h4 className="text-sm font-semibold text-red-500 uppercase tracking-wider mb-2">Danger Zone</h4>
                    <p className="text-xs text-gray-400 dark:text-gray-450 mb-4">Deleting this bucket will permanently destroy all stored files and database entries associated with it. This action is irreversible.</p>
                    <button
                      type="button"
                      onClick={handleDeleteBucket}
                      className="py-2.5 px-6 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/40 rounded-xl text-xs font-semibold border border-red-200/50 dark:border-red-900/30 transition-colors cursor-pointer text-center flex items-center gap-1.5 inline-flex"
                    >
                      <Icon name="trash" size={14} />
                      Delete Bucket and All Files
                    </button>
                  </div>
                </div>
              ) : (
                <div className="max-w-2xl space-y-4 animate-fade-in">
                  <p className="text-xs text-zinc-700 bg-zinc-100 dark:bg-zinc-800/30 dark:text-zinc-300 border border-zinc-200/50 dark:border-zinc-800/50 rounded-xl p-4 flex items-center gap-2.5">
                    <Icon name="info" size={16} className="shrink-0" />
                    Use these credentials to configure external S3 clients or SDKs.
                  </p>
                  {[
                    { label: 'S3 Endpoint', val: `${window.location.protocol}//${window.location.hostname}${window.location.port === '8336' ? ':8335' : (window.location.port ? ':' + window.location.port : ':8335')}` },
                    { label: 'Access Key', val: bucketKeys?.access_key },
                    { label: 'Secret Key', val: bucketKeys?.secret_key },
                    { label: 'Bucket Name', val: bucketKeys?.name },
                  ].map(item => (
                    <div key={item.label} className="border border-gray-200/65 dark:border-gray-700 bg-gray-50/50 dark:bg-[#282a2d]/30 rounded-xl p-4 flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-semibold">{item.label}</p>
                        <p className="text-sm font-mono text-gray-750 dark:text-gray-300 mt-1 break-all select-all">{item.val}</p>
                      </div>
                      <button
                        onClick={() => { navigator.clipboard.writeText(item.val); setToast({ msg: 'Copied!', type: 'success' }) }}
                        className="text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100 shrink-0 ml-4 p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                        title={`Copy ${item.label}`}
                      >
                        <Icon name="copy" size={16} />
                      </button>
                    </div>
                  ))}

                  <div className="flex gap-4 items-center pt-2">
                    <button
                      onClick={handleRegenerateKeys}
                      className="px-5 py-2.5 bg-red-500/10 hover:bg-red-500/25 text-red-650 dark:text-red-400 rounded-xl text-xs font-semibold cursor-pointer border border-red-250/20 dark:border-red-900/30 transition-all flex items-center gap-2"
                    >
                      <Icon name="refresh-cw" size={16} />
                      Regenerate Credentials
                    </button>
                  </div>

                  <div className="bg-[#f8fafd] dark:bg-[#131314]/50 border border-gray-200/50 dark:border-gray-800/80 rounded-2xl p-5 mt-6">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Copy to .env</span>
                      <button
                        onClick={() => {
                          const envStr = `AWS_ACCESS_KEY_ID=${bucketKeys?.access_key || ''}\nAWS_SECRET_ACCESS_KEY=${bucketKeys?.secret_key || ''}\nAWS_ENDPOINT_URL=${window.location.protocol}//${window.location.hostname}${window.location.port === '8336' ? ':8335' : (window.location.port ? ':' + window.location.port : ':8335')}\nAWS_BUCKET=${bucketKeys?.name || ''}`;
                          navigator.clipboard.writeText(envStr);
                          setToast({ msg: '.env configuration copied!', type: 'success' });
                        }}
                        className="text-xs text-zinc-700 hover:text-zinc-900 dark:text-zinc-400 font-semibold flex items-center gap-1.5 cursor-pointer hover:underline"
                      >
                        <Icon name="copy" size={14} />
                        Copy all as .env
                      </button>
                    </div>
                    <pre className="text-xs font-mono bg-white dark:bg-[#0d0e12] border border-gray-200/50 dark:border-gray-850 p-4 rounded-xl text-gray-600 dark:text-gray-450 overflow-x-auto leading-relaxed select-all">
{`AWS_ACCESS_KEY_ID=${bucketKeys?.access_key || ''}
AWS_SECRET_ACCESS_KEY=${bucketKeys?.secret_key || ''}
AWS_ENDPOINT_URL=${window.location.protocol}//${window.location.hostname}${window.location.port === '8336' ? ':8335' : (window.location.port ? ':' + window.location.port : ':8335')}
AWS_BUCKET=${bucketKeys?.name || ''}`}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Inline Backup & Restore View */}
          {sidebarActive === 'backup' && (
            <div className="flex-1 flex flex-col min-w-0 p-8 overflow-y-auto animate-fade-in">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-805 dark:text-gray-100">Backup & Restore</h2>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Manage system backups and restore your files and database</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
                {/* Backup */}
                <div className="bg-[#f8fafd] dark:bg-[#282a2d]/30 border border-gray-200/50 dark:border-gray-800/80 rounded-[24px] p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-2">Create & Download Backup</h3>
                    <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed mb-6">
                      Generates a single compressed archive (`.tar.gz`) containing the SQLite database records, credentials, buckets metadata, and all files stored on this instance.
                    </p>
                  </div>
                  <button
                    onClick={handleBackupDownload}
                    disabled={backupLoading}
                    className="w-full py-3 bg-zinc-800 hover:bg-zinc-900 dark:bg-zinc-700 dark:hover:bg-zinc-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold cursor-pointer transition-colors shadow-sm flex items-center justify-center gap-2"
                  >
                    {backupLoading ? <Icon name="spinner" size={16} className="animate-spin text-white" /> : <Icon name="download" size={16} strokeWidth={2.5} />}
                    {backupLoading ? 'Creating backup archive...' : 'Download Backup Archive'}
                  </button>
                </div>

                {/* Restore */}
                <div className="bg-[#f8fafd] dark:bg-[#282a2d]/30 border border-gray-200/50 dark:border-gray-800/80 rounded-[24px] p-6">
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
                          <Icon name="spinner" size={32} className="text-zinc-700 dark:text-zinc-300 mb-2 animate-spin" />
                          <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Restoring system data...</p>
                          <p className="text-[10px] text-gray-400 dark:text-gray-550 mt-0.5">Please do not refresh this page.</p>
                        </div>
                      ) : (
                        <>
                          <Icon name="upload-cloud" size={40} className="text-gray-400 mb-2" strokeWidth={1.5} />
                          <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Click or drag a backup file here</p>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">saimumfile-backup-*.tar.gz only</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Popups & Menus outside details box */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.isFolder ? getFolderContextItems(contextMenu.item) : getFileContextItems(contextMenu.item)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {previewFile && (
        <FilePreview
          file={previewFile}
          bucket={bucket}
          onClose={() => setPreviewFile(null)}
          onDownload={handleDownload}
        />
      )}

      {/* New Folder input modal */}
      {showFolderModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in" onClick={() => setShowFolderModal(false)}>
          <div className="bg-white dark:bg-[#2d2e30] border border-gray-200/50 dark:border-gray-700/50 rounded-2xl shadow-2xl p-6 w-80 animate-scale-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-1">New Folder</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Enter a folder name to create a directory</p>
            <form onSubmit={handleCreateFolder}>
              <input
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 bg-transparent text-gray-800 dark:text-gray-100 rounded-lg text-sm mb-4 focus:outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                placeholder="Folder name"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                autoFocus
                required
              />
              <div className="flex gap-2.5 justify-end">
                <button type="button" onClick={() => setShowFolderModal(false)} className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700/80 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors cursor-pointer">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-zinc-800 hover:bg-zinc-900 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white rounded-xl text-sm font-medium transition-colors cursor-pointer">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
