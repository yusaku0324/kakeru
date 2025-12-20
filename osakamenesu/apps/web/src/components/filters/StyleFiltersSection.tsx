'use client'

import clsx from 'clsx'
import {
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent,
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

type RangeChangeHandler = (min: number, max: number) => void

type StyleFiltersSectionProps = {
  bustSizes: string[]
  bustMinIndex: number
  bustMaxIndex: number
  bustHighlightStyle: { left: string; right: string }
  onBustChange: RangeChangeHandler
  bustMinLimit: number
  bustMaxLimit: number
  ageMin: number
  ageMax: number
  ageHighlightStyle: { left: string; right: string }
  onAgeChange: RangeChangeHandler
  ageMinLimit: number
  ageMaxLimit: number
  heightMin: number
  heightMax: number
  heightHighlightStyle: { left: string; right: string }
  onHeightChange: RangeChangeHandler
  heightMinLimit: number
  heightMaxLimit: number
  onReset: () => void
  className?: string
  showHeader?: boolean
  showResetButton?: boolean
}

export function StyleFiltersSection({
  bustSizes,
  bustMinIndex,
  bustMaxIndex,
  bustHighlightStyle,
  onBustChange,
  bustMinLimit,
  bustMaxLimit,
  ageMin,
  ageMax,
  ageHighlightStyle,
  onAgeChange,
  ageMinLimit,
  ageMaxLimit,
  heightMin,
  heightMax,
  heightHighlightStyle,
  onHeightChange,
  heightMinLimit,
  heightMaxLimit,
  onReset,
  className,
  showHeader = true,
  showResetButton = true,
}: StyleFiltersSectionProps) {
  const wrapperClass = className
    ? className
    : 'relative overflow-visible rounded-[32px] border border-white/45 bg-white/45 p-6 shadow-[0_24px_70px_rgba(37,99,235,0.18)] backdrop-blur'
  return (
    <section className={wrapperClass}>
      {!className ? (
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(147,197,253,0.2)_0%,rgba(147,197,253,0)_60%)]" />
      ) : null}
      {showHeader ? (
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#fee2f2] text-[#ec4899] shadow-[0_12px_28px_rgba(236,72,153,0.25)]">
              ♡
            </span>
            <div>
              <p className="text-sm font-semibold text-neutral-text">外見・スタイル</p>
              <p className="text-xs text-neutral-textMuted">
                バストサイズ・年齢・身長の範囲を設定できます
              </p>
            </div>
          </div>
          {showResetButton ? (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 rounded-full border border-white/40 bg-white/50 px-3 py-1 text-xs font-semibold text-brand-primary shadow-[0_10px_24px_rgba(37,99,235,0.15)] transition hover:border-brand-primary hover:bg-brand-primary/10"
            >
              リセット
            </button>
          ) : null}
        </header>
      ) : showResetButton ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 rounded-full border border-white/40 bg-white/50 px-3 py-1 text-xs font-semibold text-brand-primary shadow-[0_10px_24px_rgba(37,99,235,0.15)] transition hover:border-brand-primary hover:bg-brand-primary/10"
          >
            リセット
          </button>
        </div>
      ) : null}

      <div className={clsx('space-y-8', showHeader ? 'mt-6' : 'mt-0')}>
        <div className="space-y-5 rounded-[32px] border border-white/55 bg-white/75 p-6 shadow-[0_22px_60px_rgba(37,99,235,0.2)]">
          <div className="flex items-center justify-between text-sm font-semibold text-neutral-text">
            <span>バストサイズ（カップ）</span>
            <span className="text-brand-primary">{`${bustSizes[bustMinIndex]} - ${bustSizes[bustMaxIndex]} カップ`}</span>
          </div>
          <div className="relative h-24 overflow-visible rounded-[28px] border border-brand-primary/25 bg-gradient-to-b from-white via-white/95 to-[#eef4ff] px-6 py-6 shadow-[0_18px_54px_rgba(59,130,246,0.24)]">
            <div className="pointer-events-none absolute inset-x-6 top-1/2 -translate-y-1/2">
              <div className="relative h-3 rounded-full bg-white/85 shadow-[0_12px_28px_rgba(37,99,235,0.18)]">
                <div
                  className="absolute inset-y-0 rounded-full bg-gradient-to-r from-[#3b82f6] via-[#2563eb] to-[#22d3ee] shadow-[0_0_32px_rgba(37,99,235,0.5)]"
                  style={{ left: bustHighlightStyle.left, right: bustHighlightStyle.right }}
                />
              </div>
            </div>
            <DualSlider
              min={bustMinLimit}
              max={bustMaxLimit}
              minValue={bustMinIndex}
              maxValue={bustMaxIndex}
              onChange={onBustChange}
              accentColor="#3b82f6"
              minLabel="バストサイズの下限"
              maxLabel="バストサイズの上限"
              trackInset={6}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-neutral-textMuted uppercase">
            <span>A カップ</span>
            <span>{`${bustSizes[bustMinIndex]} → ${bustSizes[bustMaxIndex]}`}</span>
            <span>Z カップ</span>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-5 rounded-[32px] border border-white/55 bg-gradient-to-b from-white via-white/96 to-[#fde7f4] p-6 shadow-[0_22px_60px_rgba(236,72,153,0.24)]">
            <div className="flex items-center justify-between text-sm font-semibold text-[#ec4899]">
              <span>年齢</span>
              <span>{`${ageMin}歳 - ${ageMax}歳`}</span>
            </div>
            <div className="relative h-24 overflow-visible rounded-[28px] border border-[#f472b6]/35 bg-gradient-to-b from-white via-[#fff5fb] to-[#fde2f4] px-6 py-6 shadow-[0_18px_54px_rgba(236,72,153,0.34)]">
              <div className="pointer-events-none absolute inset-x-6 top-1/2 -translate-y-1/2">
                <div className="relative h-3 rounded-full bg-white/85 shadow-[0_12px_28px_rgba(236,72,153,0.2)]">
                  <div
                    className="absolute inset-y-0 rounded-full bg-gradient-to-r from-[#f9a8d4] via-[#f472b6] to-[#ec4899] shadow-[0_0_32px_rgba(236,72,153,0.5)]"
                    style={{ left: ageHighlightStyle.left, right: ageHighlightStyle.right }}
                  />
                </div>
              </div>
              <DualSlider
                min={ageMinLimit}
                max={ageMaxLimit}
                minValue={ageMin}
                maxValue={ageMax}
                onChange={onAgeChange}
                accentColor="#ec4899"
                minLabel="年齢の下限"
                maxLabel="年齢の上限"
                trackInset={6}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#ec4899]">
              <span>最小 {ageMinLimit}歳</span>
              <span>最大 {ageMaxLimit}歳</span>
            </div>
          </div>

          <div className="space-y-5 rounded-[32px] border border-white/55 bg-gradient-to-b from-white via-white/96 to-[#dcfce7] p-6 shadow-[0_22px_60px_rgba(16,185,129,0.24)]">
            <div className="flex items-center justify-between text-sm font-semibold text-[#10b981]">
              <span>身長</span>
              <span>{`${heightMin}cm - ${heightMax}cm`}</span>
            </div>
            <div className="relative h-24 overflow-visible rounded-[28px] border border-[#34d399]/35 bg-gradient-to-b from-white via-[#f0fff7] to-[#dcfce7] px-6 py-6 shadow-[0_18px_54px_rgba(16,185,129,0.32)]">
              <div className="pointer-events-none absolute inset-x-6 top-1/2 -translate-y-1/2">
                <div className="relative h-3 rounded-full bg-white/85 shadow-[0_12px_28px_rgba(16,185,129,0.2)]">
                  <div
                    className="absolute inset-y-0 rounded-full bg-gradient-to-r from-[#34d399] via-[#10b981] to-[#059669] shadow-[0_0_32px_rgba(16,185,129,0.48)]"
                    style={{ left: heightHighlightStyle.left, right: heightHighlightStyle.right }}
                  />
                </div>
              </div>
              <DualSlider
                min={heightMinLimit}
                max={heightMaxLimit}
                minValue={heightMin}
                maxValue={heightMax}
                onChange={onHeightChange}
                accentColor="#10b981"
                minLabel="身長の下限"
                maxLabel="身長の上限"
                trackInset={6}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#10b981]">
              <span>最小 {heightMinLimit}cm</span>
              <span>最大 {heightMaxLimit}cm</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

type DualSliderProps = {
  min: number
  max: number
  step?: number
  minValue: number
  maxValue: number
  onChange: RangeChangeHandler
  accentColor: string
  minLabel: string
  maxLabel: string
  trackInset?: number
}

const clampPercent = (value: number) => Math.max(0, Math.min(100, value))
const percentStyle = (value: number) => `${clampPercent(value)}%`

const hexToRgba = (hex: string, alpha: number) => {
  const raw = hex.replace('#', '')
  const normalized =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw
  if (normalized.length !== 6) return `rgba(59,130,246,${alpha})`
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function DualSlider({
  min,
  max,
  step = 1,
  minValue,
  maxValue,
  onChange,
  accentColor,
  minLabel,
  maxLabel,
  trackInset,
}: DualSliderProps) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [activeIndex, setActiveIndex] = useState<0 | 1>(0)

  const clampValue = useCallback((value: number) => Math.min(Math.max(value, min), max), [min, max])

  const valueFromClientX = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect()
      if (!rect || rect.width <= 0) return null
      const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
      const raw = min + ratio * (max - min)
      const snapped = Math.round(raw / step) * step
      return clampValue(snapped)
    },
    [clampValue, max, min, step],
  )

  const handlePointer = (handle: 0 | 1) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    const value = valueFromClientX(event.clientX)
    if (value == null) return
    setActiveIndex(handle)
    if (handle === 0) {
      onChange(value, Math.max(value, maxValue))
    } else {
      onChange(Math.min(value, minValue), value)
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleMove = (handle: 0 | 1) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    const value = valueFromClientX(event.clientX)
    if (value == null) return
    if (handle === 0) {
      onChange(value, Math.max(value, maxValue))
    } else {
      onChange(Math.min(value, minValue), value)
    }
  }

  const handlePointerEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleKey = (handle: 0 | 1) => (event: KeyboardEvent<HTMLButtonElement>) => {
    let delta = 0
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') delta = step
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') delta = -step
    else if (event.key === 'Home') delta = handle === 0 ? min - minValue : min - maxValue
    else if (event.key === 'End') delta = handle === 0 ? max - minValue : max - maxValue
    if (delta === 0) return
    event.preventDefault()
    if (handle === 0) onChange(clampValue(minValue + delta), maxValue)
    else onChange(minValue, clampValue(maxValue + delta))
    setActiveIndex(handle)
  }

  const minPercent = percentStyle(((minValue - min) / (max - min)) * 100)
  const maxPercent = percentStyle(((maxValue - min) / (max - min)) * 100)

  const insetValue = typeof trackInset === 'number' ? `${trackInset}px` : '0'

  const baseHandleClass =
    'absolute top-1/2 -translate-y-1/2 translate-x-[-50%] touch-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'
  const knobClass = clsx(
    'relative flex h-11 w-11 sm:h-7 sm:w-7 items-center justify-center rounded-full border-[3px] bg-white text-[0] shadow-[0_12px_32px_rgba(37,99,235,0.35)] transition',
  )

  useEffect(() => {
    setActiveIndex((prev) => prev)
  }, [minValue, maxValue])

  const trackStyle: CSSProperties = {
    left: insetValue,
    right: insetValue,
    top: '50%',
    transform: 'translateY(-50%)',
  }

  return (
    <div ref={trackRef} className="absolute z-20" style={trackStyle}>
      <button
        type="button"
        role="slider"
        aria-valuemin={min}
        aria-valuemax={maxValue}
        aria-valuenow={minValue}
        aria-label={minLabel}
        className={clsx(baseHandleClass, 'focus-visible:outline-brand-primary/40')}
        style={{ left: minPercent, zIndex: activeIndex === 0 ? 30 : 20 }}
        onPointerDown={handlePointer(0)}
        onPointerMove={handleMove(0)}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onKeyDown={handleKey(0)}
      >
        <span
          className={knobClass}
          style={{
            borderColor: accentColor,
            boxShadow: `0 12px 32px ${hexToRgba(accentColor, 0.4)}, 0 0 0 6px ${hexToRgba(accentColor, 0.22)}`,
          }}
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: accentColor }} />
        </span>
      </button>
      <button
        type="button"
        role="slider"
        aria-valuemin={minValue}
        aria-valuemax={max}
        aria-valuenow={maxValue}
        aria-label={maxLabel}
        className={clsx(baseHandleClass, 'focus-visible:outline-brand-primary/40')}
        style={{ left: maxPercent, zIndex: activeIndex === 1 ? 30 : 20 }}
        onPointerDown={handlePointer(1)}
        onPointerMove={handleMove(1)}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onKeyDown={handleKey(1)}
      >
        <span
          className={knobClass}
          style={{
            borderColor: accentColor,
            boxShadow: `0 12px 32px ${hexToRgba(accentColor, 0.4)}, 0 0 0 6px ${hexToRgba(accentColor, 0.22)}`,
          }}
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: accentColor }} />
        </span>
      </button>
    </div>
  )
}
