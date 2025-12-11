#!/usr/bin/env python3
"""シフトと候補枠の同期を検証するスクリプト"""

import requests
import json
from datetime import datetime, timedelta, timezone
import time

# JST タイムゾーン
JST = timezone(timedelta(hours=9))

# API設定
API_BASE = "http://localhost:8001"  # ローカルAPIサーバー
SHOP_ID = "52c92fb6-bab6-460e-9312-61a16ab98941"  # SSS shop ID
THERAPIST_ID = "5a9e68aa-8b58-4f4b-aeda-3be83544adfd"  # ももな

# 今日、明日、明後日の日付を取得
now_jst = datetime.now(JST)
today = now_jst.date()
tomorrow = today + timedelta(days=1)
day_after = today + timedelta(days=2)

print("=== シフトと候補枠の同期テスト ===")
print(f"現在時刻: {now_jst.strftime('%Y-%m-%d %H:%M:%S %Z')}")
print(f"今日: {today}")
print(f"明日: {tomorrow}")
print(f"明後日: {day_after}")

# 1. 現在のシフトを確認
print("\n1. 現在登録されているシフトを確認...")
try:
    # ダッシュボードAPIでシフトを取得
    shifts_url = f"{API_BASE}/api/dashboard/shops/{SHOP_ID}/therapists/{THERAPIST_ID}/shifts"
    response = requests.get(shifts_url)

    if response.status_code == 200:
        shifts = response.json()
        print(f"  登録シフト数: {len(shifts)}")
        for shift in shifts[:5]:  # 最初の5件のみ表示
            start = datetime.fromisoformat(shift['start_at'].replace('Z', '+00:00'))
            end = datetime.fromisoformat(shift['end_at'].replace('Z', '+00:00'))
            print(f"  - {start.astimezone(JST).strftime('%m/%d %H:%M')} ~ {end.astimezone(JST).strftime('%H:%M')}")
    else:
        print(f"  エラー: {response.status_code}")
        print("  ダッシュボードAPIにアクセスできません")
except Exception as e:
    print(f"  エラー: {e}")
    print("  注意: ダッシュボードAPIへのアクセスには認証が必要かもしれません")

# 2. 公開APIで空き枠を確認
print("\n2. 公開APIで空き枠を確認...")

for date in [today, tomorrow, day_after]:
    print(f"\n  {date} の空き枠:")

    # 候補枠API
    availability_url = f"{API_BASE}/api/v1/availability/therapists/{THERAPIST_ID}/slots"
    params = {"date": date.strftime("%Y-%m-%d")}

    try:
        response = requests.get(availability_url, params=params)

        if response.status_code == 200:
            data = response.json()
            slots = data.get('slots', [])

            # 空き枠のみフィルタリング
            open_slots = [s for s in slots if s.get('status') == 'open']

            if open_slots:
                print(f"  {len(open_slots)} 個の空き枠あり:")
                for slot in open_slots[:5]:  # 最初の5件のみ
                    start_time = datetime.fromisoformat(slot['start_at'].replace('Z', '+00:00'))
                    print(f"    - {start_time.astimezone(JST).strftime('%H:%M')}")
            else:
                print("  空き枠なし")
        else:
            print(f"  エラー: {response.status_code}")
            print(f"  レスポンス: {response.text[:200]}")
    except Exception as e:
        print(f"  エラー: {e}")

# 3. ゲストAPIでセラピスト詳細を確認
print("\n3. セラピスト詳細の空き枠情報...")

for date in [today, tomorrow, day_after]:
    guest_url = f"https://osakamenesu-web.vercel.app/api/guest/therapists/{THERAPIST_ID}/availability_slots"
    params = {"date": date.strftime("%Y-%m-%d")}

    try:
        response = requests.get(guest_url, params=params)

        if response.status_code == 200:
            slots = response.json()
            open_slots = [s for s in slots if s.get('status') == 'open']

            print(f"\n  {date}: {len(open_slots)} 個の空き枠")
            if open_slots:
                # 時間帯ごとにグループ化
                time_ranges = {}
                for slot in open_slots:
                    start = datetime.fromisoformat(slot['start_at'].replace('Z', '+00:00'))
                    hour = start.astimezone(JST).hour
                    time_ranges[hour] = time_ranges.get(hour, 0) + 1

                for hour in sorted(time_ranges.keys()):
                    print(f"    {hour:02d}:00台: {time_ranges[hour]} スロット")
        else:
            print(f"  {date}: エラー {response.status_code}")
    except Exception as e:
        print(f"  {date}: エラー {e}")

# 4. 検索APIで次回予約可能時刻を確認
print("\n4. 検索APIでの表示を確認...")
search_url = f"https://osakamenesu-api.fly.dev/api/v1/shops?q=SSS"
try:
    response = requests.get(search_url)
    if response.status_code == 200:
        data = response.json()
        shop = data['results'][0]
        therapist = shop['staff_preview'][0]

        next_available = therapist.get('next_available_at')
        if next_available:
            next_time = datetime.fromisoformat(next_available.replace('Z', '+00:00'))
            print(f"  次回予約可能: {next_time.astimezone(JST).strftime('%Y-%m-%d %H:%M')}")

            # 現在時刻との差を計算
            diff = next_time - now_jst
            if diff.days == 0:
                print(f"  表示: 本日 {next_time.astimezone(JST).strftime('%H:%M')}〜")
            elif diff.days == 1:
                print(f"  表示: 明日 {next_time.astimezone(JST).strftime('%H:%M')}〜")
            else:
                print(f"  表示: {next_time.astimezone(JST).strftime('%m/%d %H:%M')}〜")
        else:
            print("  次回予約可能時刻: なし")
except Exception as e:
    print(f"  エラー: {e}")

print("\n=== 検証結果 ===")
print("1. シフト登録 → 候補枠生成の流れを確認")
print("2. 各APIでの空き枠データの整合性を確認")
print("3. タイムゾーン処理が正しいか確認（すべてJSTで表示）")
print("4. next_available_at が実際の最早空き枠と一致しているか確認")
