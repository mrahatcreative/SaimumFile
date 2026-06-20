import { useState, useRef } from 'react'
import Icon from './Icon'

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
      <Icon name="search" size={20} className="mr-3 shrink-0 opacity-70" />
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
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  )
}
