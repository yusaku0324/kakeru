import Image from 'next/image'
import { OptimizedImage } from '../ui/optimized-image'

interface SeoImageProps {
  src: string
  alt: string
  title?: string
  width?: number
  height?: number
  priority?: boolean
  className?: string
  sizes?: string
  loading?: 'lazy' | 'eager'
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'
  useLazyLoading?: boolean
}

/**
 * SEO-optimized image component
 *
 * Features:
 * - Automatic alt text optimization
 * - Title attribute for better accessibility
 * - Lazy loading with intersection observer
 * - Structured data support
 */
export default function SeoImage({
  src,
  alt,
  title,
  width,
  height,
  priority = false,
  className,
  sizes,
  loading = 'lazy',
  objectFit = 'cover',
  useLazyLoading = true,
}: SeoImageProps) {
  // Optimize alt text for SEO
  const optimizedAlt = optimizeAltText(alt)

  // Generate title if not provided
  const imageTitle = title || optimizedAlt

  // Use OptimizedImage for lazy loading
  if (useLazyLoading && !priority) {
    return (
      <OptimizedImage
        src={src}
        alt={optimizedAlt}
        width={width}
        height={height}
        className={className}
        sizes={sizes}
        objectFit={objectFit}
      />
    )
  }

  // Use Next.js Image for priority images
  return (
    <Image
      src={src}
      alt={optimizedAlt}
      title={imageTitle}
      width={width || 800}
      height={height || 600}
      priority={priority}
      className={className}
      sizes={sizes}
      loading={priority ? 'eager' : loading}
      style={{ objectFit }}
    />
  )
}

/**
 * Optimize alt text for SEO and accessibility
 */
function optimizeAltText(alt: string): string {
  if (!alt) return ''

  // Remove file extensions and underscores
  let optimized = alt
    .replace(/\.(jpg|jpeg|png|gif|webp|avif)$/i, '')
    .replace(/_/g, ' ')

  // Capitalize first letter of each word
  optimized = optimized
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')

  // Ensure it's descriptive but not too long
  if (optimized.length > 125) {
    optimized = optimized.substring(0, 122) + '...'
  }

  return optimized
}

/**
 * Generate structured data for images
 */
export function generateImageObject(image: {
  url: string
  alt: string
  width?: number
  height?: number
  caption?: string
}) {
  return {
    '@type': 'ImageObject',
    url: image.url,
    caption: image.caption || image.alt,
    width: image.width,
    height: image.height,
  }
}