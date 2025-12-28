/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShopDetailForm } from '../ShopDetailForm'
import type { ShopFormState } from '@/features/shops/model'

describe('ShopDetailForm', () => {
  const mockForm: ShopFormState = {
    name: 'Test Shop',
    slug: 'test-shop',
    area: 'Tokyo',
    priceMin: 5000,
    priceMax: 10000,
    serviceType: 'store',
    serviceTags: ['massage', 'spa'],
    description: 'Test description',
    catchCopy: 'Test catch copy',
    address: 'Tokyo, Japan',
    contact: {
      phone: '03-1234-5678',
      line_id: '@testshop',
      website_url: 'https://example.com',
      reservation_form_url: 'https://example.com/reserve',
    },
    photos: [],
    menus: [],
    staff: [],
  }

  const defaultProps = {
    form: mockForm,
    serviceTypes: ['store' as const, 'dispatch' as const],
    tagDraft: '',
    onChangeField: vi.fn(),
    onUpdateContact: vi.fn(),
    onTagDraftChange: vi.fn(),
    onAddServiceTag: vi.fn(),
    onRemoveServiceTag: vi.fn(),
  }

  describe('basic info fields', () => {
    it('renders shop name input', () => {
      render(<ShopDetailForm {...defaultProps} />)
      const input = screen.getByPlaceholderText('例: アロマリゾート 難波本店')
      expect(input).toHaveValue('Test Shop')
    })

    it('calls onChangeField when name changes', async () => {
      const onChangeField = vi.fn()
      render(<ShopDetailForm {...defaultProps} onChangeField={onChangeField} />)

      const input = screen.getByPlaceholderText('例: アロマリゾート 難波本店')
      await userEvent.clear(input)
      await userEvent.type(input, 'New Name')

      expect(onChangeField).toHaveBeenCalledWith('name', expect.any(String))
    })

    it('renders slug input', () => {
      render(<ShopDetailForm {...defaultProps} />)
      const input = screen.getByPlaceholderText('例: aroma-namba')
      expect(input).toHaveValue('test-shop')
    })

    it('calls onChangeField when slug changes', async () => {
      const onChangeField = vi.fn()
      render(<ShopDetailForm {...defaultProps} onChangeField={onChangeField} />)

      const input = screen.getByPlaceholderText('例: aroma-namba')
      await userEvent.clear(input)
      await userEvent.type(input, 'new-slug')

      expect(onChangeField).toHaveBeenCalledWith('slug', expect.any(String))
    })

    it('renders area input', () => {
      render(<ShopDetailForm {...defaultProps} />)
      const input = screen.getByPlaceholderText('例: 難波/日本橋')
      expect(input).toHaveValue('Tokyo')
    })

    it('calls onChangeField when area changes', async () => {
      const onChangeField = vi.fn()
      render(<ShopDetailForm {...defaultProps} onChangeField={onChangeField} />)

      const input = screen.getByPlaceholderText('例: 難波/日本橋')
      await userEvent.clear(input)
      await userEvent.type(input, 'Osaka')

      expect(onChangeField).toHaveBeenCalledWith('area', expect.any(String))
    })

    it('renders price inputs', () => {
      render(<ShopDetailForm {...defaultProps} />)
      const inputs = screen.getAllByRole('spinbutton')
      expect(inputs[0]).toHaveValue(5000) // priceMin
      expect(inputs[1]).toHaveValue(10000) // priceMax
    })

    it('calls onChangeField when priceMin changes', async () => {
      const onChangeField = vi.fn()
      render(<ShopDetailForm {...defaultProps} onChangeField={onChangeField} />)

      const inputs = screen.getAllByRole('spinbutton')
      fireEvent.change(inputs[0], { target: { value: '6000' } })

      expect(onChangeField).toHaveBeenCalledWith('priceMin', 6000)
    })

    it('calls onChangeField when priceMax changes', async () => {
      const onChangeField = vi.fn()
      render(<ShopDetailForm {...defaultProps} onChangeField={onChangeField} />)

      const inputs = screen.getAllByRole('spinbutton')
      fireEvent.change(inputs[1], { target: { value: '15000' } })

      expect(onChangeField).toHaveBeenCalledWith('priceMax', 15000)
    })
  })

  describe('service type select', () => {
    it('renders service type select with options', () => {
      render(<ShopDetailForm {...defaultProps} />)
      const select = screen.getByRole('combobox')
      expect(select).toHaveValue('store')
    })

    it('shows correct labels for service types', () => {
      render(<ShopDetailForm {...defaultProps} />)
      expect(screen.getByText('店舗型')).toBeInTheDocument()
      expect(screen.getByText('出張型')).toBeInTheDocument()
    })

    it('calls onChangeField when service type changes', async () => {
      const onChangeField = vi.fn()
      render(<ShopDetailForm {...defaultProps} onChangeField={onChangeField} />)

      const select = screen.getByRole('combobox')
      await userEvent.selectOptions(select, 'dispatch')

      expect(onChangeField).toHaveBeenCalledWith('serviceType', 'dispatch')
    })
  })

  describe('text areas', () => {
    it('renders description textarea', () => {
      render(<ShopDetailForm {...defaultProps} />)
      const textarea = screen.getByTestId('shop-description')
      expect(textarea).toHaveValue('Test description')
    })

    it('calls onChangeField when description changes', async () => {
      const onChangeField = vi.fn()
      render(<ShopDetailForm {...defaultProps} onChangeField={onChangeField} />)

      const textarea = screen.getByTestId('shop-description')
      await userEvent.clear(textarea)
      await userEvent.type(textarea, 'New description')

      expect(onChangeField).toHaveBeenCalledWith('description', expect.any(String))
    })

    it('renders catch copy textarea', () => {
      render(<ShopDetailForm {...defaultProps} />)
      const textarea = screen.getByTestId('shop-catch-copy')
      expect(textarea).toHaveValue('Test catch copy')
    })

    it('calls onChangeField when catch copy changes', async () => {
      const onChangeField = vi.fn()
      render(<ShopDetailForm {...defaultProps} onChangeField={onChangeField} />)

      const textarea = screen.getByTestId('shop-catch-copy')
      await userEvent.clear(textarea)
      await userEvent.type(textarea, 'New catch copy')

      expect(onChangeField).toHaveBeenCalledWith('catchCopy', expect.any(String))
    })

    it('renders address input', () => {
      render(<ShopDetailForm {...defaultProps} />)
      const input = screen.getByTestId('shop-address')
      expect(input).toHaveValue('Tokyo, Japan')
    })

    it('calls onChangeField when address changes', async () => {
      const onChangeField = vi.fn()
      render(<ShopDetailForm {...defaultProps} onChangeField={onChangeField} />)

      const input = screen.getByTestId('shop-address')
      await userEvent.clear(input)
      await userEvent.type(input, 'New address')

      expect(onChangeField).toHaveBeenCalledWith('address', expect.any(String))
    })
  })

  describe('service tags', () => {
    it('renders existing service tags', () => {
      render(<ShopDetailForm {...defaultProps} />)
      expect(screen.getByText('massage')).toBeInTheDocument()
      expect(screen.getByText('spa')).toBeInTheDocument()
    })

    it('shows empty state when no tags', () => {
      render(
        <ShopDetailForm
          {...defaultProps}
          form={{ ...mockForm, serviceTags: [] }}
        />
      )
      expect(screen.getByText('タグ未設定')).toBeInTheDocument()
    })

    it('calls onRemoveServiceTag when remove button clicked', async () => {
      const onRemoveServiceTag = vi.fn()
      render(<ShopDetailForm {...defaultProps} onRemoveServiceTag={onRemoveServiceTag} />)

      const removeButtons = screen.getAllByRole('button', { name: /を削除/ })
      await userEvent.click(removeButtons[0])

      expect(onRemoveServiceTag).toHaveBeenCalledWith(0)
    })

    it('calls onTagDraftChange when typing in tag input', async () => {
      const onTagDraftChange = vi.fn()
      render(<ShopDetailForm {...defaultProps} onTagDraftChange={onTagDraftChange} />)

      const input = screen.getByTestId('shop-service-tag-input')
      await userEvent.type(input, 'new tag')

      expect(onTagDraftChange).toHaveBeenCalled()
    })

    it('calls onAddServiceTag when add button clicked', async () => {
      const onAddServiceTag = vi.fn()
      render(
        <ShopDetailForm
          {...defaultProps}
          tagDraft="new tag"
          onAddServiceTag={onAddServiceTag}
        />
      )

      const addButton = screen.getByTestId('shop-service-tag-add')
      await userEvent.click(addButton)

      expect(onAddServiceTag).toHaveBeenCalledWith('new tag')
    })

    it('calls onAddServiceTag when Enter is pressed in tag input', async () => {
      const onAddServiceTag = vi.fn()
      render(
        <ShopDetailForm
          {...defaultProps}
          tagDraft="new tag"
          onAddServiceTag={onAddServiceTag}
        />
      )

      const input = screen.getByTestId('shop-service-tag-input')
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(onAddServiceTag).toHaveBeenCalledWith('new tag')
    })
  })

  describe('contact section', () => {
    it('renders contact section header', () => {
      render(<ShopDetailForm {...defaultProps} />)
      expect(screen.getByText('連絡先')).toBeInTheDocument()
    })

    it('renders phone input with value', () => {
      render(<ShopDetailForm {...defaultProps} />)
      const input = screen.getByPlaceholderText('電話番号')
      expect(input).toHaveValue('03-1234-5678')
    })

    it('renders line id input with value', () => {
      render(<ShopDetailForm {...defaultProps} />)
      const input = screen.getByPlaceholderText('LINE ID / URL')
      expect(input).toHaveValue('@testshop')
    })

    it('renders website url input with value', () => {
      render(<ShopDetailForm {...defaultProps} />)
      const input = screen.getByPlaceholderText('公式サイトURL')
      expect(input).toHaveValue('https://example.com')
    })

    it('renders reservation form url input with value', () => {
      render(<ShopDetailForm {...defaultProps} />)
      const input = screen.getByPlaceholderText('WEB予約フォームURL')
      expect(input).toHaveValue('https://example.com/reserve')
    })

    it('calls onUpdateContact when phone changes', async () => {
      const onUpdateContact = vi.fn()
      render(<ShopDetailForm {...defaultProps} onUpdateContact={onUpdateContact} />)

      const input = screen.getByPlaceholderText('電話番号')
      await userEvent.clear(input)
      await userEvent.type(input, '03-9999-9999')

      expect(onUpdateContact).toHaveBeenCalledWith({ phone: expect.any(String) })
    })

    it('calls onUpdateContact when line id changes', async () => {
      const onUpdateContact = vi.fn()
      render(<ShopDetailForm {...defaultProps} onUpdateContact={onUpdateContact} />)

      const input = screen.getByPlaceholderText('LINE ID / URL')
      await userEvent.clear(input)
      await userEvent.type(input, '@newline')

      expect(onUpdateContact).toHaveBeenCalledWith({ line_id: expect.any(String) })
    })

    it('calls onUpdateContact when website url changes', async () => {
      const onUpdateContact = vi.fn()
      render(<ShopDetailForm {...defaultProps} onUpdateContact={onUpdateContact} />)

      const input = screen.getByPlaceholderText('公式サイトURL')
      await userEvent.clear(input)
      await userEvent.type(input, 'https://newsite.com')

      expect(onUpdateContact).toHaveBeenCalledWith({ website_url: expect.any(String) })
    })

    it('calls onUpdateContact when reservation form url changes', async () => {
      const onUpdateContact = vi.fn()
      render(<ShopDetailForm {...defaultProps} onUpdateContact={onUpdateContact} />)

      const input = screen.getByPlaceholderText('WEB予約フォームURL')
      await userEvent.clear(input)
      await userEvent.type(input, 'https://reserve.example.com')

      expect(onUpdateContact).toHaveBeenCalledWith({ reservation_form_url: expect.any(String) })
    })

    it('handles null contact gracefully', () => {
      render(
        <ShopDetailForm
          {...defaultProps}
          form={{ ...mockForm, contact: null }}
        />
      )

      const phoneInput = screen.getByPlaceholderText('電話番号')
      expect(phoneInput).toHaveValue('')
    })
  })
})
