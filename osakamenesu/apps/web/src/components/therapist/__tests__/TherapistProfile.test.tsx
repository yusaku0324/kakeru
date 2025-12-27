/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import TherapistProfile from '../TherapistProfile'

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />
  ),
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  User: () => <span data-testid="user-icon">User</span>,
  Sparkles: () => <span data-testid="sparkles-icon">Sparkles</span>,
  Heart: () => <span data-testid="heart-icon">Heart</span>,
  Calendar: () => <span data-testid="calendar-icon">Calendar</span>,
  DollarSign: () => <span data-testid="dollar-icon">Dollar</span>,
}))

// Mock Badge component
vi.mock('@/components/ui/Badge', () => ({
  Badge: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <span data-testid="badge" data-variant={variant}>
      {children}
    </span>
  ),
}))

// Mock Card component
vi.mock('@/components/ui/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card">{children}</div>
  ),
}))

describe('TherapistProfile', () => {
  const defaultTherapist = {
    id: 'therapist-123',
    name: '山田花子',
  }

  describe('rendering', () => {
    it('renders therapist name', () => {
      render(<TherapistProfile therapist={defaultTherapist} />)
      expect(screen.getByText('山田花子')).toBeInTheDocument()
    })

    it('renders in a Card component', () => {
      render(<TherapistProfile therapist={defaultTherapist} />)
      expect(screen.getByTestId('card')).toBeInTheDocument()
    })

    it('renders placeholder when no photo', () => {
      render(<TherapistProfile therapist={defaultTherapist} />)
      expect(screen.getByTestId('user-icon')).toBeInTheDocument()
    })
  })

  describe('photo display', () => {
    it('renders main photo when provided', () => {
      const therapist = {
        ...defaultTherapist,
        photos: ['/photo1.jpg'],
      }
      render(<TherapistProfile therapist={therapist} />)

      const img = screen.getByRole('img', { name: '山田花子' })
      expect(img).toHaveAttribute('src', '/photo1.jpg')
    })

    it('renders additional photos section', () => {
      const therapist = {
        ...defaultTherapist,
        photos: ['/photo1.jpg', '/photo2.jpg', '/photo3.jpg'],
      }
      render(<TherapistProfile therapist={therapist} />)

      expect(screen.getByText('その他の写真')).toBeInTheDocument()
      expect(screen.getByRole('img', { name: '山田花子 2' })).toBeInTheDocument()
      expect(screen.getByRole('img', { name: '山田花子 3' })).toBeInTheDocument()
    })

    it('does not render additional photos section with single photo', () => {
      const therapist = {
        ...defaultTherapist,
        photos: ['/photo1.jpg'],
      }
      render(<TherapistProfile therapist={therapist} />)

      expect(screen.queryByText('その他の写真')).not.toBeInTheDocument()
    })
  })

  describe('basic info display', () => {
    it('renders age when provided', () => {
      const therapist = {
        ...defaultTherapist,
        age: 25,
      }
      render(<TherapistProfile therapist={therapist} />)

      expect(screen.getByText('25歳')).toBeInTheDocument()
      expect(screen.getByTestId('calendar-icon')).toBeInTheDocument()
    })

    it('renders price rank as yen symbols', () => {
      const therapist = {
        ...defaultTherapist,
        price_rank: 3,
      }
      render(<TherapistProfile therapist={therapist} />)

      expect(screen.getByText('¥¥¥')).toBeInTheDocument()
      expect(screen.getByTestId('dollar-icon')).toBeInTheDocument()
    })

    it('renders badges with correct variants', () => {
      const therapist = {
        ...defaultTherapist,
        badges: ['新人', '人気No.1', 'おすすめ'],
      }
      render(<TherapistProfile therapist={therapist} />)

      const badges = screen.getAllByTestId('badge')
      // 新人 -> success, 人気 -> brand, おすすめ -> neutral
      expect(badges[0]).toHaveAttribute('data-variant', 'success')
      expect(badges[1]).toHaveAttribute('data-variant', 'brand')
      expect(badges[2]).toHaveAttribute('data-variant', 'neutral')
    })
  })

  describe('tags display', () => {
    it('renders mood tag', () => {
      const therapist = {
        ...defaultTherapist,
        tags: { mood: '明るい' },
      }
      render(<TherapistProfile therapist={therapist} />)

      expect(screen.getByText('タグ')).toBeInTheDocument()
      expect(screen.getByText('雰囲気:')).toBeInTheDocument()
      expect(screen.getByText('明るい')).toBeInTheDocument()
    })

    it('renders style tag', () => {
      const therapist = {
        ...defaultTherapist,
        tags: { style: 'スポーティ' },
      }
      render(<TherapistProfile therapist={therapist} />)

      expect(screen.getByText('スタイル:')).toBeInTheDocument()
      expect(screen.getByText('スポーティ')).toBeInTheDocument()
    })

    it('renders look tag', () => {
      const therapist = {
        ...defaultTherapist,
        tags: { look: 'キュート' },
      }
      render(<TherapistProfile therapist={therapist} />)

      expect(screen.getByText('見た目:')).toBeInTheDocument()
      expect(screen.getByText('キュート')).toBeInTheDocument()
    })

    it('renders contact tag', () => {
      const therapist = {
        ...defaultTherapist,
        tags: { contact: '優しい' },
      }
      render(<TherapistProfile therapist={therapist} />)

      expect(screen.getByText('接し方:')).toBeInTheDocument()
      expect(screen.getByText('優しい')).toBeInTheDocument()
    })

    it('renders hobby tags', () => {
      const therapist = {
        ...defaultTherapist,
        tags: { hobby_tags: ['読書', '旅行', '料理'] },
      }
      render(<TherapistProfile therapist={therapist} />)

      expect(screen.getByText('趣味・興味:')).toBeInTheDocument()
      expect(screen.getByText('読書')).toBeInTheDocument()
      expect(screen.getByText('旅行')).toBeInTheDocument()
      expect(screen.getByText('料理')).toBeInTheDocument()
    })

    it('does not render tags section when no tags', () => {
      render(<TherapistProfile therapist={defaultTherapist} />)
      expect(screen.queryByText('タグ')).not.toBeInTheDocument()
    })
  })

  describe('profile text', () => {
    it('renders profile text when provided', () => {
      const therapist = {
        ...defaultTherapist,
        profile_text: 'はじめまして！山田花子です。よろしくお願いします。',
      }
      render(<TherapistProfile therapist={therapist} />)

      expect(screen.getByText('プロフィール')).toBeInTheDocument()
      expect(
        screen.getByText('はじめまして！山田花子です。よろしくお願いします。')
      ).toBeInTheDocument()
    })

    it('does not render profile section when no text', () => {
      render(<TherapistProfile therapist={defaultTherapist} />)
      expect(screen.queryByText('プロフィール')).not.toBeInTheDocument()
    })
  })

  describe('full profile', () => {
    it('renders all sections when all data provided', () => {
      const therapist = {
        id: 'therapist-123',
        name: '山田花子',
        age: 25,
        price_rank: 2,
        tags: {
          mood: '明るい',
          style: 'スポーティ',
          look: 'キュート',
          contact: '優しい',
          hobby_tags: ['読書', '旅行'],
        },
        profile_text: 'はじめまして！',
        photos: ['/photo1.jpg', '/photo2.jpg'],
        badges: ['新人'],
      }
      render(<TherapistProfile therapist={therapist} />)

      // Name
      expect(screen.getByText('山田花子')).toBeInTheDocument()
      // Age
      expect(screen.getByText('25歳')).toBeInTheDocument()
      // Price
      expect(screen.getByText('¥¥')).toBeInTheDocument()
      // Badge
      expect(screen.getByText('新人')).toBeInTheDocument()
      // Tags
      expect(screen.getByText('タグ')).toBeInTheDocument()
      expect(screen.getByText('明るい')).toBeInTheDocument()
      // Profile
      expect(screen.getByText('プロフィール')).toBeInTheDocument()
      // Additional photos
      expect(screen.getByText('その他の写真')).toBeInTheDocument()
    })
  })
})
