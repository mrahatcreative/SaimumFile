import FileIcon from './FileIcon'
import Icon from './Icon'

function fmtSize(bytes) {
  if (!bytes) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB']
  let i = 0, s = bytes
  while (s >= 1024 && i < u.length - 1) { s /= 1024; i++ }
  return s.toFixed(1) + ' ' + u[i]
}

function fmtFullDate(d) {
  if (!d) return ''
  return new Date(d + 'Z').toLocaleString([], { dateStyle: 'long', timeStyle: 'short' })
}

export default function DetailsPanel({ file, folder, onClose, onDownload, onRename, onDelete }) {
  if (!file && !folder) return null

  return (
    <div className="w-72 border-l border-gray-100 dark:border-gray-800 bg-white dark:bg-[#131314] flex flex-col shrink-0 animate-slide-left">
      <div className="h-14 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-4 shrink-0">
        <h3 className="text-sm font-medium text-gray-700 dark:text-[#e3e3e3]">Details</h3>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-pointer">
          <Icon name="x" size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {folder ? (
          <div className="p-6 text-center">
            <div className="inline-block mb-3">
              <FileIcon name={folder.name} isFolder size={72} />
            </div>
            <h2 className="text-sm font-medium text-gray-800 dark:text-gray-200 break-words">{folder.name}</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Folder</p>
            {folder.created_at && (
              <div className="mt-4 text-left border-t border-gray-100 dark:border-gray-800 pt-4">
                <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Info</p>
                <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
                  <div className="flex justify-between"><span className="text-gray-400 dark:text-gray-500">Created</span><span>{fmtFullDate(folder.created_at)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400 dark:text-gray-500">Path</span><span className="truncate ml-2 max-w-[140px] text-gray-700 dark:text-gray-300" title={folder.path}>{folder.path}</span></div>
                </div>
              </div>
            )}
          </div>
        ) : file ? (
          <div className="p-6 text-center">
            <div className="inline-block mb-3">
              <FileIcon name={file.original_name} size={72} />
            </div>
            <h2 className="text-sm font-medium text-gray-800 dark:text-gray-200 break-words">{file.original_name}</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{fmtSize(file.size)}</p>

            <div className="mt-4 text-left border-t border-gray-100 dark:border-gray-800 pt-4">
              <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Info</p>
              <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
                <div className="flex justify-between"><span className="text-gray-400 dark:text-gray-500">Size</span><span>{fmtSize(file.size)}</span></div>
                <div className="flex justify-between"><span className="text-gray-400 dark:text-gray-500">Type</span><span className="truncate max-w-[120px]">{file.mime_type || 'Unknown'}</span></div>
                <div className="flex justify-between"><span className="text-gray-400 dark:text-gray-500">Created</span><span>{fmtFullDate(file.created_at)}</span></div>
                {file.folder && <div className="flex justify-between"><span className="text-gray-400 dark:text-gray-500">Location</span><span className="truncate ml-2 max-w-[140px] text-gray-700 dark:text-gray-300" title={file.folder}>{file.folder}</span></div>}
              </div>
            </div>

            <div className="mt-4 text-left border-t border-gray-100 dark:border-gray-800 pt-4">
              <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Actions</p>
              <div className="space-y-1">
                <button onClick={() => onDownload(file.id)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer">
                  <Icon name="download" size={16} />
                  Download
                </button>
                <button onClick={() => onRename(file)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer">
                  <Icon name="pencil" size={16} />
                  Rename
                </button>
                <button onClick={() => onDelete(file.id)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer">
                  <Icon name="trash" size={16} />
                  Delete
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )

}
