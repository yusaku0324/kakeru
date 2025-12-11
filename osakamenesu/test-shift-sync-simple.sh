#!/bin/bash
set -euo pipefail

echo "=== シフトと候補枠の同期確認 ==="
echo ""

# 1. 現在の日付情報
echo "1. 日付情報:"
echo "   現在: $(date '+%Y-%m-%d %H:%M:%S')"
echo "   今日: $(date '+%Y-%m-%d')"
echo "   明日: $(date -v+1d '+%Y-%m-%d')"
echo "   明後日: $(date -v+2d '+%Y-%m-%d')"
echo ""

# 2. APIから次回予約可能時刻を確認
echo "2. 検索APIでの表示:"
NEXT_AVAILABLE=$(curl -s "https://osakamenesu-api.fly.dev/api/v1/shops?q=SSS" | jq -r '.results[0].staff_preview[0].next_available_at')
echo "   next_available_at: $NEXT_AVAILABLE"

# 日付を解析して表示形式を確認
if [[ "$NEXT_AVAILABLE" != "null" ]]; then
    # ISO形式から日付と時刻を抽出
    AVAILABLE_DATE=$(echo "$NEXT_AVAILABLE" | cut -d'T' -f1)
    AVAILABLE_TIME=$(echo "$NEXT_AVAILABLE" | cut -d'T' -f2 | cut -d':' -f1-2)

    TODAY=$(date '+%Y-%m-%d')
    TOMORROW=$(date -v+1d '+%Y-%m-%d')

    if [[ "$AVAILABLE_DATE" == "$TODAY" ]]; then
        echo "   → 本日 ${AVAILABLE_TIME}〜"
    elif [[ "$AVAILABLE_DATE" == "$TOMORROW" ]]; then
        echo "   → 明日 ${AVAILABLE_TIME}〜"
    else
        # 月日形式で表示
        MONTH=$(echo "$AVAILABLE_DATE" | cut -d'-' -f2 | sed 's/^0//')
        DAY=$(echo "$AVAILABLE_DATE" | cut -d'-' -f3 | sed 's/^0//')
        echo "   → ${MONTH}月${DAY}日 ${AVAILABLE_TIME}〜"
    fi
fi
echo ""

# 3. フロントエンドの候補枠APIを確認
echo "3. 候補枠の詳細確認 (フロントエンド経由):"
THERAPIST_ID="5a9e68aa-8b58-4f4b-aeda-3be83544adfd"

for i in 0 1 2; do
    DATE=$(date -v+${i}d '+%Y-%m-%d')

    case $i in
        0) LABEL="今日" ;;
        1) LABEL="明日" ;;
        2) LABEL="明後日" ;;
    esac

    echo ""
    echo "   $LABEL ($DATE):"

    # Vercelにデプロイされたフロントエンドのプロキシ経由でアクセス
    SLOTS=$(curl -s "https://osakamenesu-web.vercel.app/api/guest/therapists/${THERAPIST_ID}/availability_slots?date=${DATE}" 2>/dev/null || echo "[]")

    if [[ "$SLOTS" != "[]" && -n "$SLOTS" ]]; then
        # JSONとして解析可能か確認
        if echo "$SLOTS" | jq -e . >/dev/null 2>&1; then
            # 空き枠の数をカウント
            OPEN_COUNT=$(echo "$SLOTS" | jq '[.[] | select(.status == "open")] | length')
            echo "   空き枠数: $OPEN_COUNT"

            if [[ $OPEN_COUNT -gt 0 ]]; then
                # 時間帯別に集計
                echo "   時間帯:"
                echo "$SLOTS" | jq -r '.[] | select(.status == "open") | .start_at' | \
                while read -r slot; do
                    TIME=$(echo "$slot" | cut -d'T' -f2 | cut -d':' -f1-2)
                    echo "     - $TIME"
                done | sort -u
            fi
        else
            echo "   エラー: JSONの解析に失敗"
        fi
    else
        echo "   空き枠なし"
    fi
done

echo ""
echo "=== 確認完了 ==="
