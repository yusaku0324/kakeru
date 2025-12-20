'use client'

import clsx from 'clsx'

import {
  DEFAULT_TAG,
  HAIR_COLOR_OPTIONS,
  HAIR_STYLE_OPTIONS,
  BODY_TYPE_OPTIONS,
} from './searchFiltersConstants'

const tagClass = (active: boolean) =>
  clsx(
    'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold transition',
    active
      ? 'border-brand-primary bg-brand-primary/15 text-brand-primary shadow-[0_10px_24px_rgba(37,99,235,0.22)]'
      : 'border-white/55 bg-white/55 text-neutral-text hover:border-brand-primary/40',
  )

type Props = {
  hairColor: string
  onHairColorChange: (value: string) => void
  hairStyle: string
  onHairStyleChange: (value: string) => void
  bodyShape: string
  onBodyShapeChange: (value: string) => void
  className?: string
}

export function StyleTagsSection({
  hairColor,
  onHairColorChange,
  hairStyle,
  onHairStyleChange,
  bodyShape,
  onBodyShapeChange,
  className,
}: Props) {
  return (
    <div className={clsx('space-y-4 text-sm', className)}>
      {/* Hair Color */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-text">髪色</span>
          {hairColor !== DEFAULT_TAG && (
            <button
              type="button"
              onClick={() => onHairColorChange(DEFAULT_TAG)}
              className="text-xs text-brand-primary hover:underline"
            >
              クリア
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {HAIR_COLOR_OPTIONS.map((option) => (
            <button
              key={`hair-color-${option}`}
              type="button"
              onClick={() => onHairColorChange(option)}
              className={tagClass(hairColor === option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {/* Hair Style */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-text">髪型</span>
          {hairStyle !== DEFAULT_TAG && (
            <button
              type="button"
              onClick={() => onHairStyleChange(DEFAULT_TAG)}
              className="text-xs text-brand-primary hover:underline"
            >
              クリア
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {HAIR_STYLE_OPTIONS.map((option) => (
            <button
              key={`hair-style-${option}`}
              type="button"
              onClick={() => onHairStyleChange(option)}
              className={tagClass(hairStyle === option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {/* Body Shape */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-text">体型</span>
          {bodyShape !== DEFAULT_TAG && (
            <button
              type="button"
              onClick={() => onBodyShapeChange(DEFAULT_TAG)}
              className="text-xs text-brand-primary hover:underline"
            >
              クリア
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {BODY_TYPE_OPTIONS.map((option) => (
            <button
              key={`body-shape-${option}`}
              type="button"
              onClick={() => onBodyShapeChange(option)}
              className={tagClass(bodyShape === option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
