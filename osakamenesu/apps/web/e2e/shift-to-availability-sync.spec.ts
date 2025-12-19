import { test, expect, TestInfo, Page } from '@playwright/test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  normalizeTimeToMinutes,
  minutesToTimeString,
  areTimesEqual,
  formatTimeJST,
} from '../src/lib/time-normalize'

/**
 * シフト登録と公開カレンダーの整合性テスト
 *
 * 目的：管理画面にシフトが登録されている場合、
 *       公開カレンダーに必ず空き枠（●/△）が表示されることを保証する
 *
 * ゴールデンケースの設計原則（v2 - 本番障害見逃し防止版）:
 * - SKIPは「本日候補が0件」の場合のみ（本番データ事情）
 * - 候補が1件でも取れたら、必ずPASSかFAILで終わる
 * - FAILは障害種別(INFRA/A/B/C)で分類し、Step Summary先頭に表示
 *
 * FAILカテゴリ定義:
 * - INFRA: 本番障害/到達不能（5xx, 4xx継続, タイムアウト）
 * - A層: API/生成層の契約違反（7日構造不整合, open/tentative=0）
 * - B層: UI変換層の契約違反（UIスロット=0）
 * - C層: 表示層の契約違反（data属性違反, 最短時刻不一致）
 *
 * 時刻比較は共有モジュール（time-normalize.ts）を使用し、分単位の数値で正規化
 */

const BASE_URL = process.env.E2E_BASE_URL || 'https://osakamenesu-web.vercel.app'

// ゴールデンケース候補探索の設定
const GOLDEN_CANDIDATE_CONFIG = {
  maxCandidates: 3,           // 最大試行候補数
  minOpenSlots: 1,            // 最低必要なopen/tentativeスロット数
  requiredDays: 7,            // API応答で期待する日数
}

// 「本日 HH:MM〜」ラベル検出用（末尾の「〜」は任意）
const TODAY_LABEL_REGEX = /本日\s*\d{1,2}:\d{2}〜?/

/**
 * FAILカテゴリ（障害種別）
 * INFRA: 本番障害/到達不能（5xx, 4xx継続, タイムアウト）
 * A: API/生成層の契約違反（7日構造不整合, open/tentative=0）
 * B: UI変換層の契約違反（UIスロット=0）
 * C: 表示層の契約違反（data属性違反, 最短時刻不一致）
 */
type FailCategory = 'INFRA' | 'A' | 'B' | 'C'

/**
 * 候補ごとの検証結果
 */
type CandidateResult = {
  name: string
  therapistId: string | null
  outcome: 'PASS' | 'FAIL'
  failCategory: FailCategory | null
  failReason: string | null
  confidence: 'high' | 'medium' | 'low' | null
  apiStatusCode: number | null  // INFRAカテゴリの判定用
}

/**
 * 候補セラピストの情報
 */
type CandidateTherapist = {
  name: string
  cardElement: ReturnType<Page['locator']>
  hasTodayLabel: boolean
  todayLabelText: string | null
}

/**
 * 候補探索の結果
 */
type CandidateSearchResult = {
  found: boolean
  candidates: CandidateTherapist[]
  skipReason: string | null
  // SKIP時の探索ログ
  searchLog: {
    cardCount: number
    cardNames: string[]  // 最大10件
    todayLabelDetectionResults: Array<{
      name: string
      detected: boolean
      labelText: string | null
      reason: string | null  // 検出できなかった理由
    }>
  }
}

/**
 * 「本日」ラベルを持つセラピスト候補を探索
 *
 * 探索アルゴリズム:
 * 1. /search?tab=therapists&today=1 にアクセス（本日空きありフィルタ）
 * 2. 各カードで「本日 HH:MM〜」ラベルの有無を確認
 *    - 正規表現: /本日\s*\d{1,2}:\d{2}〜/（末尾の「〜」は任意）
 *    - data-testid="today-label" があればそちら優先
 * 3. ラベルがあるカードを候補リストに追加
 * 4. 最大3候補まで収集
 *
 * @returns 候補リストとスキップ理由、探索ログ
 */
