#!/bin/bash

# Staging環境の動作確認スクリプト

echo "🧪 Staging環境テスト開始"
echo "========================"

# 色定義
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# テスト結果
PASSED=0
FAILED=0

# テスト関数
test_endpoint() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}

    echo -n "Testing $name... "
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url")

    if [ "$status" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (Status: $status)"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAILED${NC} (Expected: $expected_status, Got: $status)"
        ((FAILED++))
    fi
}

echo ""
echo "📡 API テスト"
echo "-------------"

# API endpoints
test_endpoint "API Health" "https://osakamenesu-api-stg.fly.dev/healthz" "200"
test_endpoint "API Docs" "https://osakamenesu-api-stg.fly.dev/docs" "200"
test_endpoint "API OpenAPI" "https://osakamenesu-api-stg.fly.dev/openapi.json" "200"
test_endpoint "API Shops" "https://osakamenesu-api-stg.fly.dev/api/shops" "200"

echo ""
echo "🌐 Web テスト"
echo "-------------"

# Web endpoints
test_endpoint "Web Home" "https://osakamenesu-ii4sgsbwd-yusaku0324s-projects.vercel.app/" "200"
test_endpoint "Web Guest Search" "https://osakamenesu-ii4sgsbwd-yusaku0324s-projects.vercel.app/guest/search" "200"
test_endpoint "Web Auth Login" "https://osakamenesu-ii4sgsbwd-yusaku0324s-projects.vercel.app/auth/login" "200"
test_endpoint "Web API Health" "https://osakamenesu-ii4sgsbwd-yusaku0324s-projects.vercel.app/api/health" "200"

echo ""
echo "🔍 詳細チェック"
echo "---------------"

# API詳細チェック
echo -n "API Shops response check... "
response=$(curl -s https://osakamenesu-api-stg.fly.dev/api/shops)
if echo "$response" | jq -e '.shops' > /dev/null 2>&1; then
    shop_count=$(echo "$response" | jq '.shops | length')
    echo -e "${GREEN}✓ PASSED${NC} (Shops count: $shop_count)"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC} (Invalid JSON response)"
    ((FAILED++))
fi

# PWAチェック
echo -n "PWA Manifest check... "
manifest_status=$(curl -s -o /dev/null -w "%{http_code}" "https://osakamenesu-ii4sgsbwd-yusaku0324s-projects.vercel.app/manifest.json")
if [ "$manifest_status" = "200" ]; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC} (Status: $manifest_status)"
    ((FAILED++))
fi

echo -n "Service Worker check... "
sw_status=$(curl -s -o /dev/null -w "%{http_code}" "https://osakamenesu-ii4sgsbwd-yusaku0324s-projects.vercel.app/sw.js")
if [ "$sw_status" = "200" ]; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC} (Status: $sw_status)"
    ((FAILED++))
fi

# Sentry確認
echo ""
echo "📊 Sentry統合確認"
echo "-----------------"
echo "Sentryエラーは以下で確認してください："
echo "https://sentry.io/organizations/your-org/issues/?project=4510316687589376"

# サマリー
echo ""
echo "📈 テスト結果サマリー"
echo "===================="
echo -e "✓ PASSED: ${GREEN}$PASSED${NC}"
echo -e "✗ FAILED: ${RED}$FAILED${NC}"

TOTAL=$((PASSED + FAILED))
if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 すべてのテストが成功しました！ ($PASSED/$TOTAL)${NC}"
    exit 0
else
    echo -e "\n${RED}⚠️ 一部のテストが失敗しました ($FAILED/$TOTAL)${NC}"
    exit 1
fi
