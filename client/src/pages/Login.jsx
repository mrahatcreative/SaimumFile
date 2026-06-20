import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, isAuth } from '../api/client'
import { useTheme } from '../components/ThemeContext'

export default function Login() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const { theme, toggleTheme } = useTheme()

  if (isAuth()) {
    navigate('/', { replace: true })
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const d = await login(username, password)
    if (d.token) navigate('/', { replace: true })
    else setError(d.error || 'Invalid credentials')
  }

  return (
    <div className="min-h-screen bg-[#f8fafd] dark:bg-[#1B1B1B] flex items-center justify-center px-4 relative transition-colors duration-200">
      {/* Floating Theme toggle in top right corner */}
      <div className="absolute top-4 right-4">
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
      </div>

      <div className="w-full max-w-md animate-fade-in select-none">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-zinc-800 dark:bg-zinc-200 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-zinc-800/10">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-[#f2f2f2] tracking-tight" style={{ fontFamily: "'Product Sans', 'Google Sans', Arial" }}>SaimumFile</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1.5 font-medium">Log in to S3 Storage cloud manager</p>
        </div>

        <div className="bg-white dark:bg-[#131314] rounded-[24px] shadow-lg border border-gray-200/50 dark:border-gray-800/80 p-8 w-full">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <input
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 bg-transparent text-gray-800 dark:text-gray-100 rounded-xl text-sm focus:outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                placeholder="Username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="mb-4">
              <input
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 bg-transparent text-gray-800 dark:text-gray-100 rounded-xl text-sm focus:outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-red-500 dark:text-red-400 text-xs mb-4 font-medium flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              {error}
            </p>}
            <button
              type="submit"
              className="w-full py-3 bg-zinc-800 hover:bg-zinc-900 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white rounded-xl text-sm font-semibold transition-all shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-md hover:shadow-zinc-800/10 cursor-pointer"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
