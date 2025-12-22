import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/Card'

export default function TherapistNotFound() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <Card>
          <div className="p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              セラピストが見つかりません
            </h2>
            <p className="text-gray-600 mb-6">
              お探しのセラピストは存在しないか、別の店舗に移動した可能性があります。
            </p>
            <Link href="/search">
              <Button variant="outline">
                <ChevronLeft className="w-4 h-4 mr-2" />
                検索に戻る
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