async function findGoldenCandidates(page: Page): Promise<CandidateSearchResult> {
  const candidates: CandidateTherapist[] = []
  const cardNames: string[] = []
  const todayLabelDetectionResults: CandidateSearchResult['searchLog']['todayLabelDetectionResults'] = []

  // 検索ページにアクセス（today=1 で本日空きありフィルタ）
  const searchUrl = `${BASE_URL}/search?tab=therapists&today=1`
  console.log(`[候補探索] ${searchUrl} にアクセス`)
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' })

  // ネットワーク安定化を待機（固定sleepではなくポーリング）
  await expect(async () => {
    const cards = page.locator('article')
    const count = await cards.count()
    expect(count).toBeGreaterThan(0)
  }).toPass({ timeout: 15000 }).catch(() => {
    // カードが0件の場合もエラーにしない（正当なSKIP条件）
  })

  // セラピストカードを取得
  const therapistCards = page.locator('[data-testid="therapist-card"]')
  const cardCount = await therapistCards.count()

  if (cardCount === 0) {
    return {
      found: false,
      candidates: [],
      skipReason: '検索結果にセラピストカードが存在しない (today=1 フィルタで0件)',
      searchLog: {
        cardCount: 0,
        cardNames: [],
        todayLabelDetectionResults: [],
      },
    }
  }

  console.log(`[候補探索] ${cardCount}件のセラピストカードを発見`)

  // 各カードをチェック（最大10件までログ、候補は最大3件）
  const maxLogCards = Math.min(cardCount, 10)
  for (let i = 0; i < cardCount; i++) {
    const card = therapistCards.nth(i)
    const fallbackName = `card#${i + 1}`

    // カードが表示されているか確認
    const isVisible = await card.isVisible().catch(() => false)
    if (!isVisible) {
      if (i < maxLogCards) {
        cardNames.push(fallbackName)
        todayLabelDetectionResults.push({
          name: fallbackName,
          detected: false,
          labelText: null,
          reason: 'カードが非表示のためラベル判定不可',
        })
      }
      continue
    }

    // セラピスト名を取得
    const nameElement = card.locator('h3').first()
    const name = await nameElement.textContent().catch(() => null)
    const trimmedName = name?.trim() || fallbackName

    if (!name) {
      if (i < maxLogCards) {
        cardNames.push(trimmedName)
        todayLabelDetectionResults.push({
          name: trimmedName,
          detected: false,
          labelText: null,
          reason: 'セラピスト名を取得できずラベル判定不可',
        })
      }
      continue
    }

    if (i < maxLogCards) {
      cardNames.push(trimmedName)
    }

    // 「本日」ラベルを探す
    // 優先度1: data-testid="today-label"
    // 優先度2: テキストマッチ（正規表現）
    let hasTodayLabel = false
    let labelText: string | null = null
    let detectionReason: string | null = null

    // data-testid で探す
    const todayLabelByTestId = card.getByTestId('today-label')
    const hasTestIdLabel = await todayLabelByTestId.isVisible().catch(() => false)

    if (hasTestIdLabel) {
      hasTodayLabel = true
      labelText = await todayLabelByTestId.textContent().catch(() => null)
      detectionReason = 'data-testid="today-label" で検出'
    } else {
      // テキストマッチで探す（正規表現: 本日 + 時刻）
      const todayLabelByText = card.getByText(TODAY_LABEL_REGEX)
      const hasTextLabel = await todayLabelByText.isVisible().catch(() => false)

      if (hasTextLabel) {
        hasTodayLabel = true
        labelText = await todayLabelByText.textContent().catch(() => null)
        detectionReason = '正規表現 /本日\\s*\\d{1,2}:\\d{2}〜?/ で検出'
      } else {
        // 検出できなかった理由を調査
        const allTexts = await card.allTextContents().catch(() => [])
        const joined = allTexts.join(' ')
        if (joined.includes('本日')) {
          detectionReason = `「本日」テキストは存在するが時刻パターンが見つからない (text: "${joined.slice(0, 100)}...")`
        } else {
          detectionReason = `「本日」テキストがカード内に存在しない`
        }
      }
    }

    // ログに記録（最大10件）
    if (i < maxLogCards) {
      todayLabelDetectionResults.push({
        name: trimmedName,
        detected: hasTodayLabel,
        labelText,
        reason: detectionReason,
      })
    }

    // 候補として追加（最大3件）
    if (hasTodayLabel && candidates.length < GOLDEN_CANDIDATE_CONFIG.maxCandidates) {
      candidates.push({
        name: trimmedName,
        cardElement: card,
        hasTodayLabel: true,
        todayLabelText: labelText,
      })
      console.log(`[候補探索] 候補発見: ${trimmedName} - ${labelText} (${detectionReason})`)
    }
  }

  const searchLog = {
    cardCount,
    cardNames,
    todayLabelDetectionResults,
  }

  if (candidates.length === 0) {
    return {
      found: false,
      candidates: [],
      skipReason: `「本日」ラベルを持つセラピストが見つからない (today=1 フィルタ、検索カード数: ${cardCount})`,
      searchLog,
    }
  }

  return {
    found: true,
    candidates,
    skipReason: null,
    searchLog,
  }
}

// JST timezone formatter (matches server-side logic)
const jstDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function getTodayJST(): string {
  return jstDateFormatter.format(new Date())
}

/**
 * 障害レイヤー分類
 * A: API/生成層 - シフトから空き枠を生成する段階の問題
 * B: UI変換層 - APIレスポンスをUIコンポーネントに変換する段階の問題
 * C: 表示層 - DOMレンダリング・data属性の問題
 */
type FaultLayer = 'A' | 'B' | 'C' | 'OK'

type LayerDiagnosis = {
  layer: FaultLayer
  confidence: 'high' | 'medium' | 'low'
  reason: string
}

type AvailabilitySlot = {
  start_at: string
  end_at: string
  status: 'open' | 'tentative' | 'blocked'
}

type AvailabilityDay = {
  date: string
  is_today: boolean
  slots: AvailabilitySlot[]
}

type AvailabilityResponse = {
  days: AvailabilityDay[]
}

// UIスロットの正規化済み時刻データ
type UISlotData = {
  date: string
  startMinutes: number
  startAt: string | null
  testId: string
}

/**
 * Data属性契約違反の詳細
 */
type DataAttributeViolation = {
  slotIndex: number
  testId: string
  violations: string[]
}

/**
 * Data属性の契約検証結果
 */
type DataAttributeContractResult = {
  valid: boolean
  totalSlots: number
  validSlots: number
  violations: DataAttributeViolation[]
}

/**
 * スロットのdata属性が契約に準拠しているか検証
 *
 * 契約:
 * - data-start-minutes: number (NaN不可, 0以上)
 * - data-date: YYYY-MM-DD 形式
 * - data-start-at: ISO string (存在する場合)
 */
function validateDataAttributeContract(
  date: string | null,
  startMinutesStr: string | null,
  startAt: string | null,
  testId: string
): string[] {
  const violations: string[] = []

  // data-date の検証
  if (!date) {
    violations.push('data-date が存在しない')
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    violations.push(`data-date が YYYY-MM-DD 形式でない: "${date}"`)
  }

  // data-start-minutes の検証
  if (startMinutesStr === null || startMinutesStr === '') {
    violations.push('data-start-minutes が存在しない')
  } else {
    const startMinutes = parseInt(startMinutesStr, 10)
    if (Number.isNaN(startMinutes)) {
      violations.push(`data-start-minutes がNaN: "${startMinutesStr}"`)
    } else if (startMinutes < 0) {
      violations.push(`data-start-minutes が負の値: ${startMinutes}`)
    } else if (startMinutes > 1439) {
      violations.push(`data-start-minutes が範囲外: ${startMinutes} (0-1439)`)
    }
  }

  // data-start-at の検証（存在する場合のみ）
  if (startAt !== null && startAt !== '') {
    // ISO文字列かどうかを検証
    const parsed = new Date(startAt)
    if (Number.isNaN(parsed.getTime())) {
      violations.push(`data-start-at が有効なISO文字列でない: "${startAt}"`)
    }
  }

  return violations
}

type DiagnosticInfo = {
  testName: string
  timestamp: string
  todayJST: string
  therapistId: string | null
  cardLabel: string | null
  cardEarliestTime: string | null
  apiResponse: AvailabilityResponse | null
  apiUrl: string | null
  apiEarliestSlot: AvailabilitySlot | null
  uiSlotCounts: {
    available: number
    pending: number
    blocked: number
  }
  uiEarliestSlotTime: string | null
  uiSlots: UISlotData[]  // UIから抽出した全スロットデータ
  failures: string[]
  diagnosis: LayerDiagnosis | null
  dataAttributeContract: DataAttributeContractResult | null  // 契約検証結果
}

/**
 * UIスロットのdata属性契約を一括検証
 */
