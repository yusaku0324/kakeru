'use client'

import clsx from 'clsx'

import { GlassSelect } from '@/components/ui/GlassSelect'

type Option = {
  value: string
  label: string
}

type BasicSearchSectionProps = {
  keyword: string
  onKeywordChange: (value: string) => void
  area: string
  onAreaChange: (value: string) => void
  service: string
  onServiceChange: (value: string) => void
  areaOptions: Option[]
  serviceOptions: Option[]
  fieldClass: string
  selectButtonClass: string
  selectMenuClass: string
  selectOptionClass: string
  className?: string
  showHeader?: boolean
  showKeywordField?: boolean
  showAreaField?: boolean
  showServiceField?: boolean
}

export function BasicSearchSection({
  keyword,
  onKeywordChange,
  area,
  onAreaChange,
  service,
  onServiceChange,
  areaOptions,
  serviceOptions,
  fieldClass,
  selectButtonClass,
  selectMenuClass,
  selectOptionClass,
  className,
  showHeader = true,
  showKeywordField = true,
  showAreaField = true,
  showServiceField = true,
}: BasicSearchSectionProps) {
  const wrapperClass = className
    ? className
    : 'relative overflow-visible rounded-[32px] border border-white/45 bg-white/45 p-6 shadow-[0_24px_70px_rgba(37,99,235,0.18)] backdrop-blur'
  const showSelects = showAreaField || showServiceField
  return (
    <section className={wrapperClass}>
      {!className ? (
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(147,197,253,0.25)_0%,rgba(147,197,253,0)_65%)]" />
      ) : null}
      {showHeader ? (
        <header className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
            🔎
          </span>
          <div>
            <p className="text-sm font-semibold text-neutral-text">基本検索</p>
            <p className="text-xs text-neutral-textMuted">キーワード・エリア・サービス形態を指定</p>
          </div>
        </header>
      ) : null}

      <div className={clsx('space-y-4', showHeader ? 'mt-6' : 'mt-0')}>
        {showKeywordField ? (
          <label className="grid gap-2 text-sm text-neutral-text" htmlFor="keyword-search">
            キーワード検索
            <div className="relative">
              <input
                id="keyword-search"
                type="search"
                value={keyword}
                onChange={(event) => onKeywordChange(event.target.value)}
                placeholder="店舗名・エリア名・駅名・施術キーワード など"
                className={clsx(fieldClass, 'pr-12 backdrop-blur-sm')}
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 inline-flex items-center text-neutral-textMuted">
                🔍
              </span>
            </div>
          </label>
        ) : null}

        {showSelects ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {showAreaField ? (
              <div className="space-y-2 text-sm text-neutral-text">
                <span className="font-semibold">エリア</span>
                <GlassSelect
                  name="area"
                  value={area}
                  onChange={onAreaChange}
                  options={areaOptions}
                  placeholder="すべて"
                  buttonClassName={selectButtonClass}
                  menuClassName={selectMenuClass}
                  optionClassName={selectOptionClass}
                />
              </div>
            ) : null}
            {showServiceField ? (
              <div className="space-y-2 text-sm text-neutral-text">
                <span className="font-semibold">サービス形態</span>
                <GlassSelect
                  name="service"
                  value={service}
                  onChange={onServiceChange}
                  options={serviceOptions}
                  placeholder="すべて"
                  buttonClassName={selectButtonClass}
                  menuClassName={selectMenuClass}
                  optionClassName={selectOptionClass}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
