export type PricingItem = {
  title: string
  duration: string | null
  price: string | null
  durationMinutes: number | null
}

export function parsePricingText(source?: string | null): PricingItem[] {
  if (!source) return []

  return source
    .split(/[／/]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part, index) => {
      const priceMatch = part.match(/¥[\d,]+|[0-9]+(?:,?[0-9]{3})*円/)
      const durationMatch = part.match(/[0-9]+分/)
      const price = priceMatch?.[0]?.replace(/円$/, '円') ?? null
      const duration = durationMatch?.[0] ?? null
      const durationMinutes = duration ? Number.parseInt(duration.replace(/\D/g, ''), 10) || null : null
      let title = part
      if (price) title = title.replace(price, '').trim()
      if (duration) title = title.replace(duration, '').trim()
      title = title.replace(/[()（）]/g, '').trim()
      if (!title) title = `コース ${index + 1}`
      return { title, duration, price, durationMinutes }
    })
}
