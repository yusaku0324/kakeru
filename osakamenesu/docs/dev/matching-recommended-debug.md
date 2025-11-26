# /api/guest/matching/search?sort=recommended 開発用メモ

開発中に「recommended の並び」と score/breakdown/availability を手早く見るためのメモです。

## 前提
- API をローカルで起動済み（Docker Compose または `pnpm dev:api`）。
- DB が作成・マイグレ適用済み。

## 簡易チェック（curl）

```bash
curl "http://localhost:3000/api/guest/matching/search?area=osaka&date=2025-01-01&time_from=18:00&time_to=20:00&sort=recommended" \
  | jq '.items[] | {name: .therapist_name, score: .score, availability: .availability, breakdown: .breakdown}'
```

score/breakdown は v1 の式で計算されています：

- breakdown keys: base_staff_similarity, tag_similarity, price_match, age_match, photo_similarity, availability_boost
- score = clamp(0.35*base_staff_similarity + 0.25*tag_similarity + 0.15*price_match + 0.10*age_match + 0.10*photo_similarity + 0.05*availability_boost, 0..1)
- availability_boost: availability.is_available==True のときだけ >0（実装では 1.0）。フィルタは行わず加点のみ。

## 参考: Python スニペット

```python
import asyncio
import httpx

async def main():
    async with httpx.AsyncClient(base_url="http://localhost:3000") as client:
        resp = await client.get(
            "/api/guest/matching/search",
            params={
                "area": "osaka",
                "date": "2025-01-01",
                "time_from": "18:00",
                "time_to": "20:00",
                "sort": "recommended",
            },
        )
        resp.raise_for_status()
        for i, item in enumerate(resp.json().get("items", []), start=1):
            print(i, item.get("therapist_name"), item.get("score"), item.get("availability"))

if __name__ == "__main__":
    asyncio.run(main())
```

## 補足
- recommended 以外の sort は従来順序を維持し、新スコアは加点だけに使われます。
- 最終的な予約可否は GuestReservation + is_available 側で判定されます（search ではフィルタしません）。
