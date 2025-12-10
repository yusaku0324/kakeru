'use client'

import Image, { type ImageProps } from 'next/image'
import { useCallback, useEffect, useState } from 'react'

const DEFAULT_PLACEHOLDER = '/images/placeholder-card.svg'

function isMeaningfulString(
  value: ImageProps['src'] | null | undefined,
): value is ImageProps['src'] {
  if (value == null) return false
  if (typeof value === 'string') {
    return value.trim().length > 0
  }
  return true
}

function sanitizeSrc(
  value: ImageProps['src'] | null | undefined,
  fallback?: ImageProps['src'] | null,
) {
  // Return value as-is if it's meaningful (including valid URLs)
  if (isMeaningfulString(value)) {
    return value
  }
  // Fall back if value is empty/invalid
  return fallback && isMeaningfulString(fallback) ? fallback : null
}

export type SafeImageProps = Omit<ImageProps, 'src'> & {
  src?: ImageProps['src'] | null
  fallbackSrc?: ImageProps['src'] | null
}

export function SafeImage({
  src,
  alt,
  fallbackSrc = DEFAULT_PLACEHOLDER,
  onError,
  ...rest
}: SafeImageProps) {
  const resolveInitial = useCallback(() => {
    const normalized = sanitizeSrc(src, fallbackSrc)
    if (isMeaningfulString(normalized)) return normalized
    if (isMeaningfulString(fallbackSrc)) return fallbackSrc
    return null
  }, [src, fallbackSrc])

  const [currentSrc, setCurrentSrc] = useState<ImageProps['src'] | null>(resolveInitial)

  useEffect(() => {
    setCurrentSrc(resolveInitial())
  }, [resolveInitial])

  if (!currentSrc) {
    return null
  }

  // R2ドメインの画像は unoptimized フラグを追加して Next.js の最適化を回避
  const isR2Domain = typeof currentSrc === 'string' && currentSrc.includes('.r2.dev')

  return (
    <Image
      {...rest}
      alt={alt}
      src={currentSrc}
      unoptimized={isR2Domain || rest.unoptimized}
      onError={(event) => {
        const fallback = isMeaningfulString(fallbackSrc) ? fallbackSrc : null
        if (fallback && currentSrc !== fallback) {
          setCurrentSrc(fallback)
        }
        onError?.(event)
      }}
    />
  )
}

export default SafeImage
