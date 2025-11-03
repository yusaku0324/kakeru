import { notFound } from 'next/navigation'
import TestFavoritesClient from './testFavoritesClient'

const isMockMode =
  (process.env.NEXT_PUBLIC_FAVORITES_API_MODE || process.env.FAVORITES_API_MODE || '')
    .toLowerCase()
    .includes('mock') || process.env.NODE_ENV !== 'production'

export default function TestFavoritesPage() {
  if (!isMockMode) {
    notFound()
  }
  return <TestFavoritesClient />
}
