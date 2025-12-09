'use client'

import { KeyboardEvent, useState, useRef } from 'react'
import clsx from 'clsx'

export type TagInputProps = {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  disabled?: boolean
  suggestions?: string[]
  maxTags?: number
  className?: string
}

export function TagInput({
  tags,
  onChange,
  placeholder = 'タグを入力...',
  disabled = false,
  suggestions = [],
  maxTags = 10,
  className,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredSuggestions = suggestions.filter(
    (s) =>
      s.toLowerCase().includes(inputValue.toLowerCase()) &&
      !tags.includes(s) &&
      inputValue.length > 0
  )

  function addTag(tag: string) {
    const trimmed = tag.trim()
    if (!trimmed || tags.includes(trimmed) || tags.length >= maxTags) return
    onChange([...tags, trimmed])
    setInputValue('')
    setShowSuggestions(false)
  }

  function removeTag(index: number) {
    onChange(tags.filter((_, i) => i !== index))
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addTag(inputValue)
    } else if (event.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      removeTag(tags.length - 1)
    }
  }

  return (
    <div className={clsx('relative', className)}>
      <div
        className={clsx(
          'flex flex-wrap items-center gap-2 rounded-xl border bg-white p-2 transition-all',
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-text',
          'border-neutral-200 focus-within:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary/20'
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag, index) => (
          <span
            key={`${tag}-${index}`}
            className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-brand-primary/10 to-brand-secondary/10 px-3 py-1.5 text-sm font-medium text-brand-primaryDark"
          >
            <span>{tag}</span>
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removeTag(index)
                }}
                className="ml-0.5 rounded-full p-0.5 text-brand-primary/60 transition hover:bg-brand-primary/20 hover:text-brand-primary"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            setShowSuggestions(true)
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={tags.length === 0 ? placeholder : ''}
          disabled={disabled || tags.length >= maxTags}
          className="min-w-[120px] flex-1 border-none bg-transparent p-1 text-sm outline-none placeholder:text-neutral-400"
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-40 overflow-auto rounded-xl border border-neutral-200 bg-white shadow-lg">
          {filteredSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => addTag(suggestion)}
              className="block w-full px-4 py-2 text-left text-sm text-neutral-700 transition hover:bg-neutral-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Helper text */}
      <p className="mt-1.5 text-xs text-neutral-500">
        Enter または , で追加 ({tags.length}/{maxTags})
      </p>
    </div>
  )
}

export default TagInput
