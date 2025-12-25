# Video Factory

縦動画の変換エンジン。

## 原則

- 台本の質が9割
- 台本は人間＋ChatGPTで作る
- Claude Codeは動画変換専用
- 仕様を増やさない

## 台本フォーマット（唯一の型）

```json
{
  "id": "judge-001",
  "lines": [
    "「◯◯」",
    "だいたい",
    "失敗する"
  ]
}
```

- `id`: 必須
- `lines`: 必須・必ず3行
- `imageId`: 任意

## 使い方

```bash
# 台本を配置
resources/scripts/judge-001.json

# レンダリング
bun render

# 出力
out/videos/judge-001.mp4
```

## 仕様

- 動画長：24秒固定
- 表示：3行を8秒ずつ均等表示
- 演出：なし
- BGM：音量0.25

## やらないこと

- 台本生成
- バリエーション提案
- 言葉の調整
- 演出追加