function validateAllDataAttributeContracts(uiSlots: UISlotData[]): DataAttributeContractResult {
  const violations: DataAttributeViolation[] = []
  let validSlots = 0

  for (let i = 0; i < uiSlots.length; i++) {
    const slot = uiSlots[i]
    const slotViolations = validateDataAttributeContract(
      slot.date,
      slot.startMinutes >= 0 ? String(slot.startMinutes) : null,
      slot.startAt,
      slot.testId
    )

    if (slotViolations.length > 0) {
      violations.push({
        slotIndex: i,
        testId: slot.testId,
        violations: slotViolations,
      })
    } else {
      validSlots++
    }
  }

  return {
    valid: violations.length === 0,
    totalSlots: uiSlots.length,
    validSlots,
    violations,
  }
}

/**
 * A/B/C層の障害診断を行う
 */
function diagnoseFailureLayer(info: DiagnosticInfo): LayerDiagnosis {
  const todayJST = info.todayJST
  const apiTodayData = info.apiResponse?.days?.find((d) => d.is_today || d.date === todayJST)
  const apiOpenSlots = apiTodayData?.slots?.filter((s) => s.status === 'open' || s.status === 'tentative') || []
  const apiMinSlot = apiOpenSlots.length > 0
    ? apiOpenSlots.sort((a, b) => normalizeTimeToMinutes(a.start_at) - normalizeTimeToMinutes(b.start_at))[0]
    : null
  const apiMinMinutes = apiMinSlot ? normalizeTimeToMinutes(apiMinSlot.start_at) : -1

  // UIの最短スロット（data-start-minutes から取得）
  const uiTodaySlots = info.uiSlots.filter((s) => s.date === todayJST && s.startMinutes >= 0)
  const uiMinMinutes = uiTodaySlots.length > 0
    ? Math.min(...uiTodaySlots.map((s) => s.startMinutes))
    : -1

  const totalUIBookable = info.uiSlotCounts.available + info.uiSlotCounts.pending

  // C層 (最優先): data属性の契約違反を検出
  if (info.dataAttributeContract && !info.dataAttributeContract.valid) {
    const violationCount = info.dataAttributeContract.violations.length
    const firstViolation = info.dataAttributeContract.violations[0]
    return {
      layer: 'C',
      confidence: 'high',
      reason: `data属性契約違反: ${violationCount}件のスロットで契約違反 (例: ${firstViolation?.violations[0] || 'N/A'}) → DOM/data属性の実装バグ`,
    }
  }

  // A層: APIにopen/tentativeスロットがない
  if (info.cardLabel?.includes('本日') && apiOpenSlots.length === 0) {
    return {
      layer: 'A',
      confidence: 'high',
      reason: 'カードには「本日」表示があるが、APIのopen/tentativeスロットが0件 → シフト→空き枠生成の問題',
    }
  }

  // B層: APIにはあるがUIのカウントが0
  if (apiOpenSlots.length > 0 && totalUIBookable === 0) {
    return {
      layer: 'B',
      confidence: 'high',
      reason: `APIに${apiOpenSlots.length}件のopen/tentativeスロットがあるが、UIの●/△カウントが0 → UI変換層の問題`,
    }
  }

  // C層: カウントはあるが、時刻が不一致
  if (apiMinMinutes >= 0 && uiMinMinutes >= 0 && apiMinMinutes !== uiMinMinutes) {
    return {
      layer: 'C',
      confidence: 'medium',
      reason: `API最短時刻(${minutesToTimeString(apiMinMinutes)})とUI最短時刻(${minutesToTimeString(uiMinMinutes)})が不一致 → 表示層またはdata属性の問題`,
    }
  }

  // C層: UIスロットのdata-start-minutesが取得できない
  if (totalUIBookable > 0 && uiTodaySlots.length === 0) {
    return {
      layer: 'C',
      confidence: 'low',
      reason: 'UIにスロットは表示されているが、data-start-minutes属性が取得できない → DOM描画の問題の可能性',
    }
  }

  // 問題なし
  return {
    layer: 'OK',
    confidence: 'high',
    reason: '正常: API→UI変換に問題なし',
  }
}

/**
 * 診断情報をGitHub Actions Step Summaryに出力
 * 最初の5秒で原因レイヤーが分かる形式:
 * - 先頭に A/B/C 障害レイヤー判定
 * - 短いサマリ（6行以内）
 * - 最小差分情報
 * - 詳細は折りたたみ
 */
function writeDiagnosticSummary(info: DiagnosticInfo, testInfo: TestInfo) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY

  // 診断を実行
  const diagnosis = info.diagnosis || diagnoseFailureLayer(info)
  info.diagnosis = diagnosis

  const status = diagnosis.layer === 'OK' ? '✅ PASS' : '❌ FAIL'
  const failureList = info.failures.map((f) => `- ${f}`).join('\n')

  // API slots count
  const apiTodayData = info.apiResponse?.days?.find((d) => d.is_today || d.date === info.todayJST)
  const apiOpenSlots = apiTodayData?.slots?.filter((s) => s.status === 'open' || s.status === 'tentative') || []
  const apiBlockedSlots = apiTodayData?.slots?.filter((s) => s.status === 'blocked') || []
  const apiOpenCount = apiOpenSlots.length
  const apiBlockedCount = apiBlockedSlots.length

  // API最短時刻（正規化済み）
  const apiMinSlot = apiOpenSlots.length > 0
    ? apiOpenSlots.sort((a, b) => normalizeTimeToMinutes(a.start_at) - normalizeTimeToMinutes(b.start_at))[0]
    : null
  const apiMinMinutes = apiMinSlot ? normalizeTimeToMinutes(apiMinSlot.start_at) : -1
  const apiMinTime = apiMinMinutes >= 0 ? minutesToTimeString(apiMinMinutes) : 'N/A'

  // UI最短時刻（data-start-minutes から取得）
  const uiTodaySlots = info.uiSlots.filter((s) => s.date === info.todayJST && s.startMinutes >= 0)
  const uiMinMinutes = uiTodaySlots.length > 0
    ? Math.min(...uiTodaySlots.map((s) => s.startMinutes))
    : -1
  const uiMinTime = uiMinMinutes >= 0 ? minutesToTimeString(uiMinMinutes) : (info.uiEarliestSlotTime || 'N/A')

  // 時刻一致判定
  const timesMatch = apiMinMinutes >= 0 && uiMinMinutes >= 0 ? apiMinMinutes === uiMinMinutes : null
  const timeMatchIcon = timesMatch === null ? '⚠️' : timesMatch ? '✅' : '❌'

  // A/B/C レイヤー判定結果
  const layerIcon = {
    'A': '🔴 A層(API/生成)',
    'B': '🟠 B層(UI変換)',
    'C': '🟡 C層(表示)',
    'OK': '🟢 正常',
  }[diagnosis.layer]

  const confidenceIcon = {
    'high': '確度:高',
    'medium': '確度:中',
    'low': '確度:低',
  }[diagnosis.confidence]

  // === 先頭サマリ（最初の5秒で分かる形式）===
  const quickSummary = `
## ${status} Shift-Availability Sync: ${info.testName}

### 🎯 障害レイヤー判定: ${layerIcon} (${confidenceIcon})
> ${diagnosis.reason}

| 項目 | 値 |
|------|-----|
| **therapist_id** | \`${info.therapistId || 'N/A'}\` |
| **jst_today** | ${info.todayJST} |
| **api_slots** | open=${apiOpenCount}, blocked=${apiBlockedCount} |
| **ui_slots** | ●=${info.uiSlotCounts.available}, △=${info.uiSlotCounts.pending}, ×=${info.uiSlotCounts.blocked} |
| **min_api_time** | ${apiMinTime} (${apiMinMinutes}分) |
| **min_ui_time** | ${uiMinTime} (${uiMinMinutes}分) ${timeMatchIcon} |
| **data属性契約** | ${info.dataAttributeContract ? `${info.dataAttributeContract.valid ? '✅' : '❌'} (${info.dataAttributeContract.validSlots}/${info.dataAttributeContract.totalSlots} valid)` : 'N/A'} |

${info.failures.length > 0 ? `### ❌ Failures\n${failureList}\n` : ''}
`

  // === 最小差分情報 ===
  const minDiffSection = `
