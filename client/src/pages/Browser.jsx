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
  { id: 'drive', label: 'My Files', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
  { id: 'settings', label: 'Bucket Settings', icon: 'M9.592 2.23a1.66 1.66 0 0 1 2.816 0l.235.39a1.66 1.66 0 0 0 1.956.764l.435-.145a1.66 1.66 0 0 1 2.054 1.926l-.08.45a1.66 1.66 0 0 0 1.12 1.833l.427.143a1.66 1.66 0 0 1 .986 2.63l-.286.353a1.66 1.66 0 0 0-.25 2.115l.25.353a1.66 1.66 0 0 1-.986 2.63l-.427.143a1.66 1.66 0 0 0-1.12 1.833l.08.45a1.66 1.66 0 0 1-2.054 1.926l-.435-.145a1.66 1.66 0 0 0-1.956.764l-.235.39a1.66 1.66 0 0 1-2.816 0l-.235-.39a1.66 1.66 0 0 0-1.956-.764l-.435.145a1.66 1.66 0 0 1-2.054-1.926l.08-.45a1.66 1.66 0 0 0-1.12-1.833l-.427-.143a1.66 1.66 0 0 1-.986-2.63l.286-.353a1.66 1.66 0 0 0 .25-2.115l-.25-.353a1.66 1.66 0 0 1 .986-2.63l.427-.143a1.66 1.66 0 0 0 1.12-1.833l-.08-.45a1.66 1.66 0 0 1 2.054-1.926l.435.145a1.66 1.66 0 0 0 1.956-.764l.235-.39ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z' },
  { id: 'backup', label: 'Backup & Restore', icon: 'M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z' }
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
      { label: 'Preview', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z', onClick: () => setPreviewFile(f) },
      { label: 'Download', icon: 'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', onClick: () => handleDownload(f.id) },
      { label: 'Rename', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z', onClick: () => { setRenameTarget(f); setRenameValue(f.original_name) } },
      { label: 'Details', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', onClick: () => handleDetailsClick(f) },
      { separator: true },
      { label: 'Delete', icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16', danger: true, onClick: () => handleDelete(f.id) },
    ]
  }

  function getFolderContextItems(f) {
    return [
      { label: 'Open', icon: 'M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z', onClick: () => setFolderPath(f.path) },
      { label: 'Details', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', onClick: () => handleDetailsClick(f, true) },
      { separator: true },
      { label: 'Delete', icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16', danger: true, onClick: () => handleFolderDelete(f.path) },
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
              <svg className="w-5 h-5 text-white dark:text-zinc-900" viewBox="0 0 24 24" fill="currentColor"><path d="M14 10H4v2h10v-2zm0-4H4v2h10V6zM4 16h6v-2H4v2zm18-4v6l-4-4 4-4zm-2-6h-8v2h8V6zm-8 12h8v-2h-8v2z"/></svg>
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
            onClick={() => navigate(`/b/${bucket}?tab=settings`)}
            className="p-2.5 rounded-full hover:bg-gray-200/60 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-pointer transition-colors"
            title="Bucket S3 Settings / Credentials"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          <button
            onClick={() => navigate('/')}
            className="p-2.5 rounded-full hover:bg-gray-200/60 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-pointer transition-colors"
            title="Go to Buckets Dashboard"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
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
                <svg className="w-5 h-5 text-gray-700 dark:text-[#e3e3e3]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New
              </button>

              {showNewMenu && (
                <div className="absolute left-4 top-14 mt-1 bg-white dark:bg-[#2d2e30] border border-gray-200/60 dark:border-gray-700 rounded-xl shadow-xl py-1.5 w-48 z-40 animate-scale-in">
                  <button
                    onClick={() => { setShowNewMenu(false); setShowFolderModal(true) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-[#e3e3e3] hover:bg-gray-100 dark:hover:bg-gray-800 text-left cursor-pointer"
                  >
                    <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m-5 4h10a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    New Folder
                  </button>
                  <button
                    onClick={() => { setShowNewMenu(false); fileInput.current?.click() }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-[#e3e3e3] hover:bg-gray-100 dark:hover:bg-gray-800 text-left cursor-pointer"
                  >
                    <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
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
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
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
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
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
                <svg className="w-12 h-12 text-zinc-800 dark:text-zinc-300 mx-auto mb-3 animate-bounce" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
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
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
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
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
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
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                  </div>

                  <button onClick={() => setShowDetails(!showDetails)} className={`p-2 rounded-full ${showDetails ? 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-200' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400'} cursor-pointer transition-colors`} title="Details Panel">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </button>
                </div>
              </header>

              <div className="h-12 border-b border-gray-100 dark:border-gray-800/80 flex items-center px-6 gap-2 bg-[#fbfcfd] dark:bg-[#131314] shrink-0 overflow-x-auto scrollbar-none">
                <button
                  onClick={goUp}
                  className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                  Back Up
                </button>

                <button
                  onClick={() => setShowFolderModal(true)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
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
                          <svg className="w-16 h-16 text-gray-300 dark:text-gray-650 mx-auto mb-4" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                          <p className="text-gray-400 dark:text-gray-500 text-sm">No items matching "{searchQuery}"</p>
                        </>
                      ) : (
                        <>
                          <svg className="w-20 h-20 text-gray-200 dark:text-gray-800 mx-auto mb-4" fill="none" stroke="currentColor" strokeWidth={0.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
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
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                                </svg>
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
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                                  </svg>
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
                                <svg className="w-4 h-4 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                                </svg>
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
                                <svg className="w-4 h-4 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                                </svg>
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
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Delete Bucket and All Files
                    </button>
                  </div>
                </div>
              ) : (
                <div className="max-w-2xl space-y-4 animate-fade-in">
                  <p className="text-xs text-zinc-700 bg-zinc-100 dark:bg-zinc-800/30 dark:text-zinc-300 border border-zinc-200/50 dark:border-zinc-800/50 rounded-xl p-4 flex items-center gap-2.5">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
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
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      </button>
                    </div>
                  ))}

                  <div className="flex gap-4 items-center pt-2">
                    <button
                      onClick={handleRegenerateKeys}
                      className="px-5 py-2.5 bg-red-500/10 hover:bg-red-500/25 text-red-650 dark:text-red-400 rounded-xl text-xs font-semibold cursor-pointer border border-red-250/20 dark:border-red-900/30 transition-all flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
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
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
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
                    {backupLoading ? (
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                    )}
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
                          <svg className="animate-spin h-8 w-8 text-zinc-700 dark:text-zinc-300 mb-2" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                          <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Restoring system data...</p>
                          <p className="text-[10px] text-gray-400 dark:text-gray-550 mt-0.5">Please do not refresh this page.</p>
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
