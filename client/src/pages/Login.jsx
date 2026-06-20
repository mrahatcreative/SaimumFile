import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, isAuth } from '../api/client'
import { useTheme } from '../components/ThemeContext'
import Icon from '../components/Icon'

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
          {theme === 'dark' ? <Icon name="sun" size={20} /> : <Icon name="moon" size={20} />}
        </button>
      </div>

      <div className="w-full max-w-md animate-fade-in select-none">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-zinc-800 dark:bg-zinc-200 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-zinc-800/10">
            <Icon name="folder" size={28} className="text-white" />
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
              <Icon name="alert-triangle" size={14} strokeWidth={2.5} />
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
