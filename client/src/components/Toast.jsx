import { useEffect } from 'react'

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
      {type === 'success' && (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      )}
      {type === 'error' && (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      )}
      {msg}
    </div>
  )
}
