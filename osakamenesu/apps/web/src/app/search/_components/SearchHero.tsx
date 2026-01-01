'use client'

import React from 'react'

export function SearchHero({ children }: { children?: React.ReactNode }) {
  return (
    <header className="relative overflow-hidden rounded-section border border-white/60 bg-gradient-to-br from-white/90 via-white/80 to-brand-primary/5 px-6 py-10 shadow-2xl shadow-brand-primary/10 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70 lg:px-10 lg:py-14">
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-brand-primary/20 to-brand-secondary/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-gradient-to-tr from-brand-secondary/15 to-brand-primary/10 blur-3xl"
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-text sm:text-4xl lg:text-5xl">
          あなたにぴったりの
          <br className="sm:hidden" />
          <span className="inline-block whitespace-nowrap">
            <span className="bg-gradient-to-r from-brand-primary to-brand-secondary bg-clip-text text-transparent">
              セラピスト
            </span>
            を見つけよう
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-neutral-textMuted sm:text-lg">
          今日の気分や好みを伝えるだけで、
          <br className="hidden sm:inline" />
          AIがあなたに合ったセラピストをご提案します
        </p>

        {children && (
          <div className="mt-10 flex flex-col items-center gap-6 lg:mt-12">
            {children}
          </div>
        )}
      </div>
    </header>
  )
}
