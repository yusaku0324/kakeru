import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

import { SimilarTherapistsSection } from './SimilarTherapistsSection'

const mockItems = [
  {
    id: 't1',
    name: 'Therapist 1',
    age: 24,
    price_rank: 2,
    mood_tag: 'calm',
    style_tag: 'relax',
    look_type: 'natural',
    contact_style: 'gentle',
    hobby_tags: ['anime'],
    photo_url: 'https://example.com/photo1.jpg',
    is_available_now: true,
    score: 0.9,
    photo_similarity: 0.9,
    tag_similarity: 0.9,
  },
  {
    id: 't2',
    name: 'Therapist 2',
    age: 26,
    price_rank: 3,
    mood_tag: 'cool',
    style_tag: 'strong',
    look_type: 'beauty',
    contact_style: 'standard',
    hobby_tags: ['golf'],
    photo_url: 'https://example.com/photo2.jpg',
    is_available_now: false,
    score: 0.7,
    photo_similarity: 0.7,
    tag_similarity: 0.7,
  },
]

describe('SimilarTherapistsSection', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('calls API and renders cards when items exist', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ base_staff_id: 'base', items: mockItems }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<SimilarTherapistsSection baseStaffId="base" />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('staff_id=base')
    expect(url).toContain('limit=8')

    await waitFor(() =>
      expect(screen.getByText('この子に近いタイプ')).toBeInTheDocument(),
    )
    await waitFor(() =>
      expect(screen.getAllByTestId('similar-card')).toHaveLength(mockItems.length),
    )
  })

  it('hides section when items are empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ base_staff_id: 'base', items: [] }),
    }))

    render(<SimilarTherapistsSection baseStaffId="base" />)

    await waitFor(() =>
      expect(screen.queryByText('この子に近いタイプ')).not.toBeInTheDocument(),
    )
  })

  it('hides section on error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))

    render(<SimilarTherapistsSection baseStaffId="base" />)

    await waitFor(() =>
      expect(screen.queryByText('この子に近いタイプ')).not.toBeInTheDocument(),
    )
    consoleSpy.mockRestore()
  })
})
