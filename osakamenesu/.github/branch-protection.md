# GitHub Branch Protection Rules

このドキュメントは、Osakamenesuプロジェクトのブランチ保護ルールの設定ガイドです。

## ブランチ保護ルールの設定

### 1. main ブランチ（本番環境）

**Settings > Branches > Add rule**

- **Branch name pattern**: `main`
- **Protect matching branches**:
  - ✅ Require a pull request before merging
    - ✅ Require approvals: 1
    - ✅ Dismiss stale pull request approvals when new commits are pushed
    - ✅ Require review from CODEOWNERS
  - ✅ Require status checks to pass before merging
    - ✅ Require branches to be up to date before merging
    - **Required status checks**:
      - `test` (from staging-deploy.yml)
      - `typecheck` (from ci-web.yml)
      - `lint` (from ci-web.yml)
      - `build` (from ci-web.yml)
      - `test-unit` (from ci-api.yml)
  - ✅ Require conversation resolution before merging
  - ✅ Require signed commits
  - ✅ Include administrators
  - ✅ Restrict who can push to matching branches
    - Add specific users or teams who can deploy to production

### 2. staging ブランチ（ステージング環境）

**Settings > Branches > Add rule**

- **Branch name pattern**: `staging`
- **Protect matching branches**:
  - ✅ Require a pull request before merging
    - ✅ Require approvals: 1
  - ✅ Require status checks to pass before merging
    - **Required status checks**:
      - `test` (from staging-deploy.yml)
  - ✅ Allow force pushes
    - ✅ Specify who can force push: Administrators only
  - ✅ Allow deletions

### 3. develop ブランチ（開発統合）

**Settings > Branches > Add rule**

- **Branch name pattern**: `develop`
- **Protect matching branches**:
  - ✅ Require status checks to pass before merging
    - **Required status checks**:
      - `typecheck`
      - `lint`
      - `test-unit`
  - ✅ Require branches to be up to date before merging
  - ✅ Allow force pushes
    - ✅ Specify who can force push: Developers

## デプロイメント環境の設定

### 1. Production Environment

**Settings > Environments > New environment**

- **Name**: `production`
- **Environment protection rules**:
  - ✅ Required reviewers
    - Add deployment approvers (team leads, DevOps)
  - ✅ Wait timer: 5 minutes
  - **Deployment branches**: Only from `main`

### 2. Staging Environment

**Settings > Environments > New environment**

- **Name**: `staging`
- **Environment protection rules**:
  - **Deployment branches**: Only from `staging` or `main`

## GitHub Actions シークレットの設定

**Settings > Secrets and variables > Actions**

### Required Secrets:

```
# Fly.io
FLY_API_TOKEN=your-fly-api-token

# Vercel
VERCEL_TOKEN=your-vercel-token
VERCEL_ORG_ID=your-org-id
VERCEL_PROJECT_ID=your-project-id
VERCEL_SCOPE=your-team-scope

# Sentry
SENTRY_ORG=your-sentry-org
SENTRY_AUTH_TOKEN=your-sentry-token

# Database Backup (optional)
BACKUP_ENCRYPTION_KEY=your-encryption-key
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
```

## CODEOWNERS ファイル

`.github/CODEOWNERS` ファイルを作成：

```
# Default owners for everything in the repo
* @your-github-username

# API code owners
/services/api/ @backend-team

# Frontend code owners
/services/web/ @frontend-team
/apps/web/ @frontend-team

# Infrastructure and deployment
/.github/ @devops-team
/docker/ @devops-team
*.yml @devops-team
*.yaml @devops-team

# Documentation
/docs/ @tech-lead @your-github-username
*.md @documentation-team
```

## 推奨ワークフロー

### 1. 機能開発フロー

```
feature/xxx → develop → staging → main
```

1. `feature/xxx` ブランチで開発
2. `develop` へPRを作成、マージ
3. `develop` から `staging` へPRを作成
4. ステージング環境でテスト
5. `staging` から `main` へPRを作成
6. レビュー承認後、本番デプロイ

### 2. ホットフィックスフロー

```
hotfix/xxx → staging → main
         └──→ develop
```

1. `main` から `hotfix/xxx` ブランチを作成
2. 修正を実施
3. `staging` へPRを作成、テスト
4. `main` へPRを作成、デプロイ
5. `develop` へもマージ

## セキュリティベストプラクティス

1. **署名付きコミットの強制**
   - 開発者にGPG署名の設定を要求
   - `git config --global commit.gpgsign true`

2. **シークレットスキャン**
   - GitHub Secret scanningを有効化
   - pre-commitフックでシークレット検出

3. **依存関係の管理**
   - Dependabotを有効化
   - セキュリティアラートの自動修正

4. **レビュープロセス**
   - セキュリティ関連の変更は2名以上のレビュー
   - インフラ変更はDevOpsチームの承認必須