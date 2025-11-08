# Next.js 16 プレビュー実行メモ

- Node.js 20.18+（または 22.x LTS）を想定。Vercel では Project Settings → General → Node.js version で指定。
- `next dev` / `next build` は `--turbo` フラグを付与済み。ローカルや CI では `npm run dev` / `npm run build` をそのまま使用する。
- Vercel / Turbopack の Preview Deploy では `NEXT_RUNTIME`, `TURBOPACK=1` の追加設定は不要だが、Build Output v3 を有効にしておくとログが確認しやすい。
- `next.config.ts` の `experimental.reactCompiler: true` により React Compiler が常時有効。コンパイル時間が延びるため CI では `NEXT_DISABLE_REACT_COMPILER=1` を一時的に付与して従来モードとの比較が可能。
- Preview Deploy 前に `npm run lint` → `npm run build` をローカルで実行し、React Compiler 由来の警告（未対応 API など）が出ないかを確認する。
- バンドル差分確認のため `next build --profile` を併用するとロードマップ作成時に便利。
