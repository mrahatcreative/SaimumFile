import { useEffect } from 'react'
import Icon from './Icon'

export default function Toast({ msg, type = '', onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [])

  const colors = type === 'error' ? 'border-red-400 bg-red-50 text-red-700' :
    type === 'success' ? 'border-green-400 bg-green-50 text-green-700' :
    'border-slate-300 bg-slate-800 text-white'

  return (
    <div className={`fixed bottom-6 right-6 border ${colors} px-4 py-2.5 rounded-xl text-sm shadow-lg z-50 animate-slide-up flex items-center gap-2.5`}>
      {type === 'success' && <Icon name="check" size={16} className="shrink-0" />}
      {type === 'error' && <Icon name="alert-circle" size={16} className="shrink-0" />}
      {msg}
    </div>
  )
}
