import { useState, useRef, useEffect } from 'react'

interface DropdownOption {
  value: string
  label: string
}

interface DropdownProps {
  value: string
  options: DropdownOption[]
  placeholder?: string
  disabled?: boolean
  onChange: (value: string) => void
}

export function Dropdown({ value, options, placeholder = '선택', disabled, onChange }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
          open
            ? 'border-amber-500 ring-1 ring-amber-500'
            : 'border-amber-200 dark:border-gray-600'
        } bg-white disabled:opacity-40 dark:bg-gray-700 dark:text-gray-200`}
      >
        <span className={selected ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}>
          {selected?.label ?? placeholder}
        </span>
        <svg className={`h-4 w-4 text-gray-400 transition ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && !disabled && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-amber-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-700">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`flex w-full items-center px-3 py-2 text-left text-sm transition ${
                opt.value === value
                  ? 'bg-amber-100 font-medium text-amber-900 dark:bg-amber-900/30 dark:text-amber-200'
                  : 'text-gray-700 hover:bg-amber-50 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
