# Ambiguity Resolution (Final)

## 概要

本文書は availability calendar UI/API 仕様における曖昧性を解決し、最終決定事項を記録する。

## 1. break_slots 形式統一

### 決定事項
- **Final**: ISO 8601 datetime形式（timezone必須 +09:00）
- **区間表現**: [start_at, end_at)
- **例**: `{"start_at":"2025-01-15T12:00:00+09:00","end_at":"2025-01-15T12:30:00+09:00"}`

### 理由
- 既存実装（`_parse_breaks`関数）がISO形式を前提
- タイムゾーン情報の明示的保持
- 日付跨ぎ休憩への将来対応

### 影響範囲
- **API**: break_slots受け入れ形式の統一
- **DB**: 既存JSON形式との互換性維持
- **UI**: 表示時のISO→HH:MM変換

## 2. tentative ステータスの役割

### 決定事項
- **Final**: フロントエンド専用の一時状態
- **セッション**: ページ離脱で自動解除
- **API除外**: バックエンドは認識しない

### 理由
- セッション内のみ有効な個人的選択状態
- 他ユーザーからは見えない
- バックエンド管理は不要な複雑性

### 影響範囲
- **API**: レスポンスから tentative 除外
- **DB**: tentative 状態は保存しない
- **UI**: ローカル状態のみで管理

## 3. reserved_until 設計

### 決定事項
- **設定**: 仮予約作成時に `now + 15分`
- **確定**: 予約確定時に `None`
- **判定**: `reserved_until is None` → 防御的に有効

### 理由
- 無期限ブロック防止
- 既存SoTロジックとの整合性
- 防御的プログラミング

### 影響範囲
- **API**: 仮予約の期限管理
- **DB**: reserved_until フィールドの活用
- **UI**: 期限切れ表示の正確性

## 4. availability_status 用語統一

### 決定事項
- **DB内部**: `"available"`
- **API表示**: `"open"`
- **マッピング**: 語彙レイヤー分離

### 理由
- 既存DB実装との整合性
- 大量コード変更の回避
- 意味的明確性

### 影響範囲
- **API**: DB値からUI語彙への変換
- **DB**: 既存 availability_status 維持
- **UI**: 表示語彙の統一

## 実装指針

### 優先順位
1. Final decisions に従う
2. Legacy/Deprecated は互換性のみ
3. 新規実装は Final のみ

### 禁止事項
- Final decisions との矛盾
- 新しい曖昧性の導入
- Legacy 形式での新規実装