### 📊 最小差分（API vs UI）

| day | API min (分) | UI min (分) | 一致 |
|-----|-------------|------------|-----|
${info.apiResponse?.days?.map((day) => {
  const dayApiSlots = day.slots?.filter((s) => s.status === 'open' || s.status === 'tentative') || []
  const dayApiMin = dayApiSlots.length > 0
    ? Math.min(...dayApiSlots.map((s) => normalizeTimeToMinutes(s.start_at)))
    : -1
  const dayUISlots = info.uiSlots.filter((s) => s.date === day.date && s.startMinutes >= 0)
  const dayUIMin = dayUISlots.length > 0
    ? Math.min(...dayUISlots.map((s) => s.startMinutes))
    : -1
  const match = dayApiMin >= 0 && dayUIMin >= 0
    ? (dayApiMin === dayUIMin ? '✅' : '❌')
    : '⚠️'
  const dayLabel = day.is_today ? `**${day.date}** (今日)` : day.date
  return `| ${dayLabel} | ${dayApiMin >= 0 ? `${minutesToTimeString(dayApiMin)} (${dayApiMin})` : 'N/A'} | ${dayUIMin >= 0 ? `${minutesToTimeString(dayUIMin)} (${dayUIMin})` : 'N/A'} | ${match} |`
}).join('\n') || '(データなし)'}

`

  // === 詳細は折りたたみ ===
  const details = `
<details>
<summary>詳細情報（Card / API / UI）</summary>

### Card Info
- **Label:** ${info.cardLabel || 'N/A'}
- **Earliest Time:** ${info.cardEarliestTime || 'N/A'}

### API Info
- **URL:** \`${info.apiUrl || 'N/A'}\`
- **Earliest Open Slot:** ${apiMinSlot ? `${formatTimeJST(apiMinSlot.start_at)} (${apiMinSlot.status})` : 'N/A'}

### UI Slot Counts
- **Available (●):** ${info.uiSlotCounts.available}
- **Pending (△):** ${info.uiSlotCounts.pending}
- **Blocked (×):** ${info.uiSlotCounts.blocked}
- **UI Earliest Slot Time:** ${info.uiEarliestSlotTime || 'N/A'}

### UI Slots Data (data-start-minutes)
\`\`\`json
${JSON.stringify(info.uiSlots.slice(0, 20), null, 2)}${info.uiSlots.length > 20 ? `\n... and ${info.uiSlots.length - 20} more` : ''}
\`\`\`

### Timestamp
${info.timestamp}

</details>

<details>
<summary>Full API Response (JSON)</summary>

\`\`\`json
${JSON.stringify(info.apiResponse, null, 2)}
\`\`\`

</details>

---
`

  // 成功時は最小サマリ、失敗時は詳細サマリを出力
  const isSuccess = diagnosis.layer === 'OK'

  // === 成功時の最小サマリ ===
  const minimalSuccessSummary = `
## ${status} Shift-Availability Sync: ${info.testName}

| 項目 | 値 |
|------|-----|
| **therapist_id** | \`${info.therapistId || 'N/A'}\` |
| **jst_today** | ${info.todayJST} |
| **api_slots** | open=${apiOpenCount}, blocked=${apiBlockedCount} |
| **ui_slots** | ●=${info.uiSlotCounts.available}, △=${info.uiSlotCounts.pending} |
| **min_api_time** | ${apiMinTime} |
| **min_ui_time** | ${uiMinTime} ${timeMatchIcon} |
| **data属性契約** | ${info.dataAttributeContract ? `${info.dataAttributeContract.valid ? '✅' : '❌'} (${info.dataAttributeContract.validSlots}/${info.dataAttributeContract.totalSlots})` : 'N/A'} |

---
`

  const fullSummary = quickSummary + minDiffSection + details
  const summaryToWrite = isSuccess ? minimalSuccessSummary : fullSummary

  // GitHub Actions Step Summary に出力
  if (summaryPath) {
    try {
      fs.appendFileSync(summaryPath, summaryToWrite)
    } catch {
      console.log('Could not write to GITHUB_STEP_SUMMARY')
    }
  }

  // ローカルファイルにも出力（デバッグ用）- 失敗時のみ
  if (!isSuccess) {
    const localPath = path.join('e2e', 'test-results', `diagnostic-${Date.now()}.md`)
    try {
      fs.mkdirSync(path.dirname(localPath), { recursive: true })
      fs.writeFileSync(localPath, fullSummary)
    } catch {
      // ignore
    }
  }

  // コンソール出力（成功時は短く、失敗時は詳細）
  if (isSuccess) {
    console.log(`\n✅ PASS: ${info.testName}`)
    console.log(`  therapist_id=${info.therapistId || 'N/A'} | api=${apiOpenCount} | ui=${info.uiSlotCounts.available}+${info.uiSlotCounts.pending} | min=${apiMinTime}/${uiMinTime}`)
  } else {
    console.log('\n=== Quick Summary ===')
    console.log(`Status: ${status}`)
    console.log(`Layer: ${layerIcon} (${confidenceIcon})`)
    console.log(`Reason: ${diagnosis.reason}`)
    console.log(`therapist_id: ${info.therapistId || 'N/A'}`)
    console.log(`jst_today: ${info.todayJST}`)
    console.log(`api_slots: open=${apiOpenCount}, blocked=${apiBlockedCount}`)
    console.log(`ui_slots: ●=${info.uiSlotCounts.available}, △=${info.uiSlotCounts.pending}`)
    console.log(`min_api_time: ${apiMinTime} (${apiMinMinutes}分)`)
    console.log(`min_ui_time: ${uiMinTime} (${uiMinMinutes}分) ${timeMatchIcon}`)
  }
}

