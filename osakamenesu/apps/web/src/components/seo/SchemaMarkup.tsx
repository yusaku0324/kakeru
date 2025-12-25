import { serializeStructuredData } from '@/lib/seo/structured-data'

interface SchemaMarkupProps {
  data: any | any[]
}

/**
 * Component to render JSON-LD structured data
 */
export default function SchemaMarkup({ data }: SchemaMarkupProps) {
  if (!data) return null

  // Support multiple schemas
  const schemas = Array.isArray(data) ? data : [data]

  return (
    <>
      {schemas.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeStructuredData(schema),
          }}
        />
      ))}
    </>
  )
}