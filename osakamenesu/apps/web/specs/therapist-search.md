# Therapist Search Test Plan

## Overview
This test plan covers the complete user journey for finding and viewing therapist profiles on the Osakamenesu platform.

## Test Scenarios

### Scenario 1: Basic Therapist Search

**Objective**: Verify users can search for therapists directly

**Preconditions**:
- User is on the homepage
- Therapist search feature is accessible

**Test Steps**:
1. Navigate to homepage
2. Click on "セラピスト検索" (Therapist Search) tab/link
3. Enter therapist name "さくら" in search field
4. Submit search
5. Review search results

**Expected Results**:
- Results show therapist cards containing "さくら" in name
- Each card displays:
  - Therapist photo
  - Name
  - Associated shop
  - Age (if disclosed)
  - Brief introduction
  - Available schedule indicator
- Results are properly paginated

### Scenario 2: Therapist Filter by Characteristics

**Objective**: Test filtering therapists by various attributes

**Test Steps**:
1. Navigate to therapist search page
2. Open filter panel
3. Select filters:
   - Age range: 20-25歳
   - Body type: スレンダー (Slender)
   - Style: 清楚系 (Elegant)
4. Apply filters
5. Verify filtered results

**Expected Results**:
- Only therapists matching selected criteria appear
- Filter tags show active filters
- Result count updates dynamically
- Option to save filter preferences (if available)

### Scenario 3: Browse Therapists by Shop

**Objective**: Verify viewing all therapists from a specific shop

**Test Steps**:
1. Navigate to any shop details page
2. Click "在籍セラピスト" (Staff Therapists) section
3. View therapist grid/list
4. Click "すべて見る" (View All) if truncated

**Expected Results**:
- All therapists from that shop are displayed
- Shop name appears as context header
- Each therapist shows availability status
- Direct booking option per therapist

### Scenario 4: Therapist Profile Detail View

**Objective**: Test complete therapist profile viewing

**Test Steps**:
1. From search results, click on a therapist card
2. Wait for profile page to load
3. Review all profile sections
4. Test image gallery if available

**Expected Results**:
- Profile page shows:
  - Main profile photo (with gallery if multiple)
  - Name and shop affiliation
  - Self-introduction text
  - Services offered
  - Schedule/availability
  - Reviews/ratings (if available)
  - Booking button
- Social sharing options present
- Back navigation maintains search context

### Scenario 5: Therapist Schedule Checking

**Objective**: Verify real-time schedule availability

**Test Steps**:
1. Navigate to therapist profile
2. Locate schedule section
3. Click on calendar or schedule view
4. Navigate between days/weeks
5. Check available time slots

**Expected Results**:
- Current week displays by default
- Available slots clearly marked
- Booked times grayed out
- Can navigate future dates (limit 2 weeks)
- Time slots show in 30/60 min increments
- Real-time updates if slot becomes unavailable

### Scenario 6: New Therapist Highlights

**Objective**: Test discovery of newly joined therapists

**Test Steps**:
1. From homepage or search, find "新人セラピスト" (New Therapists) section
2. Click to view new therapist listings
3. Verify special indicators
4. Check if sorting by join date works

**Expected Results**:
- NEW badge or indicator on profiles
- Join date visible (e.g., "入店: 3日前")
- Possible introductory pricing shown
- Higher visibility in search results

### Scenario 7: Therapist Photo Gallery

**Objective**: Test therapist photo viewing functionality

**Test Steps**:
1. Navigate to therapist with multiple photos
2. Click on main photo or gallery icon
3. Navigate through photos using arrows/swipe
4. Test fullscreen mode
5. Close gallery

**Expected Results**:
- Gallery opens smoothly
- Navigation between photos works
- Photo count indicator (e.g., 3/5)
- Pinch to zoom on mobile
- ESC or X closes gallery
- No inappropriate content warnings if needed

### Scenario 8: Popular Therapist Rankings

**Objective**: Verify therapist ranking/popularity features

**Test Steps**:
1. Look for "人気セラピスト" (Popular Therapists) section
2. Click to view rankings
3. Check ranking criteria (views/bookings/reviews)
4. Verify ranking period selector (daily/weekly/monthly)

**Expected Results**:
- Clear ranking numbers (1st, 2nd, etc.)
- Ranking criteria explained
- Period selector works correctly
- Special badges for top performers
- Links to full profiles functional

### Scenario 9: Therapist Search on Mobile

**Objective**: Test mobile-optimized therapist search

**Test Steps**:
1. Access on mobile device (375px width)
2. Use therapist search function
3. Apply filters using mobile UI
4. Scroll through results
5. View therapist profile

**Expected Results**:
- Search bar sticky at top
- Filters accessible via bottom sheet or modal
- Smooth vertical scrolling
- Images optimized for mobile data
- Tap targets appropriately sized
- Profile layout mobile-optimized

### Scenario 10: Favorite Therapist Management

**Objective**: Test saving and managing favorite therapists

**Test Steps**:
1. Login to user account
2. Navigate to therapist profile
3. Click heart/favorite icon
4. Go to account "お気に入り" section
5. Verify favorited therapist appears
6. Remove from favorites

**Expected Results**:
- Favorite icon changes state (filled/unfilled)
- Confirmation message appears
- Favorites list shows all saved therapists
- Can unfavorite from list or profile
- Favorites persist across sessions

### Scenario 11: Therapist Review Display

**Objective**: Verify therapist review/rating functionality

**Test Steps**:
1. Navigate to therapist with reviews
2. Check overall rating display
3. Click to see all reviews
4. Test review sorting options
5. Check review authenticity indicators

**Expected Results**:
- Average rating clearly displayed (e.g., 4.5★)
- Review count visible
- Individual reviews show:
  - Date
  - Rating
  - Comment text
  - Verified booking indicator
- Inappropriate reviews filtered

### Scenario 12: Multi-Shop Therapist Search

**Objective**: Test searching across all shops vs specific shop

**Test Steps**:
1. Use global therapist search
2. Note results from multiple shops
3. Apply shop filter to narrow results
4. Compare result sets

**Expected Results**:
- Global search returns therapists from all shops
- Shop names clearly indicated on cards
- Can filter by specific shop(s)
- Distance/area information if relevant

## Edge Cases

### Edge Case 1: Therapist No Longer Available
- Access direct URL to removed therapist profile
- Expected: Polite message about unavailability, suggestions for similar therapists

### Edge Case 2: All Timeslots Booked
- View fully booked therapist schedule
- Expected: Waitlist option or notification when available

### Edge Case 3: Duplicate Names
- Search for common name with multiple matches
- Expected: Differentiation by shop, photo, or ID

### Edge Case 4: Profile Loading Failure
- Simulate slow network while loading profile
- Expected: Skeleton screens, timeout handling, retry option

## Accessibility Requirements

1. Alt text for all therapist photos
2. Keyboard navigation through gallery
3. Screen reader compatibility for schedule grid
4. High contrast mode support
5. Focus indicators on interactive elements

## Performance Criteria

- Therapist search returns results within 1.5 seconds
- Profile pages load within 2 seconds
- Image galleries use progressive loading
- Schedule data updates without full reload
- Smooth scrolling on mobile devices