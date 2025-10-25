import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

import { TherapistPhotoField } from '../TherapistManager'

describe('TherapistPhotoField', () => {
  it('renders previews and allows manual URL registration', async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined)
    const onRemove = vi.fn()
    const onMove = vi.fn()
    const onAddUrl = vi.fn()
    const user = userEvent.setup()

    render(
      <TherapistPhotoField
        photoUrls={['https://example.com/first.jpg', 'https://example.com/second.jpg']}
        disabled={false}
        isUploading={false}
        errorMessage="エラーがあります"
        onUpload={onUpload}
        onRemove={onRemove}
        onMove={onMove}
        onAddUrl={onAddUrl}
      />
    )

    expect(screen.getByText('画像をアップロード')).toBeInTheDocument()
    expect(screen.getByText('エラーがあります')).toBeInTheDocument()
    expect(screen.getByAltText('セラピスト写真 1')).toBeInTheDocument()

    const urlInput = screen.getByPlaceholderText('https://example.com/photo.jpg')
    await user.type(urlInput, 'https://example.com/new.jpg')
    await user.click(screen.getByRole('button', { name: 'URL を追加' }))

    expect(onAddUrl).toHaveBeenCalledWith('https://example.com/new.jpg')

    await user.click(screen.getAllByRole('button', { name: '削除' })[0])
    expect(onRemove).toHaveBeenCalledWith(0)

    await user.click(screen.getAllByRole('button', { name: '↓' })[0])
    expect(onMove).toHaveBeenCalledWith(0, 1)

    expect(onUpload).not.toHaveBeenCalled()
  })
})
