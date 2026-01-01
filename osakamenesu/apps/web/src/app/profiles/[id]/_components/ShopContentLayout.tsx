'use client'

import React from 'react'
import { cn } from '@/lib/utils'

type Props = {
    children: React.ReactNode
    aside?: React.ReactNode
}

export function ShopContentLayout({ children, aside }: Props) {
    return (
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 lg:px-8 lg:grid-cols-[1fr_360px] xl:gap-12">
            {/* Main Content (Left Rail) */}
            <div className="min-w-0 space-y-12">
                {children}
            </div>

            {/* Sidebar (Right Rail) - Desktop Sticky */}
            <aside className="hidden space-y-8 lg:block">
                <div className="sticky top-24 space-y-6">
                    {aside}
                </div>
            </aside>
        </div>
    )
}
