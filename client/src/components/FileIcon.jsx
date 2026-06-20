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
        <svg viewBox="0 0 24 24" className={`w-3/5 h-3/5 ${fg} fill-current`} stroke="none">
          <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
        </svg>
      </div>
    )
  }

  return (
    <div className={`flex items-center justify-center rounded-xl shrink-0 ${bg}`} style={{ width: s, height: s }}>
      <svg viewBox="0 0 24 24" className={`w-3/5 h-3/5 ${fg} fill-current`} stroke="none">
        <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
      </svg>
    </div>
  )
}
