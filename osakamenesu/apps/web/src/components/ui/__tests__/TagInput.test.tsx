import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TagInput } from '../TagInput'

describe('TagInput', () => {
  const defaultProps = {
    tags: [],
    onChange: vi.fn(),
  }

  describe('rendering', () => {
    it('renders input element', () => {
      render(<TagInput {...defaultProps} />)
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('renders with placeholder when no tags', () => {
      render(<TagInput {...defaultProps} placeholder="タグを追加" />)
      expect(screen.getByPlaceholderText('タグを追加')).toBeInTheDocument()
    })

    it('renders existing tags', () => {
      render(<TagInput {...defaultProps} tags={['React', 'TypeScript']} />)
      expect(screen.getByText('React')).toBeInTheDocument()
      expect(screen.getByText('TypeScript')).toBeInTheDocument()
    })

    it('renders helper text with tag count', () => {
      render(<TagInput {...defaultProps} tags={['React', 'TypeScript']} maxTags={5} />)
      expect(screen.getByText(/2\/5/)).toBeInTheDocument()
    })
  })

  describe('adding tags', () => {
    it('adds tag on Enter key', async () => {
      const onChange = vi.fn()
      render(<TagInput tags={[]} onChange={onChange} />)

      const input = screen.getByRole('textbox')
      await userEvent.type(input, 'NewTag{enter}')

      expect(onChange).toHaveBeenCalledWith(['NewTag'])
    })

    it('adds tag on comma key', async () => {
      const onChange = vi.fn()
      render(<TagInput tags={[]} onChange={onChange} />)

      const input = screen.getByRole('textbox')
      await userEvent.type(input, 'NewTag,')

      expect(onChange).toHaveBeenCalledWith(['NewTag'])
    })

    it('trims whitespace from tags', async () => {
      const onChange = vi.fn()
      render(<TagInput tags={[]} onChange={onChange} />)

      const input = screen.getByRole('textbox')
      await userEvent.type(input, '  SpacedTag  {enter}')

      expect(onChange).toHaveBeenCalledWith(['SpacedTag'])
    })

    it('does not add empty tags', async () => {
      const onChange = vi.fn()
      render(<TagInput tags={[]} onChange={onChange} />)

      const input = screen.getByRole('textbox')
      await userEvent.type(input, '{enter}')

      expect(onChange).not.toHaveBeenCalled()
    })

    it('does not add duplicate tags', async () => {
      const onChange = vi.fn()
      render(<TagInput tags={['Existing']} onChange={onChange} />)

      const input = screen.getByRole('textbox')
      await userEvent.type(input, 'Existing{enter}')

      expect(onChange).not.toHaveBeenCalled()
    })

    it('respects maxTags limit', async () => {
      const onChange = vi.fn()
      render(<TagInput tags={['Tag1', 'Tag2']} onChange={onChange} maxTags={2} />)

      const input = screen.getByRole('textbox')
      expect(input).toBeDisabled()
    })
  })

  describe('removing tags', () => {
    it('removes tag on button click', async () => {
      const onChange = vi.fn()
      render(<TagInput tags={['RemoveMe']} onChange={onChange} />)

      const removeButton = screen.getByRole('button', { name: 'RemoveMeを削除' })
      await userEvent.click(removeButton)

      expect(onChange).toHaveBeenCalledWith([])
    })

    it('removes last tag on backspace when input is empty', async () => {
      const onChange = vi.fn()
      render(<TagInput tags={['Tag1', 'Tag2']} onChange={onChange} />)

      const input = screen.getByRole('textbox')
      await userEvent.type(input, '{backspace}')

      expect(onChange).toHaveBeenCalledWith(['Tag1'])
    })

    it('does not show remove button when disabled', () => {
      render(<TagInput tags={['DisabledTag']} onChange={vi.fn()} disabled />)
      expect(screen.queryByRole('button', { name: /削除/ })).not.toBeInTheDocument()
    })
  })

  describe('suggestions', () => {
    it('shows suggestions when typing', async () => {
      render(
        <TagInput
          tags={[]}
          onChange={vi.fn()}
          suggestions={['React', 'Redux', 'Router']}
        />,
      )

      const input = screen.getByRole('textbox')
      await userEvent.type(input, 'Re')

      expect(screen.getByText('React')).toBeInTheDocument()
      expect(screen.getByText('Redux')).toBeInTheDocument()
    })

    it('filters suggestions based on input', async () => {
      render(
        <TagInput
          tags={[]}
          onChange={vi.fn()}
          suggestions={['React', 'Vue', 'Angular']}
        />,
      )

      const input = screen.getByRole('textbox')
      await userEvent.type(input, 'Rea')

      expect(screen.getByText('React')).toBeInTheDocument()
      expect(screen.queryByText('Vue')).not.toBeInTheDocument()
    })

    it('excludes already selected tags from suggestions', async () => {
      render(
        <TagInput
          tags={['React']}
          onChange={vi.fn()}
          suggestions={['React', 'Redux']}
        />,
      )

      const input = screen.getByRole('textbox')
      await userEvent.type(input, 'Re')

      expect(screen.queryAllByText('React').length).toBe(1) // Only the tag, not suggestion
      expect(screen.getByText('Redux')).toBeInTheDocument()
    })

    it('adds tag when clicking suggestion', async () => {
      const onChange = vi.fn()
      render(
        <TagInput
          tags={[]}
          onChange={onChange}
          suggestions={['React', 'Redux']}
        />,
      )

      const input = screen.getByRole('textbox')
      await userEvent.type(input, 'Re')

      const suggestionButton = screen.getByRole('button', { name: 'React' })
      await userEvent.click(suggestionButton)

      expect(onChange).toHaveBeenCalledWith(['React'])
    })
  })

  describe('disabled state', () => {
    it('disables input when disabled prop is true', () => {
      render(<TagInput {...defaultProps} disabled />)
      expect(screen.getByRole('textbox')).toBeDisabled()
    })

    it('applies disabled styling', () => {
      const { container } = render(<TagInput {...defaultProps} disabled />)
      const wrapper = container.querySelector('.cursor-not-allowed')
      expect(wrapper).toBeInTheDocument()
    })
  })

  describe('className', () => {
    it('applies custom className', () => {
      const { container } = render(
        <TagInput {...defaultProps} className="custom-class" />,
      )
      expect(container.querySelector('.custom-class')).toBeInTheDocument()
    })
  })
})