/**
 * ゴールデンケースの検証結果
 */
type GoldenCaseVerificationResult = {
  candidateName: string
  therapistId: string | null
  passed: boolean
  invariantChecks: {
    apiStructure: boolean      // API応答が7日構造を持つ
    apiHasSlots: boolean       // APIに1つ以上のopen/tentativeスロットがある
    uiHasSlots: boolean        // UIに1つ以上の●/△がある
    timeMatch: boolean         // 最短時刻が一致
    contractValid: boolean     // data属性契約が有効
  }
  diagnostic: DiagnosticInfo
}

/**
 * スキップ時のStep Summary出力
 * 注意: SKIPは「本日」候補が0件の場合のみ許可される
 */
function writeSkipSummary(
  testName: string,
  reason: string,
  searchLog: CandidateSearchResult['searchLog'],
  todayJST: string
) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY
  const detectedCount = searchLog.todayLabelDetectionResults.filter((r) => r.detected).length
  const cardNames = searchLog.cardNames.length > 0 ? searchLog.cardNames.join(', ') : 'なし'
  const detectionLog = searchLog.todayLabelDetectionResults.length > 0
    ? searchLog.todayLabelDetectionResults.map((r, idx) => {
        const status = r.detected ? '✅ detected' : '❌ not detected'
        const label = r.labelText ? ` (${r.labelText.trim()})` : ''
        const reasonText = r.reason ? ` - ${r.reason}` : ''
        return `- [${idx + 1}] ${r.name}: ${status}${label}${reasonText}`
      }).join('\n')
    : `- 本日ラベル判定ログなし（カード数=${searchLog.cardCount}）`

  // 長すぎるログを折りたたみ（5件を超える場合は折りたたみ）
  const needsCollapse = searchLog.todayLabelDetectionResults.length > 5
  const logForSummary = needsCollapse
    ? searchLog.todayLabelDetectionResults.slice(0, 5).map((r, idx) => {
        const status = r.detected ? '✅ detected' : '❌ not detected'
        const label = r.labelText ? ` (${r.labelText.trim()})` : ''
        const reasonText = r.reason ? ` - ${r.reason}` : ''
        return `- [${idx + 1}] ${r.name}: ${status}${label}${reasonText}`
      }).join('\n') + `\n- ... and ${searchLog.todayLabelDetectionResults.length - 5} more (see console)`
    : detectionLog

  const skipSummary = `
## Outcome: ⏭️ SKIP

**${testName}**

### スキップ理由（データ事情）
> ${reason}

| 項目 | 値 |
|------|-----|
| **jst_today** | ${todayJST} |
| **「本日」候補数** | ${detectedCount} |
| **探索カード数** | ${searchLog.cardCount} |
| **カード名 (最大10件)** | ${cardNames} |
| **備考** | 本番データ事情によるスキップ（障害ではない） |

### 探索ログ（本日ラベル判定）
${logForSummary}
${needsCollapse ? '\\n(残りのログはコンソール出力を参照)' : ''}

---
`

  if (summaryPath) {
    try {
      fs.appendFileSync(summaryPath, skipSummary)
    } catch {
      console.log('Could not write to GITHUB_STEP_SUMMARY')
    }
  }

  console.log(`\n⏭️ SKIP: ${testName}`)
  console.log(`  理由: ${reason}`)
  console.log(`  候補数: ${detectedCount}`)
  console.log(`  探索カード数: ${searchLog.cardCount}`)
  console.log(`  カード名 (最大10件): ${cardNames}`)
  console.log('  本日ラベル検出ログ:')
  console.log(logForSummary)
}

/**
 * ゴールデンケース成功時のStep Summary出力
 */
function writeGoldenPassSummary(testName: string, result: GoldenCaseVerificationResult, todayJST: string) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY

  const checks = result.invariantChecks
  const checkIcons = {
    apiStructure: checks.apiStructure ? '✅' : '❌',
    apiHasSlots: checks.apiHasSlots ? '✅' : '❌',
    uiHasSlots: checks.uiHasSlots ? '✅' : '❌',
    timeMatch: checks.timeMatch ? '✅' : '❌',
    contractValid: checks.contractValid ? '✅' : '❌',
  }

  const passSummary = `
## Outcome: ✅ PASS

**${testName}**

| 項目 | 値 |
|------|-----|
| **候補** | ${result.candidateName} |
| **therapist_id** | \`${result.therapistId || 'N/A'}\` |
| **jst_today** | ${todayJST} |

### 不変条件チェック
| チェック項目 | 結果 |
|-------------|------|
| API 7日構造 | ${checkIcons.apiStructure} |
| API open/tentative ≥1 | ${checkIcons.apiHasSlots} |
| UI ●/△ ≥1 | ${checkIcons.uiHasSlots} |
| 最短時刻一致 | ${checkIcons.timeMatch} |
| data属性契約 | ${checkIcons.contractValid} |

---
`

  if (summaryPath) {
    try {
      fs.appendFileSync(summaryPath, passSummary)
    } catch {
      console.log('Could not write to GITHUB_STEP_SUMMARY')
    }
  }

  console.log(`\n✅ PASS: ${testName}`)
  console.log(`  候補: ${result.candidateName}`)
  console.log(`  therapist_id: ${result.therapistId || 'N/A'}`)
}

/**
 * 全候補失敗時のStep Summary出力（FAIL - skipではない）
 */
