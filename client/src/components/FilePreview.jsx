import { useState, useEffect } from 'react'
import { downloadFile } from '../api/client'
import FileIcon from './FileIcon'
import Icon from './Icon'

function fmtSize(bytes) {
  if (!bytes) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB']
  let i = 0, s = bytes
  while (s >= 1024 && i < u.length - 1) { s /= 1024; i++ }
  return s.toFixed(1) + ' ' + u[i]
}

export default function FilePreview({ file, bucket, onClose, onDownload }) {
  const [blobUrl, setBlobUrl] = useState(null)
  const [textContent, setTextContent] = useState('')
  const [loading, setLoading] = useState(false)

  const ext = file?.original_name?.split('.').pop()?.toLowerCase()
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext)
  const isVideo = ['mp4', 'webm', 'mov', 'avi'].includes(ext)
  const isAudio = ['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)
  const isPdf = ext === 'pdf'
  const isText = ['txt', 'md', 'json', 'xml', 'yaml', 'yml', 'csv', 'log', 'js', 'ts', 'jsx', 'tsx', 'py', 'html', 'css'].includes(ext)

  useEffect(() => {
    if (!file || !file.id) return
    if (!isImage && !isVideo && !isAudio && !isPdf && !isText) return

    if (file.size > 50 * 1024 * 1024) return

    setLoading(true)
    downloadFile(bucket, file.id).then(blob => {
      if (isText) {
        blob.text().then(txt => {
          setTextContent(txt)
          setLoading(false)
        }).catch(() => setLoading(false))
      } else {
        const url = URL.createObjectURL(blob)
        setBlobUrl(url)
        setLoading(false)
      }
    }).catch(() => setLoading(false))
  }, [file?.id])

  useEffect(() => {
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [blobUrl])

  if (!file) return null


  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#2d2e30] border border-transparent dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="h-14 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-5 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <FileIcon name={file.original_name} size={28} />
            <div className="min-w-0">
              <h2 className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{file.original_name}</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">{fmtSize(file.size)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onDownload(file.id)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-pointer" title="Download">
              <Icon name="download" size={20} />
            </button>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-pointer" title="Close">
              <Icon name="x" size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-gray-50 dark:bg-[#1e1e1f] flex items-center justify-center p-6 min-h-[300px]">
          {loading ? (
            <div className="text-center">
              <Icon name="spinner" size={32} className="text-zinc-700 dark:text-zinc-300 animate-spin mx-auto" />
              <p className="text-sm text-gray-400 dark:text-gray-550 mt-2">Loading preview...</p>
            </div>
          ) : blobUrl && isImage ? (
            <img src={blobUrl} alt={file.original_name} className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-sm" />
          ) : blobUrl && isVideo ? (
            <video src={blobUrl} controls className="max-w-full max-h-[70vh] rounded-lg" />
          ) : blobUrl && isAudio ? (
            <div className="text-center p-12">
              <div className="w-24 h-24 bg-zinc-100 dark:bg-zinc-800/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icon name="music" size={48} className="text-zinc-700 dark:text-zinc-300" />
              </div>
              <audio src={blobUrl} controls className="w-full max-w-sm" />
            </div>
          ) : isText ? (
            <pre className="w-full h-full bg-white dark:bg-[#2d2e30] rounded-lg p-4 overflow-auto text-sm font-mono text-gray-750 dark:text-gray-300 border border-gray-200 dark:border-gray-800 whitespace-pre-wrap">{textContent}</pre>

          ) : (
            <div className="text-center">
              <FileIcon name={file.original_name} size={96} />
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-4">Preview not available</p>
              <button onClick={() => onDownload(file.id)} className="mt-3 px-5 py-2 bg-zinc-800 hover:bg-zinc-900 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white rounded-xl text-sm font-medium transition-colors cursor-pointer">Download</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
