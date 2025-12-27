/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProfileTagList } from '../ProfileTagList'

describe('ProfileTagList', () => {
  it('renders nothing when no tags are provided', () => {
    const { container } = render(
      <ProfileTagList
        mood_tag={null}
        style_tag={null}
        look_type={null}
        contact_style={null}
        hobby_tags={null}
        talk_level={null}
      />
    )

    expect(container.firstChild).toBeNull()
  })

  it('renders mood tag when provided', () => {
    const { container } = render(
      <ProfileTagList
        mood_tag="calm"
        style_tag={null}
        look_type={null}
        contact_style={null}
        hobby_tags={null}
        talk_level={null}
      />
    )

    // A tag should be rendered
    const chips = container.querySelectorAll('span.inline-flex')
    expect(chips.length).toBeGreaterThanOrEqual(1)
  })

  it('renders style tag when provided', () => {
    const { container } = render(
      <ProfileTagList
        mood_tag={null}
        style_tag="relax"
        look_type={null}
        contact_style={null}
        hobby_tags={null}
        talk_level={null}
      />
    )

    // A tag should be rendered
    const chips = container.querySelectorAll('span.inline-flex')
    expect(chips.length).toBeGreaterThanOrEqual(1)
  })

  it('renders look type when provided', () => {
    const { container } = render(
      <ProfileTagList
        mood_tag={null}
        style_tag={null}
        look_type="cute"
        contact_style={null}
        hobby_tags={null}
        talk_level={null}
      />
    )

    // A tag should be rendered
    const chips = container.querySelectorAll('span.inline-flex')
    expect(chips.length).toBeGreaterThanOrEqual(1)
  })

  it('renders contact style when provided', () => {
    const { container } = render(
      <ProfileTagList
        mood_tag={null}
        style_tag={null}
        look_type={null}
        contact_style="friendly"
        hobby_tags={null}
        talk_level={null}
      />
    )

    // A tag should be rendered
    const chips = container.querySelectorAll('span.inline-flex')
    expect(chips.length).toBeGreaterThanOrEqual(1)
  })

  it('renders hobby tags when provided', () => {
    const { container } = render(
      <ProfileTagList
        mood_tag={null}
        style_tag={null}
        look_type={null}
        contact_style={null}
        hobby_tags={['読書', '映画']}
        talk_level={null}
      />
    )

    // Hobby tags should be rendered as chips
    const chips = container.querySelectorAll('span.inline-flex')
    expect(chips.length).toBeGreaterThanOrEqual(2)
  })

  it('does not render talk level by default', () => {
    render(
      <ProfileTagList
        mood_tag={null}
        style_tag={null}
        look_type={null}
        contact_style={null}
        hobby_tags={null}
        talk_level="normal"
      />
    )

    // talk_level should not be displayed by default (includeTalkLevel is false)
    expect(screen.queryByText(/普通|ノーマル/i)).not.toBeInTheDocument()
  })

  it('renders talk level when includeTalkLevel is true', () => {
    const { container } = render(
      <ProfileTagList
        mood_tag={null}
        style_tag={null}
        look_type={null}
        contact_style={null}
        hobby_tags={null}
        talk_level="normal"
        includeTalkLevel={true}
      />
    )

    // talk_level should be displayed when includeTalkLevel is true
    const chips = container.querySelectorAll('span.inline-flex')
    expect(chips.length).toBeGreaterThanOrEqual(1)
  })

  it('applies custom className', () => {
    const { container } = render(
      <ProfileTagList
        mood_tag="calm"
        style_tag={null}
        look_type={null}
        contact_style={null}
        hobby_tags={null}
        talk_level={null}
        className="custom-class"
      />
    )

    const wrapper = container.querySelector('.custom-class')
    expect(wrapper).toBeInTheDocument()
  })

  it('renders multiple tags together', () => {
    render(
      <ProfileTagList
        mood_tag="calm"
        style_tag="relax"
        look_type="cute"
        contact_style="friendly"
        hobby_tags={['料理']}
        talk_level={null}
      />
    )

    // All tags should be visible
    const chips = screen.getAllByText(/.+/)
    expect(chips.length).toBeGreaterThanOrEqual(4)
  })
})
