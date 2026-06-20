import { useEffect, useRef } from 'react'
import Icon from './Icon'

export default function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    function handleEsc(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  const menuStyle = {
    position: 'fixed',
    left: Math.min(x, window.innerWidth - 220) + 'px',
    top: Math.min(y, window.innerHeight - items.length * 38 - 16) + 'px',
    zIndex: 9999,
  }

  return (
    <div
      ref={ref}
      style={menuStyle}
      className="bg-white dark:bg-[#2d2e30] rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1.5 min-w-[200px] animate-fade-in"
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, i) => (
        item.separator ? (
          <div key={i} className="h-px bg-gray-100 dark:bg-gray-800 my-1 mx-2" />
        ) : (
          <button
            key={i}
            onClick={() => { item.onClick(); onClose() }}
            className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors cursor-pointer ${
              item.danger ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10' : 'text-gray-700 dark:text-[#e3e3e3] hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            disabled={item.disabled}
          >

            {item.icon && <Icon name={item.icon} size={16} className="shrink-0" />}
            <span className="truncate">{item.label}</span>
            {item.shortcut && <span className="ml-auto text-xs text-gray-400">{item.shortcut}</span>}
          </button>
        )
      ))}
    </div>
  )
}
