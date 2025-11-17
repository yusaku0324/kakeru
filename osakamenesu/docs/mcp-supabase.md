# Supabase MCP サーバー接続ガイド

Supabase 公式の Model Context Protocol (MCP) サーバーを使うことで、Cursor / Claude / Windsurf などの AI クライアントから直接 Supabase プロジェクトを操作できます。このリポジトリにコードを追加する必要はなく、**MCP クライアントに Supabase 提供の HTTP サーバーを登録するだけ** で利用できます。

## 1. セキュリティに注意

LLM に Supabase プロジェクトへのアクセスを与えることになるため、[
公式のセキュリティベストプラクティス](https://github.com/supabase-community/supabase-mcp#security-risks) を確認し、必要に応じて読み取り専用モードやプロジェクトスコープを有効にしてください。

## 2. MCP サーバーを追加

クライアントによって操作は異なりますが、共通して以下の設定を追加します。

```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp"
    }
  }
}
```

- Cursor: `Settings > MCP > Add new MCP Server` から上記の内容を登録します。もしくは Supabase ダッシュボードの「Connect → MCP」タブにあるボタンをクリックすると自動で登録されます。
- VS Code / Windsurf: `mcp.json` に追記するか、リンクボタンからインストールします。
- Factory CLI: `droid mcp add supabase https://mcp.supabase.com/mcp --type http`

登録後にクライアントを再起動すると OAuth フローが始まり、ブラウザで Supabase にログインしてアクセスを許可します。プロジェクトを限定したい場合は、URL に `project_ref` を付けてください。

```text
https://mcp.supabase.com/mcp?project_ref=<YOUR_PROJECT_ID>
```

## 3. オプション

- `read_only=true` … すべてのツールを読み取り専用に制限し、安全に使いたい場合の推奨設定です。
- `features=database,docs` … 利用するツールグループをカンマ区切りで指定できます。省略時は標準セット（account, database, debugging など）が有効です。
- `project_ref=<project-id>` … 特定プロジェクトのみにアクセスを限定します。ID は Supabase ダッシュボードの Project Settings で確認できます。

## 4. ローカル / 自前ホストでの利用

Supabase CLI (`supabase start`) や自前ホスティング環境には MCP サーバーが同梱されています。以下の URL でアクセスできます。

- CLI: `http://localhost:54321/mcp`
- 自前ホスト: [ドキュメント](https://supabase.com/docs/guides/self-hosting/enable-mcp) を参照

CLI / 自前ホスト版は OAuth を伴わない代わりにツールセットが限定されます。必要に応じて利用してください。

## 5. 参考資料

- [supabase-community/supabase-mcp](https://github.com/supabase-community/supabase-mcp)
- [Supabase MCP ドキュメント](https://supabase.com/docs/guides/getting-started/mcp)

この手順で MCP クライアントから Supabase に接続できるようになります。さらに細かい使い方や制限は公式リポジトリを参照してください。
