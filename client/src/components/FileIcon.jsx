const TYPE_MAP = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tiff', 'tif'],
  video: ['mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'webm', 'm4v'],
  audio: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'wma', 'm4a'],
  pdf: ['pdf'],
  word: ['doc', 'docx'],
  excel: ['xls', 'xlsx', 'csv'],
  powerpoint: ['ppt', 'pptx'],
  archive: ['zip', 'rar', 'tar', 'gz', '7z', 'bz2'],
  code: ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'html', 'css', 'json', 'xml', 'yaml', 'yml', 'sh', 'bash'],
  text: ['txt', 'md', 'log'],
}

function getType(name) {
  const ext = name?.split('.').pop()?.toLowerCase()
  if (!ext) return 'generic'
  for (const [type, exts] of Object.entries(TYPE_MAP)) {
    if (exts.includes(ext)) return type
  }
  return 'generic'
}

const COLORS = {
  folder: { bg: 'bg-gray-100 dark:bg-[#2a2b2e]', fg: 'text-[#5f6368] dark:text-[#c4c7c5]' },
  image: { bg: 'bg-[#e8f0fe] dark:bg-[#1c2b42]', fg: 'text-[#1a73e8] dark:text-[#a8c7fa]' },
  video: { bg: 'bg-[#fce8e6] dark:bg-[#442726]', fg: 'text-[#c5221f] dark:text-[#f28b82]' },
  audio: { bg: 'bg-[#f3e8fd] dark:bg-[#351c4a]', fg: 'text-[#8ab4f8] dark:text-[#d7aefb]' },
  pdf: { bg: 'bg-[#fce8e6] dark:bg-[#442726]', fg: 'text-[#c5221f] dark:text-[#f28b82]' },
  word: { bg: 'bg-[#e8f0fe] dark:bg-[#1c2b42]', fg: 'text-[#1a73e8] dark:text-[#a8c7fa]' },
  excel: { bg: 'bg-[#e6f4ea] dark:bg-[#18392b]', fg: 'text-[#137333] dark:text-[#81c995]' },
  powerpoint: { bg: 'bg-[#fef7e0] dark:bg-[#4a3410]', fg: 'text-[#b06000] dark:text-[#fdd663]' },
  archive: { bg: 'bg-[#fef7e0] dark:bg-[#4a3410]', fg: 'text-[#b06000] dark:text-[#fdd663]' },
  code: { bg: 'bg-[#f1f3f4] dark:bg-[#2a2b2e]', fg: 'text-[#5f6368] dark:text-[#c4c7c5]' },
  text: { bg: 'bg-[#f1f3f4] dark:bg-[#2a2b2e]', fg: 'text-[#5f6368] dark:text-[#c4c7c5]' },
  generic: { bg: 'bg-[#f1f3f4] dark:bg-[#2a2b2e]', fg: 'text-[#5f6368] dark:text-[#c4c7c5]' },
}

export default function FileIcon({ name, size = 40, isFolder = false }) {
  const type = isFolder ? 'folder' : getType(name)
  const { bg, fg } = COLORS[type] || COLORS.generic
  const s = typeof size === 'number' ? size + 'px' : size

  if (isFolder) {
    return (
      <div className={`flex items-center justify-center rounded-xl shrink-0 ${bg}`} style={{ width: s, height: s }}>
        <svg viewBox="0 0 24 24" className={`w-3/5 h-3/5 ${fg}`} fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
        </svg>
      </div>
    )
  }

  return (
    <div className={`flex items-center justify-center rounded-xl shrink-0 ${bg}`} style={{ width: s, height: s }}>
      <svg viewBox="0 0 24 24" className={`w-3/5 h-3/5 ${fg}`} fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    </div>
  )
}
