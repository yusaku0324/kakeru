/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '../accordion'

describe('Accordion', () => {
  it('renders accordion with items', () => {
    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTrigger>Section 1</AccordionTrigger>
          <AccordionContent>Content 1</AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>Section 2</AccordionTrigger>
          <AccordionContent>Content 2</AccordionContent>
        </AccordionItem>
      </Accordion>
    )

    expect(screen.getByText('Section 1')).toBeInTheDocument()
    expect(screen.getByText('Section 2')).toBeInTheDocument()
  })

  it('expands content when trigger is clicked', async () => {
    const user = userEvent.setup()

    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTrigger>Section 1</AccordionTrigger>
          <AccordionContent>Content 1</AccordionContent>
        </AccordionItem>
      </Accordion>
    )

    const trigger = screen.getByText('Section 1')
    await user.click(trigger)

    expect(screen.getByText('Content 1')).toBeVisible()
  })

  it('collapses content when trigger is clicked again', async () => {
    const user = userEvent.setup()

    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTrigger>Section 1</AccordionTrigger>
          <AccordionContent>Content 1</AccordionContent>
        </AccordionItem>
      </Accordion>
    )

    const trigger = screen.getByRole('button', { name: /Section 1/ })

    // Expand
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    // Collapse
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('applies custom className to AccordionItem', () => {
    const { container } = render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1" className="custom-class" data-testid="accordion-item">
          <AccordionTrigger>Section 1</AccordionTrigger>
          <AccordionContent>Content 1</AccordionContent>
        </AccordionItem>
      </Accordion>
    )

    // Find the AccordionItem by looking for the div with our custom class
    const item = container.querySelector('.custom-class')
    expect(item).toBeInTheDocument()
  })

  it('applies custom className to AccordionTrigger', () => {
    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTrigger className="trigger-class">Section 1</AccordionTrigger>
          <AccordionContent>Content 1</AccordionContent>
        </AccordionItem>
      </Accordion>
    )

    const trigger = screen.getByText('Section 1')
    expect(trigger.closest('button')).toHaveClass('trigger-class')
  })

  it('applies custom className to AccordionContent', async () => {
    const user = userEvent.setup()

    const { container } = render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTrigger>Section 1</AccordionTrigger>
          <AccordionContent className="content-class">Content 1</AccordionContent>
        </AccordionItem>
      </Accordion>
    )

    const trigger = screen.getByText('Section 1')
    await user.click(trigger)

    // Find the element with content-class in the expanded content
    const content = container.querySelector('.content-class')
    expect(content).toBeInTheDocument()
  })

  it('supports multiple accordion type', async () => {
    const user = userEvent.setup()

    render(
      <Accordion type="multiple">
        <AccordionItem value="item-1">
          <AccordionTrigger>Section 1</AccordionTrigger>
          <AccordionContent>Content 1</AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>Section 2</AccordionTrigger>
          <AccordionContent>Content 2</AccordionContent>
        </AccordionItem>
      </Accordion>
    )

    const trigger1 = screen.getByText('Section 1')
    const trigger2 = screen.getByText('Section 2')

    // Open both sections
    await user.click(trigger1)
    await user.click(trigger2)

    // Both should be visible
    expect(screen.getByText('Content 1')).toBeVisible()
    expect(screen.getByText('Content 2')).toBeVisible()
  })

  it('shows plus icon in trigger', () => {
    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTrigger>Section 1</AccordionTrigger>
          <AccordionContent>Content 1</AccordionContent>
        </AccordionItem>
      </Accordion>
    )

    const trigger = screen.getByText('Section 1').closest('button')
    expect(trigger).toHaveTextContent('＋')
  })

  it('sets correct displayName on components', () => {
    expect(AccordionItem.displayName).toBe('AccordionItem')
    expect(AccordionTrigger.displayName).toBeDefined()
    expect(AccordionContent.displayName).toBeDefined()
  })
})
