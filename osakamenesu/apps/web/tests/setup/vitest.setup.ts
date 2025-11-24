import '@testing-library/jest-dom/vitest'
import React from 'react'
import { vi } from 'vitest'

vi.mock('next/image', () => {
  return {
    __esModule: true,
    default: React.forwardRef<HTMLImageElement, React.ComponentProps<'img'>>((props, ref) => {
      return React.createElement('img', { ...props, ref })
    }),
  }
})
