'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface OptimizedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  priority?: boolean
  className?: string
  sizes?: string
  quality?: number
  placeholder?: 'blur' | 'empty'
  blurDataURL?: string
  onLoad?: () => void
  aspectRatio?: number
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'
}

/**
 * Optimized image component with:
 * - Lazy loading with intersection observer
 * - Blur placeholder support
 * - Responsive sizing
 * - WebP/AVIF format support
 * - Loading state
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  priority = false,
  className,
  sizes,
  quality = 75,
  placeholder = 'blur',
  blurDataURL,
  onLoad,
  aspectRatio,
  objectFit = 'cover',
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isInView, setIsInView] = useState(false)
  const [error, setError] = useState(false)
  const imageRef = useRef<HTMLDivElement>(null)

  // Use intersection observer for lazy loading
  useEffect(() => {
    if (priority || !imageRef.current) {
      setIsInView(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true)
            observer.disconnect()
          }
        })
      },
      {
        rootMargin: '50px', // Start loading 50px before entering viewport
      }
    )

    observer.observe(imageRef.current)

    return () => observer.disconnect()
  }, [priority])

  // Generate blur placeholder if not provided
  const defaultBlurDataURL = `data:image/svg+xml;base64,${Buffer.from(
    `<svg width="${width || 100}" height="${height || 100}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f3f4f6"/>
    </svg>`
  ).toString('base64')}`

  // Calculate dimensions based on aspect ratio
  const calculatedHeight = aspectRatio && width ? Math.round(width / aspectRatio) : height
  const calculatedWidth = aspectRatio && height ? Math.round(height * aspectRatio) : width

  // Default sizes for responsive images
  const defaultSizes = sizes || `
    (max-width: 640px) 100vw,
    (max-width: 1024px) 50vw,
    33vw
  `

  return (
    <div
      ref={imageRef}
      className={cn(
        'relative overflow-hidden bg-gray-100',
        isLoading && 'animate-pulse',
        className
      )}
      style={{
        aspectRatio: aspectRatio,
        width: calculatedWidth || '100%',
        height: calculatedHeight || '100%',
      }}
    >
      {isInView && !error && (
        <Image
          src={src}
          alt={alt}
          width={calculatedWidth || 100}
          height={calculatedHeight || 100}
          sizes={defaultSizes}
          quality={quality}
          priority={priority}
          placeholder={placeholder}
          blurDataURL={blurDataURL || defaultBlurDataURL}
          onLoadingComplete={() => {
            setIsLoading(false)
            onLoad?.()
          }}
          onError={() => {
            setError(true)
            setIsLoading(false)
          }}
          style={{
            objectFit,
          }}
          className={cn(
            'transition-opacity duration-300',
            isLoading ? 'opacity-0' : 'opacity-100'
          )}
        />
      )}

      {/* Loading skeleton */}
      {isLoading && !error && (
        <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 animate-shimmer" />
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-500">画像を読み込めません</p>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Image gallery component with optimizations
 */
export function OptimizedImageGallery({
  images,
  className,
}: {
  images: Array<{ src: string; alt: string }>
  className?: string
}) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  return (
    <div className={cn('space-y-4', className)}>
      {/* Main image */}
      <div className="relative aspect-[4/3] w-full">
        <OptimizedImage
          src={images[selectedIndex].src}
          alt={images[selectedIndex].alt}
          sizes="(max-width: 768px) 100vw, 50vw"
          aspectRatio={4 / 3}
          priority
        />
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
          {images.map((image, index) => (
            <button
              key={image.src}
              onClick={() => setSelectedIndex(index)}
              className={cn(
                'relative aspect-square overflow-hidden rounded-md',
                selectedIndex === index && 'ring-2 ring-primary'
              )}
            >
              <OptimizedImage
                src={image.src}
                alt={image.alt}
                sizes="(max-width: 768px) 25vw, 10vw"
                aspectRatio={1}
                quality={50} // Lower quality for thumbnails
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Add shimmer animation to Tailwind
const shimmerStyles = `
  @keyframes shimmer {
    0% {
      background-position: -1000px 0;
    }
    100% {
      background-position: 1000px 0;
    }
  }

  .animate-shimmer {
    animation: shimmer 2s ease-in-out infinite;
    background-size: 1000px 100%;
  }
`

if (typeof window !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = shimmerStyles
  document.head.appendChild(style)
}