# Shop Search Flow Test Plan

## Overview
This test plan covers the complete user journey for searching and finding shops on the Osakamenesu platform, from the homepage to shop details.

## Test Scenarios

### Scenario 1: Basic Shop Search from Homepage

**Objective**: Verify users can search for shops using the main search functionality

**Preconditions**:
- User is on the homepage (https://osakamenesu.com)
- Browser cache is cleared

**Test Steps**:
1. Navigate to the homepage
2. Locate the main search bar
3. Enter search term "大阪" (Osaka)
4. Click the search button or press Enter
5. Wait for search results to load

**Expected Results**:
- Search results page displays with shops containing "大阪" in their name or location
- Results show shop cards with:
  - Shop name
  - Area/location
  - Rating (if available)
  - Thumbnail image
  - Brief description
- Results are paginated if more than 20 shops match

### Scenario 2: Area-Based Shop Search

**Objective**: Verify users can browse shops by specific areas

**Test Steps**:
1. From the homepage, locate the area navigation section
2. Click on "梅田エリア" (Umeda Area)
3. Wait for area-specific results to load
4. Verify shop listing displays

**Expected Results**:
- Page title shows "梅田エリアのメンズエステ"
- Only shops in Umeda area are displayed
- Map view option is available
- Filter options are visible

### Scenario 3: Advanced Shop Filtering

**Objective**: Test the shop filtering functionality

**Test Steps**:
1. Navigate to shop search results (any search)
2. Click on "絞り込み" (Filter) button
3. Select the following filters:
   - Price range: 10,000-15,000円
   - Business hours: 深夜営業 (Late night)
   - Services: オイルマッサージ
4. Click "検索" (Search) to apply filters
5. Review filtered results

**Expected Results**:
- Only shops matching ALL selected criteria are shown
- Filter tags are displayed above results
- "Clear filters" option is available
- Result count updates to reflect filtered shops

### Scenario 4: Shop Quick View

**Objective**: Verify shop preview functionality without full navigation

**Test Steps**:
1. From search results, hover over a shop card
2. Click "クイックビュー" (Quick View) button if available
3. Review the modal/preview content

**Expected Results**:
- Modal opens with shop summary:
  - Shop name and main image
  - Operating hours
  - Price range
  - Available services list
  - Contact information
- "詳細を見る" (View Details) button is present
- Modal can be closed without navigation

### Scenario 5: Shop Details Navigation

**Objective**: Test navigation from search results to full shop details

**Test Steps**:
1. From search results, click on a shop card
2. Wait for shop details page to load
3. Verify URL changes to /shops/[shop-id]
4. Check all sections load properly

**Expected Results**:
- Shop details page displays with:
  - Full shop information
  - Photo gallery
  - Service menu with prices
  - Therapist list
  - Access/location information
  - Reviews section
- "予約する" (Book Now) button is prominent
- Breadcrumb navigation shows: Home > Area > Shop Name

### Scenario 6: Search with No Results

**Objective**: Verify appropriate handling of searches with no matches

**Test Steps**:
1. Enter nonsensical search term "xyzabc123"
2. Submit search
3. Review no results page

**Expected Results**:
- "検索結果が見つかりませんでした" message displays
- Suggestions for:
  - Checking spelling
  - Using different keywords
  - Browsing by area
- Popular shops section shows as alternative

### Scenario 7: Search Result Sorting

**Objective**: Test different sorting options for search results

**Test Steps**:
1. Perform any search with multiple results
2. Locate sort dropdown (並び替え)
3. Test each sort option:
   - おすすめ順 (Recommended)
   - 新着順 (Newest first)
   - 評価順 (By rating)
   - 価格が安い順 (Price: Low to High)
   - 価格が高い順 (Price: High to Low)

**Expected Results**:
- Results reorder according to selected criteria
- Current sort option remains selected
- Page doesn't lose scroll position
- Results update without full page reload

### Scenario 8: Mobile Shop Search

**Objective**: Verify shop search functionality on mobile devices

**Test Steps**:
1. Access site on mobile device (or responsive view 375px)
2. Tap search icon to open search interface
3. Enter search term using mobile keyboard
4. Submit search
5. Interact with results on touch screen

**Expected Results**:
- Search interface is optimized for mobile
- Virtual keyboard doesn't obscure input
- Results are displayed in single column
- Touch targets are appropriately sized (min 44px)
- Horizontal scrolling is not required

### Scenario 9: Search History and Suggestions

**Objective**: Test search suggestions and history features

**Test Steps**:
1. Click on empty search bar
2. Check if recent searches appear
3. Start typing "大阪"
4. Observe autocomplete suggestions
5. Select a suggestion
6. Verify search executes with selected term

**Expected Results**:
- Recent searches show last 5 searches (if implemented)
- Autocomplete appears after 2 characters
- Suggestions include:
  - Matching shop names
  - Area names
  - Popular search terms
- Selecting suggestion immediately executes search

### Scenario 10: Shop Search Pagination

**Objective**: Verify pagination works correctly for large result sets

**Test Steps**:
1. Perform search that returns many results (e.g., all shops)
2. Scroll to bottom of first page
3. Click "次のページ" (Next Page) or page number
4. Verify results update
5. Use pagination to go to specific page (e.g., page 3)
6. Test "前のページ" (Previous Page)

**Expected Results**:
- Each page shows exactly 20 results (or configured amount)
- Current page is highlighted in pagination
- Page number appears in URL (?page=2)
- Smooth transition between pages
- Total result count remains visible

## Edge Cases

### Edge Case 1: Special Characters in Search
- Test with: "メンエス@#$%", "🌸花咲", "<script>alert('test')</script>"
- Expected: Sanitized search, no XSS, appropriate results or no results message

### Edge Case 2: Extremely Long Search Terms
- Test with 200+ character string
- Expected: Search term truncated appropriately, no UI breakage

### Edge Case 3: Rapid Search Submissions
- Submit multiple searches rapidly
- Expected: Debouncing prevents excessive API calls, latest search takes priority

### Edge Case 4: Network Interruption During Search
- Start search and disconnect network
- Expected: Appropriate error message, option to retry

## Accessibility Requirements

1. All search functions keyboard accessible
2. Screen reader announces result count
3. Focus management when results update
4. Alt text for all shop images
5. ARIA labels for filter controls

## Performance Criteria

- Search results load within 2 seconds
- Autocomplete suggestions appear within 200ms
- No layout shift when results load
- Images lazy load appropriately