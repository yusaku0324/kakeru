import Link from 'next/link'

import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Section } from '@/components/ui/Section'

export default function ApplyPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <Section
        title="掲載のご案内"
        subtitle="PR枠・特集枠の申し込みはこちらから"
        className="shadow-none border border-neutral-borderLight bg-neutral-surface"
        actions={<Badge variant="outline">現在キャンペーン中</Badge>}
      >
        <div className="space-y-4 text-sm leading-relaxed text-neutral-text">
          <p>
            大阪メンエス.com では、CityHeaven
            同等の露出設計でユーザーの集客導線を最適化します。PR枠への掲載をご希望の店舗様は、下記の概要をご確認のうえお問い合わせください。
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <Card className="space-y-2">
              <h3 className="text-sm font-semibold text-neutral-text">プランラインナップ</h3>
              <ul className="space-y-1 text-sm text-neutral-textMuted">
                <li>・検索一覧でのPR表示（上位3枠）</li>
                <li>・特集ページでのピックアップ掲載</li>
                <li>・メルマガ/LINE配信でのスポット送客</li>
              </ul>
            </Card>
            <Card className="space-y-2">
              <h3 className="text-sm font-semibold text-neutral-text">ご準備いただくもの</h3>
              <ul className="space-y-1 text-sm text-neutral-textMuted">
                <li>・店舗情報と連絡先</li>
                <li>・掲載用の写真、PRテキスト</li>
                <li>・割引/キャンペーン情報（任意）</li>
              </ul>
            </Card>
          </div>
        </div>
      </Section>

      <Card className="space-y-4 border-dashed border-brand-primary/40 bg-brand-primary/5 p-6">
        <h2 className="text-lg font-semibold text-neutral-text">お問い合わせ</h2>
        <p className="text-sm text-neutral-textMuted">
          掲載プラン・料金・運用フローについて、担当コンシェルジュが24時間以内にご連絡いたします。
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="mailto:info@osaka-menesu.com"
            className="inline-flex items-center rounded-badge bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-primaryDark"
          >
            メールで問い合わせる
          </a>
          <a
            href="https://lin.ee/placeholder"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-badge border border-brand-primary/30 bg-neutral-surface px-4 py-2 text-sm font-semibold text-brand-primaryDark hover:bg-brand-primary/10"
          >
            LINEで相談する
          </a>
        </div>
        <p className="text-xs text-neutral-textMuted">
          * 既にアカウントをお持ちの場合は、管理画面から直接お申し込みいただけます。
        </p>
      </Card>

      <div className="text-center text-sm">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-brand-primaryDark underline-offset-2 hover:underline"
        >
          トップページへ戻る
        </Link>
      </div>
    </main>
  )
}