function writeAllCandidatesFailedSummary(
  testName: string,
  candidateResults: CandidateResult[],
  todayJST: string
) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY

  // 最も深刻なカテゴリを特定（INFRA > A > B > C）
  const categoryPriority: Record<FailCategory, number> = { INFRA: 0, A: 1, B: 2, C: 3 }
  const failedWithCategory = candidateResults.filter((r) => r.outcome === 'FAIL' && r.failCategory)
  const worstCategory = failedWithCategory.length > 0
    ? failedWithCategory.sort((a, b) =>
        (categoryPriority[a.failCategory!] || 99) - (categoryPriority[b.failCategory!] || 99)
      )[0]
    : null

  const categoryLabel: Record<FailCategory, string> = {
    INFRA: '🔴 INFRA(本番障害)',
    A: '🟠 A層(API/生成)',
    B: '🟡 B層(UI変換)',
    C: '🔵 C層(表示)',
  }

  const primaryFailLabel = worstCategory?.failCategory
    ? categoryLabel[worstCategory.failCategory]
    : '不明'
  const primaryFailReason = worstCategory?.failReason || '詳細不明'
  const primaryConfidence = worstCategory?.confidence || 'low'

  const candidateTable = candidateResults.map((r, i) => {
    const categoryIcon = r.failCategory ? categoryLabel[r.failCategory] : 'N/A'
    const statusIcon = r.outcome === 'PASS' ? '✅' : '❌'
    const httpStatus = r.apiStatusCode !== null ? `HTTP ${r.apiStatusCode}` : 'N/A'
    return `| ${i + 1} | ${r.name} | ${statusIcon} | ${categoryIcon} | ${httpStatus} | ${r.failReason?.slice(0, 50) || 'N/A'} |`
  }).join('\n')

  const failSummary = `
## Outcome: ❌ FAIL

**${testName}**

### 🎯 主障害: ${primaryFailLabel} (確度: ${primaryConfidence})
> ${primaryFailReason}

| 項目 | 値 |
|------|-----|
| **jst_today** | ${todayJST} |
| **候補数** | ${candidateResults.length} |
| **全候補失敗** | Yes - 全${candidateResults.length}候補で検証失敗 |

### 候補別結果
| # | 候補名 | 結果 | カテゴリ | HTTP | 理由 |
|---|--------|------|----------|------|------|
${candidateTable}

---
`

  if (summaryPath) {
    try {
      fs.appendFileSync(summaryPath, failSummary)
    } catch {
      console.log('Could not write to GITHUB_STEP_SUMMARY')
    }
  }

  console.log(`\n❌ FAIL: ${testName}`)
  console.log(`  全${candidateResults.length}候補で検証失敗`)
  console.log(`  主障害: ${primaryFailLabel} (${primaryConfidence})`)
  console.log(`  理由: ${primaryFailReason}`)
}

test.describe('シフト→公開カレンダー整合性テスト', () => {
  test.beforeEach(async ({ page }) => {
    // ネットワークリクエストをログ
    page.on('response', async (response) => {
      const url = response.url()
      if (url.includes('availability_slots')) {
        console.log(`[API Response] ${url}`)
        console.log(`  Status: ${response.status()}`)
        try {
          const json = await response.json()
          const days = json.days || []
          const totalSlots = days.reduce(
            (sum: number, day: AvailabilityDay) => sum + (day.slots?.length || 0),
            0
          )
          console.log(`  days.length: ${days.length}`)
          console.log(`  総slots数: ${totalSlots}`)
          if (days.length > 0) {
            console.log(`  先頭日: ${days[0].date}, slots: ${days[0].slots?.length || 0}`)
          }
        } catch {
          console.log('  Response body parsing failed')
        }
      }
    })
  })

  test('ゴールデンケース: 不変条件検証（自動候補探索）', async ({ page }, testInfo) => {
    const todayJST = getTodayJST()

    console.log('=== ゴールデンケース統合テスト開始（v2 - 本番障害見逃し防止版） ===')
    console.log(`Today (JST): ${todayJST}`)

    // Step 1: 候補探索
    console.log('\n[Step 1] 候補探索開始')
    const searchResult = await findGoldenCandidates(page)

    if (!searchResult.found) {
      // skip: 「本日」候補が0件（唯一のSKIP条件）
      writeSkipSummary(testInfo.title, searchResult.skipReason!, searchResult.searchLog, todayJST)
      test.skip(true, searchResult.skipReason!)
      return
    }

    console.log(`[候補探索] ${searchResult.candidates.length}件の候補を発見`)

    // Step 2: 候補を順番に試行（最大3候補）- 全結果を記録
    const candidateResults: CandidateResult[] = []
    let successResult: GoldenCaseVerificationResult | null = null

    for (let candidateIndex = 0; candidateIndex < searchResult.candidates.length; candidateIndex++) {
      const candidate = searchResult.candidates[candidateIndex]
      console.log(`\n[Step 2.${candidateIndex + 1}] 候補 "${candidate.name}" を検証中...`)

      try {
        const result = await verifyCandidateInvariantsV2(page, candidate, todayJST)

        candidateResults.push(result.candidateResult)

        if (result.verification.passed) {
          console.log(`[検証成功] 候補 "${candidate.name}" で全不変条件をパス`)
          successResult = result.verification
          break
        } else {
          console.log(`[検証失敗] 候補 "${candidate.name}" で不変条件違反あり - 次の候補を試行`)
        }
      } catch (error) {
        const errorMessage = (error as Error).message
        console.log(`[エラー] 候補 "${candidate.name}" でエラー発生: ${errorMessage}`)

        // エラーもCandidateResultとして記録
        candidateResults.push({
          name: candidate.name,
          therapistId: null,
          outcome: 'FAIL',
          failCategory: 'INFRA',
          failReason: `例外発生: ${errorMessage.slice(0, 100)}`,
          confidence: 'high',
          apiStatusCode: null,
        })

        // オーバーレイが開いていたら閉じる
        const dialog = page.getByRole('dialog')
        if (await dialog.isVisible().catch(() => false)) {
          await page.keyboard.press('Escape')
          await expect(dialog).not.toBeVisible({ timeout: 3000 }).catch(() => {})
        }
      }
    }

    // Step 3: 結果出力と判定
    // 候補が1件でも取れた以上、SKIP にはしない（必ず PASS か FAIL）

    if (successResult) {
      // PASS: 成功
      writeGoldenPassSummary(testInfo.title, successResult, todayJST)

      const checks = successResult.invariantChecks
      expect(checks.apiStructure, 'API応答が7日構造を持つこと').toBe(true)
      expect(checks.apiHasSlots, 'APIに1つ以上のopen/tentativeスロットがあること').toBe(true)
      expect(checks.uiHasSlots, 'UIに1つ以上の●/△があること').toBe(true)
      expect(checks.timeMatch, '最短時刻がAPIとUIで一致すること').toBe(true)
      expect(checks.contractValid, 'data属性契約が有効であること').toBe(true)
    } else {
      // FAIL: 全候補で失敗（skipにはしない - 本番障害の可能性）
      writeAllCandidatesFailedSummary(testInfo.title, candidateResults, todayJST)

      // 最初の失敗理由でアサーションを実行
      const firstFail = candidateResults.find((r) => r.outcome === 'FAIL')
      expect.fail(
        `全${candidateResults.length}候補で検証失敗\n` +
        `主障害: ${firstFail?.failCategory || 'N/A'}\n` +
        `理由: ${firstFail?.failReason || 'N/A'}`
      )
    }

    console.log('=== ゴールデンケース統合テスト完了 ===')
  })
})

