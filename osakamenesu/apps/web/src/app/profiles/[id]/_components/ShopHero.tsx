'use client'

import SafeImage from '@/components/SafeImage'
import { Badge } from '@/components/ui/Badge'
import { Chip } from '@/components/ui/Chip'

type Props = {
    name: string
    catchCopy?: string | null
    areaName?: string | null
    storeName?: string | null
    imageUrl?: string | null
    badges?: string[] | null
    serviceTags?: string[] | null
}

export function ShopHero({
    name,
    catchCopy,
    areaName,
    storeName,
    imageUrl,
    badges = [],
    serviceTags = [],
}: Props) {
    return (
        <div className="relative h-[45vh] min-h-[400px] w-full overflow-hidden rounded-b-[2rem] bg-neutral-900 shadow-2xl sm:rounded-[2rem]">
            {/* Background Image */}
            <div className="absolute inset-0">
                <SafeImage
                    src={imageUrl}
                    alt={name}
                    fill
                    className="object-cover opacity-90 transition-transform duration-700 hover:scale-105"
                    priority
                />
                {/* Gradient Overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-neutral-900/40 to-transparent" />
                <div className="absolute inset-0 bg-black/20" />
            </div>

            {/* Content */}
            <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10 lg:p-14">
                <div className="mx-auto w-full max-w-6xl space-y-4">
                    {/* Tags & Location */}
                    <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-white/90">
                        {areaName && (
                            <div className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 backdrop-blur-md">
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                                </svg>
                                {areaName}
                                {storeName && <span className="opacity-60">| {storeName}</span>}
                            </div>
                        )}

                        {(badges ?? []).slice(0, 3).map((badge) => (
                            <span key={badge} className="rounded-full bg-brand-primary/90 px-3 py-1 text-white shadow-sm backdrop-blur-md text-xs font-bold">
                                {badge}
                            </span>
                        ))}
                    </div>

                    {/* Title & Catch */}
                    <div className="space-y-4 max-w-4xl">
                        <h1 className="text-3xl font-bold leading-tight tracking-tight text-white drop-shadow-sm sm:text-4xl lg:text-6xl">
                            {name}
                        </h1>
                        {catchCopy && (
                            <p className="max-w-2xl text-base font-medium leading-relaxed text-white/90 drop-shadow-sm sm:text-lg lg:text-xl">
                                {catchCopy}
                            </p>
                        )}
                    </div>

                    {/* Service Tags */}
                    {(serviceTags ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2">
                            {(serviceTags ?? []).slice(0, 6).map((tag) => (
                                <span key={tag} className="inline-flex rounded-full border border-white/30 bg-white/10 px-2.5 py-1 text-xs text-white backdrop-blur-md hover:bg-white/20 transition-colors">
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
