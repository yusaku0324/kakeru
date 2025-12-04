import { render, screen, act } from '@testing-library/react'

import QAMenuPage from './page'

describe('admin qa menu', () => {
  it('renders main shortcuts', async () => {
    await act(async () => {
      render(<QAMenuPage />)
    })

    expect(screen.getByText('開発者QAメニュー')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'ゲスト検索デモ' })).toHaveAttribute('href', '/guest/search')
    expect(screen.getByRole('link', { name: '店舗一覧' })).toHaveAttribute('href', '/admin/shops')
  })
})
