'use client'

import { useEffect, useRef, useState } from 'react'

type Section = {
  id: string
  label: string
}

type ShopSectionNavProps = {
  sections: Section[]
}

export default function ShopSectionNav({ sections }: ShopSectionNavProps) {
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const navRef = useRef<HTMLDivElement>(null)
  const [isSticky, setIsSticky] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      // Check if nav should be sticky
      const nav = navRef.current
      if (nav) {
        const rect = nav.getBoundingClientRect()
        setIsSticky(rect.top <= 0)
      }

      // Find active section
      const scrollY = window.scrollY + 100 // Offset for header
      let currentSection: string | null = null

      for (const section of sections) {
        const element = document.getElementById(section.id)
        if (element) {
          const rect = element.getBoundingClientRect()
          const top = rect.top + window.scrollY
          if (scrollY >= top - 50) {
            currentSection = section.id
          }
        }
      }

      setActiveSection(currentSection)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [sections])

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      const offset = 80 // Account for sticky header
      const top = element.getBoundingClientRect().top + window.scrollY - offset
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  if (sections.length === 0) return null

  return (
    <div
      ref={navRef}
      className={`sticky top-0 z-30 -mx-4 overflow-x-auto border-b border-neutral-borderLight bg-white/95 backdrop-blur-sm transition-shadow ${
        isSticky ? 'shadow-sm' : ''
      }`}
    >
      <nav className="flex min-w-max gap-1 px-4 py-2" aria-label="ページ内ナビゲーション">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => scrollToSection(section.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              activeSection === section.id
                ? 'bg-brand-primary text-white'
                : 'text-neutral-textMuted hover:bg-neutral-surface hover:text-neutral-text'
            }`}
          >
            {section.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
