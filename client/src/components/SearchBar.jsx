import { useState, useRef } from 'react'

export default function SearchBar({ onSearch }) {
  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef(null)

  function handleChange(val) {
    setQuery(val)
    onSearch(val)
  }

  function handleClear() {
    setQuery('')
    onSearch('')
    inputRef.current?.focus()
  }

  return (
    <div
      className={`flex items-center w-full h-12 px-4 rounded-full transition-all duration-150 ${
        isFocused
          ? 'bg-white dark:bg-[#282a2c] shadow-[0_1px_3px_0_rgba(60,64,67,0.3),0_4px_8px_3px_rgba(60,64,67,0.15)] text-gray-800 dark:text-gray-200'
          : 'bg-[#eaf1fb] dark:bg-[#1e1e20] hover:bg-[#dfe6f2] dark:hover:bg-[#28292c] text-gray-600 dark:text-[#c4c7c5]'
      }`}
    >
      <svg className="w-5 h-5 mr-3 shrink-0 opacity-70" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder="Search files and folders..."
        className="bg-transparent border-none outline-none text-sm w-full h-full text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400"
      />
      {query && (
        <button
          onClick={handleClear}
          className="p-1 rounded-full hover:bg-gray-300/50 dark:hover:bg-gray-700/50 text-gray-500 dark:text-gray-400 cursor-pointer transition-colors"
          title="Clear search"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