/**
 * 候補の不変条件を検証（v2: CandidateResultを返す版）
 *
 * HTTPステータスコードを追跡し、INFRA/A/B/Cカテゴリで障害を分類
 *
 * @param page Playwrightページ
 * @param candidate 候補セラピスト
 * @param todayJST JST日付文字列
 * @returns 検証結果とCandidateResult
 */
async function verifyCandidateInvariantsV2(
  page: Page,
  candidate: CandidateTherapist,
  todayJST: string
): Promise<{ verification: GoldenCaseVerificationResult; candidateResult: CandidateResult }> {
  const diagnostic: DiagnosticInfo = {
    testName: `候補検証: ${candidate.name}`,
    timestamp: new Date().toISOString(),
    todayJST,
    therapistId: null,
    cardLabel: candidate.todayLabelText,
    cardEarliestTime: null,
    apiResponse: null,
    apiUrl: null,
    apiEarliestSlot: null,
    uiSlotCounts: { available: 0, pending: 0, blocked: 0 },
    uiEarliestSlotTime: null,
    uiSlots: [],
    failures: [],
    diagnosis: null,
    dataAttributeContract: null,
  }

  // カード時刻を抽出
  const timeMatch = candidate.todayLabelText?.match(/(\d{1,2}:\d{2})/)
  if (timeMatch) {
    diagnostic.cardEarliestTime = timeMatch[1]
  }

  // APIレスポンスをキャプチャ（ステータスコードも記録）
  let capturedApiResponse: AvailabilityResponse | null = null
  let capturedApiStatus: number | null = null
  const responseHandler = async (response: import('@playwright/test').Response) => {
    if (response.url().includes('availability_slots')) {
      capturedApiStatus = response.status()
      const match = response.url().match(/therapists\/([^/]+)\/availability_slots/)
      if (match) {
        diagnostic.therapistId = match[1]
      }
      diagnostic.apiUrl = response.url()

      if (response.status() === 200) {
        try {
          capturedApiResponse = await response.json()
        } catch {
          // JSON parse error
        }
      }
    }
  }
  page.on('response', responseHandler)

  try {
    // カードをスクロールして表示し、オーバーレイを開く
    await candidate.cardElement.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500) // スクロール完了を待つ

    // オーバーレイを開く（カード全体をクリック、またはCTAボタンをクリック）
    const cta = candidate.cardElement.getByTestId('therapist-cta')
    const ctaVisible = await cta.isVisible().catch(() => false)
    if (ctaVisible) {
      await cta.click()
    } else {
      // カード全体がクリック可能な場合
      await candidate.cardElement.click()
    }

    // オーバーレイの表示を待機
    // aria-labelにセラピスト名が含まれるダイアログを探す
    const dialogSelector = `[role="dialog"][aria-label*="${candidate.name}"]`
    const dialog = page.locator(dialogSelector).first()
    await expect(dialog).toBeVisible({ timeout: 15000 })

    // 「空き状況・予約」タブに切り替え、または「予約フォームを開く」ボタンをクリック
    const bookingTab = dialog.getByRole('tab', { name: /空き状況|予約/ })
    const openFormButton = dialog.getByRole('button', { name: /予約フォームを開く/ })

    if (await bookingTab.isVisible().catch(() => false)) {
      await bookingTab.click({ force: true })
      await page.waitForTimeout(500)
    } else if (await openFormButton.isVisible().catch(() => false)) {
      // ボタンをスクロールして表示し、forceでクリック
      await openFormButton.scrollIntoViewIfNeeded()
      await openFormButton.click({ force: true })
      await page.waitForTimeout(500)
    }

    // APIレスポンスを待機（ポーリングで確認）
    await expect(async () => {
      expect(capturedApiResponse).not.toBeNull()
    }).toPass({ timeout: 10000 })

    if (capturedApiResponse) {
      diagnostic.apiResponse = capturedApiResponse

      // API から最短 open/tentative スロットを探す
      const todayData = capturedApiResponse.days?.find((d) => d.is_today || d.date === todayJST)
      if (todayData) {
        const openSlots = todayData.slots.filter((s) => s.status === 'open' || s.status === 'tentative')
        if (openSlots.length > 0) {
          openSlots.sort((a, b) => normalizeTimeToMinutes(a.start_at) - normalizeTimeToMinutes(b.start_at))
          diagnostic.apiEarliestSlot = openSlots[0]
        }
      }
    }

    // UIスロットをカウント（ポーリングで安定化）
    await expect(async () => {
      const grid = page.getByTestId('availability-grid')
      const gridVisible = await grid.isVisible().catch(() => false)
      expect(gridVisible).toBe(true)
    }).toPass({ timeout: 10000 })

    const availableSlots = page.getByTestId('slot-available')
    const pendingSlots = page.getByTestId('slot-pending')

    const availableCount = await availableSlots.count()
    const pendingCount = await pendingSlots.count()

    diagnostic.uiSlotCounts = {
      available: availableCount,
      pending: pendingCount,
      blocked: await page.getByTestId('slot-blocked').count(),
    }

    // UIスロットのdata属性から時刻データを抽出
    const allBookableSlots = page.locator('[data-testid="slot-available"], [data-testid="slot-pending"]')
    const slotCount = await allBookableSlots.count()

    for (let i = 0; i < slotCount; i++) {
      const slot = allBookableSlots.nth(i)
      const testId = await slot.getAttribute('data-testid') || ''
      const date = await slot.getAttribute('data-date') || ''
      const startMinutesStr = await slot.getAttribute('data-start-minutes')
      const startAt = await slot.getAttribute('data-start-at')
      const startMinutes = startMinutesStr ? parseInt(startMinutesStr, 10) : -1

      diagnostic.uiSlots.push({
        date,
        startMinutes,
        startAt,
        testId,
      })
    }

    // UIの最短スロット時刻を取得
    if (diagnostic.uiSlots.length > 0) {
      const todaySlots = diagnostic.uiSlots.filter((s) => s.date === todayJST && s.startMinutes >= 0)
      if (todaySlots.length > 0) {
        const minMinutes = Math.min(...todaySlots.map((s) => s.startMinutes))
        diagnostic.uiEarliestSlotTime = minutesToTimeString(minMinutes)
      }
    }

    // data属性契約検証
    diagnostic.dataAttributeContract = validateAllDataAttributeContracts(diagnostic.uiSlots)

    // 診断実行
    diagnostic.diagnosis = diagnoseFailureLayer(diagnostic)

    // === 不変条件チェック ===
    const apiDays = diagnostic.apiResponse?.days || []
    const apiTodayData = apiDays.find((d) => d.is_today || d.date === todayJST)
    const apiOpenSlots = apiTodayData?.slots?.filter((s) => s.status === 'open' || s.status === 'tentative') || []
    const totalUIBookable = availableCount + pendingCount

    const apiMinMinutes = diagnostic.apiEarliestSlot
      ? normalizeTimeToMinutes(diagnostic.apiEarliestSlot.start_at)
      : -1
    const uiTodaySlots = diagnostic.uiSlots.filter((s) => s.date === todayJST && s.startMinutes >= 0)
    const uiMinMinutes = uiTodaySlots.length > 0
      ? Math.min(...uiTodaySlots.map((s) => s.startMinutes))
      : -1

    const invariantChecks = {
      apiStructure: apiDays.length === GOLDEN_CANDIDATE_CONFIG.requiredDays,
      apiHasSlots: apiOpenSlots.length >= GOLDEN_CANDIDATE_CONFIG.minOpenSlots,
      uiHasSlots: totalUIBookable >= 1,
      timeMatch: apiMinMinutes < 0 || uiMinMinutes < 0 || apiMinMinutes === uiMinMinutes,
      contractValid: diagnostic.dataAttributeContract?.valid ?? false,
    }

    // 失敗理由を記録
    if (!invariantChecks.apiStructure) {
      diagnostic.failures.push(`API応答が${GOLDEN_CANDIDATE_CONFIG.requiredDays}日構造でない (実際: ${apiDays.length}日)`)
    }
    if (!invariantChecks.apiHasSlots) {
      diagnostic.failures.push(`APIにopen/tentativeスロットがない`)
    }
    if (!invariantChecks.uiHasSlots) {
      diagnostic.failures.push(`UIに●/△スロットがない`)
    }
    if (!invariantChecks.timeMatch) {
      diagnostic.failures.push(`最短時刻不一致: API=${apiMinMinutes}分, UI=${uiMinMinutes}分`)
    }
    if (!invariantChecks.contractValid) {
      const firstViolation = diagnostic.dataAttributeContract?.violations[0]
      diagnostic.failures.push(`data属性契約違反: ${firstViolation?.violations.join(', ') || 'N/A'}`)
    }

    const allPassed = Object.values(invariantChecks).every(Boolean)

    // FAILカテゴリを決定（INFRA/A/B/Cの優先順位）
    let failCategory: FailCategory | null = null
    let failReason: string | null = null
    let confidence: 'high' | 'medium' | 'low' | null = null

    if (!allPassed) {
      // INFRA: HTTPエラー（5xx, 4xx）
      if (capturedApiStatus && (capturedApiStatus >= 500 || (capturedApiStatus >= 400 && capturedApiStatus !== 404))) {
        failCategory = 'INFRA'
        failReason = `API HTTP ${capturedApiStatus} エラー`
        confidence = 'high'
      }
      // A層: API契約違反
      else if (!invariantChecks.apiStructure) {
        failCategory = 'A'
        failReason = `API応答が${GOLDEN_CANDIDATE_CONFIG.requiredDays}日構造でない (実際: ${apiDays.length}日)`
        confidence = 'high'
      }
      else if (!invariantChecks.apiHasSlots) {
        failCategory = 'A'
        failReason = `APIにopen/tentativeスロットがない（カードには「本日」表示あり）`
        confidence = 'high'
      }
      // B層: UI変換違反
      else if (!invariantChecks.uiHasSlots) {
        failCategory = 'B'
        failReason = `APIにスロットがあるがUIに●/△スロットがない`
        confidence = 'high'
      }
      // C層: 表示違反
      else if (!invariantChecks.contractValid) {
        failCategory = 'C'
        const firstViolation = diagnostic.dataAttributeContract?.violations[0]
        failReason = `data属性契約違反: ${firstViolation?.violations.join(', ') || 'N/A'}`
        confidence = 'high'
      }
      else if (!invariantChecks.timeMatch) {
        failCategory = 'C'
        failReason = `最短時刻不一致: API=${apiMinMinutes}分, UI=${uiMinMinutes}分`
        confidence = 'medium'
      }
    }

    console.log(`[不変条件チェック] ${candidate.name}:`)
    console.log(`  API 7日構造: ${invariantChecks.apiStructure ? '✅' : '❌'} (${apiDays.length}日)`)
    console.log(`  API slots: ${invariantChecks.apiHasSlots ? '✅' : '❌'} (${apiOpenSlots.length}件)`)
    console.log(`  UI slots: ${invariantChecks.uiHasSlots ? '✅' : '❌'} (${totalUIBookable}件)`)
    console.log(`  時刻一致: ${invariantChecks.timeMatch ? '✅' : '❌'} (API=${apiMinMinutes}, UI=${uiMinMinutes})`)
    console.log(`  契約: ${invariantChecks.contractValid ? '✅' : '❌'}`)
    console.log(`  HTTP: ${capturedApiStatus || 'N/A'}`)
    console.log(`  結果: ${allPassed ? '✅ PASS' : `❌ FAIL (${failCategory})`}`)

    const verification: GoldenCaseVerificationResult = {
      candidateName: candidate.name,
      therapistId: diagnostic.therapistId,
      passed: allPassed,
      invariantChecks,
      diagnostic,
    }

    const candidateResult: CandidateResult = {
      name: candidate.name,
      therapistId: diagnostic.therapistId,
      outcome: allPassed ? 'PASS' : 'FAIL',
      failCategory,
      failReason,
      confidence,
      apiStatusCode: capturedApiStatus,
    }

    return { verification, candidateResult }
  } finally {
    page.off('response', responseHandler)

    // オーバーレイを閉じる
    const dialog = page.getByRole('dialog')
    if (await dialog.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape')
      await expect(dialog).not.toBeVisible({ timeout: 3000 }).catch(() => {})
    }
  }
}
