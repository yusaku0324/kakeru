import { fireEvent, render, screen } from '@testing-library/react'

import { SafeImage } from '../SafeImage'

describe('SafeImage', () => {
  it('renders provided src when available', () => {
    render(<SafeImage src="/images/demo-shop-1.svg" alt="デモ" width={120} height={90} />)
    const img = screen.getByAltText('デモ')
    expect(img).toHaveAttribute('src', '/images/demo-shop-1.svg')
  })

  it('falls back to placeholder when src is missing', () => {
    render(
      <SafeImage
        src={null}
        alt="デモ"
        width={80}
        height={60}
        fallbackSrc="/images/placeholder-card.svg"
      />,
    )
    const img = screen.getByAltText('デモ')
    expect(img).toHaveAttribute('src', '/images/placeholder-card.svg')
  })

  it('switches to fallback when load error fires', () => {
    render(
      <SafeImage
        src="/images/invalid.png"
        alt="デモ"
        width={80}
        height={60}
        fallbackSrc="/images/demo-shop-2.svg"
      />,
    )
    const img = screen.getByAltText('デモ')
    fireEvent.error(img)
    expect(img).toHaveAttribute('src', '/images/demo-shop-2.svg')
  })
})
