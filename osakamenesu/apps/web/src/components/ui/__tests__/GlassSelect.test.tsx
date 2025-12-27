import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { GlassSelect, GlassSelectField } from '../GlassSelect'

// Mock scrollIntoView which is not available in jsdom
Element.prototype.scrollIntoView = vi.fn()

const defaultOptions = [
  { value: 'option1', label: 'Option 1' },
  { value: 'option2', label: 'Option 2' },
  { value: 'option3', label: 'Option 3' },
]

describe('GlassSelect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders with placeholder when no value selected', () => {
      render(
        <GlassSelect
          options={defaultOptions}
          value=""
          onChange={() => {}}
          placeholder="Select an option"
        />,
      )

      expect(screen.getByRole('button')).toHaveTextContent('Select an option')
    })

    it('renders with selected value label', () => {
      render(
        <GlassSelect
          options={defaultOptions}
          value="option2"
          onChange={() => {}}
        />,
      )

      expect(screen.getByRole('button')).toHaveTextContent('Option 2')
    })

    it('renders with custom icon', () => {
      render(
        <GlassSelect
          options={defaultOptions}
          value=""
          onChange={() => {}}
          icon={<span data-testid="custom-icon">🔍</span>}
        />,
      )

      expect(screen.getByTestId('custom-icon')).toBeInTheDocument()
    })

    it('renders hidden input when name is provided', () => {
      const { container } = render(
        <GlassSelect
          name="mySelect"
          options={defaultOptions}
          value="option1"
          onChange={() => {}}
        />,
      )

      const hiddenInput = container.querySelector('input[type="hidden"][name="mySelect"]')
      expect(hiddenInput).toHaveValue('option1')
    })

    it('does not render hidden input when name is not provided', () => {
      const { container } = render(
        <GlassSelect
          options={defaultOptions}
          value="option1"
          onChange={() => {}}
        />,
      )

      const hiddenInput = container.querySelector('input[type="hidden"]')
      expect(hiddenInput).not.toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('has aria-haspopup="listbox"', () => {
      render(
        <GlassSelect
          options={defaultOptions}
          value=""
          onChange={() => {}}
        />,
      )

      expect(screen.getByRole('button')).toHaveAttribute('aria-haspopup', 'listbox')
    })

    it('has aria-expanded="false" when closed', () => {
      render(
        <GlassSelect
          options={defaultOptions}
          value=""
          onChange={() => {}}
        />,
      )

      expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false')
    })

    it('has aria-expanded="true" when open', () => {
      render(
        <GlassSelect
          options={defaultOptions}
          value=""
          onChange={() => {}}
        />,
      )

      fireEvent.click(screen.getByRole('button'))

      expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true')
    })
  })

  describe('opening and closing', () => {
    it('opens dropdown on button click', () => {
      render(
        <GlassSelect
          options={defaultOptions}
          value=""
          onChange={() => {}}
        />,
      )

      fireEvent.click(screen.getByRole('button'))

      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })

    it('closes dropdown on second button click', () => {
      render(
        <GlassSelect
          options={defaultOptions}
          value=""
          onChange={() => {}}
        />,
      )

      const button = screen.getByRole('button')
      fireEvent.click(button)
      expect(screen.getByRole('listbox')).toBeInTheDocument()

      fireEvent.click(button)
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('does not open when disabled', () => {
      render(
        <GlassSelect
          options={defaultOptions}
          value=""
          onChange={() => {}}
          disabled
        />,
      )

      fireEvent.click(screen.getByRole('button'))

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })
  })

  describe('selection', () => {
    it('calls onChange when option is clicked', () => {
      const handleChange = vi.fn()
      render(
        <GlassSelect
          options={defaultOptions}
          value=""
          onChange={handleChange}
        />,
      )

      fireEvent.click(screen.getByRole('button'))
      fireEvent.click(screen.getByText('Option 2'))

      expect(handleChange).toHaveBeenCalledWith('option2')
    })

    it('closes dropdown after selection', () => {
      render(
        <GlassSelect
          options={defaultOptions}
          value=""
          onChange={() => {}}
        />,
      )

      fireEvent.click(screen.getByRole('button'))
      fireEvent.click(screen.getByText('Option 2'))

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('shows checkmark for selected option', () => {
      render(
        <GlassSelect
          options={defaultOptions}
          value="option2"
          onChange={() => {}}
        />,
      )

      fireEvent.click(screen.getByRole('button'))

      const selectedOption = screen.getByRole('option', { selected: true })
      expect(selectedOption).toHaveTextContent('Option 2')
      expect(selectedOption).toHaveTextContent('✓')
    })
  })

  describe('keyboard navigation', () => {
    it('opens dropdown on Enter key', () => {
      render(
        <GlassSelect
          options={defaultOptions}
          value=""
          onChange={() => {}}
        />,
      )

      fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' })

      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })

    it('opens dropdown on Space key', () => {
      render(
        <GlassSelect
          options={defaultOptions}
          value=""
          onChange={() => {}}
        />,
      )

      fireEvent.keyDown(screen.getByRole('button'), { key: ' ' })

      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })

    it('opens dropdown on ArrowDown key', () => {
      render(
        <GlassSelect
          options={defaultOptions}
          value=""
          onChange={() => {}}
        />,
      )

      fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' })

      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })

    it('closes dropdown on Escape key', () => {
      render(
        <GlassSelect
          options={defaultOptions}
          value=""
          onChange={() => {}}
        />,
      )

      fireEvent.click(screen.getByRole('button'))
      fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' })

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('navigates down with ArrowDown', () => {
      render(
        <GlassSelect
          options={defaultOptions}
          value=""
          onChange={() => {}}
        />,
      )

      fireEvent.click(screen.getByRole('button'))
      const listbox = screen.getByRole('listbox')

      fireEvent.keyDown(listbox, { key: 'ArrowDown' })
      fireEvent.keyDown(listbox, { key: 'ArrowDown' })

      // Check active option visually
      const activeOption = screen.getByRole('option', { name: 'Option 3' })
      expect(activeOption).toHaveAttribute('data-active', 'true')
    })

    it('navigates up with ArrowUp', () => {
      render(
        <GlassSelect
          options={defaultOptions}
          value="option3"
          onChange={() => {}}
        />,
      )

      fireEvent.click(screen.getByRole('button'))
      const listbox = screen.getByRole('listbox')

      fireEvent.keyDown(listbox, { key: 'ArrowUp' })
      fireEvent.keyDown(listbox, { key: 'ArrowUp' })

      const activeOption = screen.getByRole('option', { name: 'Option 1' })
      expect(activeOption).toHaveAttribute('data-active', 'true')
    })

    it('goes to first option with Home key', () => {
      render(
        <GlassSelect
          options={defaultOptions}
          value="option3"
          onChange={() => {}}
        />,
      )

      fireEvent.click(screen.getByRole('button'))
      fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Home' })

      const activeOption = screen.getByRole('option', { name: 'Option 1' })
      expect(activeOption).toHaveAttribute('data-active', 'true')
    })

    it('goes to last option with End key', () => {
      render(
        <GlassSelect
          options={defaultOptions}
          value="option1"
          onChange={() => {}}
        />,
      )

      fireEvent.click(screen.getByRole('button'))
      fireEvent.keyDown(screen.getByRole('listbox'), { key: 'End' })

      const activeOption = screen.getByRole('option', { name: 'Option 3' })
      expect(activeOption).toHaveAttribute('data-active', 'true')
    })

    it('selects option with Enter key', () => {
      const handleChange = vi.fn()
      render(
        <GlassSelect
          options={defaultOptions}
          value=""
          onChange={handleChange}
        />,
      )

      fireEvent.click(screen.getByRole('button'))
      const listbox = screen.getByRole('listbox')
      fireEvent.keyDown(listbox, { key: 'ArrowDown' })
      fireEvent.keyDown(listbox, { key: 'Enter' })

      expect(handleChange).toHaveBeenCalledWith('option2')
    })
  })

  describe('option icons', () => {
    it('renders option icons when provided', () => {
      const optionsWithIcons = [
        { value: 'a', label: 'A', icon: <span data-testid="icon-a">🅰️</span> },
        { value: 'b', label: 'B', icon: <span data-testid="icon-b">🅱️</span> },
      ]

      render(
        <GlassSelect
          options={optionsWithIcons}
          value=""
          onChange={() => {}}
        />,
      )

      fireEvent.click(screen.getByRole('button'))

      expect(screen.getByTestId('icon-a')).toBeInTheDocument()
      expect(screen.getByTestId('icon-b')).toBeInTheDocument()
    })
  })

  describe('mouse interaction', () => {
    it('highlights option on mouse enter', () => {
      render(
        <GlassSelect
          options={defaultOptions}
          value=""
          onChange={() => {}}
        />,
      )

      fireEvent.click(screen.getByRole('button'))
      const option2 = screen.getByRole('option', { name: 'Option 2' })
      fireEvent.mouseEnter(option2)

      expect(option2).toHaveAttribute('data-active', 'true')
    })
  })
})

describe('GlassSelectField', () => {
  it('renders with label', () => {
    render(
      <GlassSelectField
        label="My Label"
        options={defaultOptions}
        value=""
        onChange={() => {}}
      />,
    )

    expect(screen.getByText('My Label')).toBeInTheDocument()
  })

  it('renders with hint', () => {
    render(
      <GlassSelectField
        hint="This is a hint"
        options={defaultOptions}
        value=""
        onChange={() => {}}
      />,
    )

    expect(screen.getByText('This is a hint')).toBeInTheDocument()
  })

  it('renders with both label and hint', () => {
    render(
      <GlassSelectField
        label="My Label"
        hint="This is a hint"
        options={defaultOptions}
        value=""
        onChange={() => {}}
      />,
    )

    expect(screen.getByText('My Label')).toBeInTheDocument()
    expect(screen.getByText('This is a hint')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(
      <GlassSelectField
        className="custom-class"
        options={defaultOptions}
        value=""
        onChange={() => {}}
      />,
    )

    expect(container.querySelector('.custom-class')).toBeInTheDocument()
  })
})
