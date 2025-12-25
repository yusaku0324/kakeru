# Osakamenesu Test Plans

This directory contains comprehensive test plans generated for the Osakamenesu platform. These plans cover all major user journeys and features.

## Generated Test Plans

### 1. [Shop Search Flow](./shop-search-flow.md)
Comprehensive testing of shop discovery and search functionality:
- Basic search from homepage
- Area-based browsing
- Advanced filtering options
- Search results display and sorting
- Mobile search experience
- Edge cases and error handling

### 2. [Therapist Search](./therapist-search.md)
Testing therapist discovery and profile features:
- Direct therapist search
- Filtering by characteristics
- Profile detail views
- Schedule availability checking
- Photo galleries
- Favorite therapist management

### 3. [Reservation Journey](./reservation-journey.md)
End-to-end booking flow testing:
- Complete reservation from shop
- Quick booking from therapist
- Payment processing
- Booking modifications
- Cancellation flow
- Recurring bookings
- Guest booking options

### 4. [User Authentication](./user-authentication.md)
Authentication and security testing:
- New user registration
- Email and social login
- Password reset flow
- Two-factor authentication
- Session management
- Account deletion

### 5. [Area Navigation](./area-navigation.md)
Location-based browsing features:
- Area landing pages
- Interactive maps
- Station-based filtering
- Transportation guides
- Area comparison
- Local promotions

### 6. [User Features](./user-features.md)
Account management and personalization:
- Favorites (shops & therapists)
- Booking history
- Review submission
- Profile management
- Notification preferences
- Points/rewards system
- Privacy controls

## Test Coverage Summary

### User Journeys Covered
- First-time visitor exploring shops
- Registered user making bookings
- Returning user managing favorites
- Mobile user experience
- Guest checkout flow

### Key Features Tested
- Search and discovery
- User registration/login
- Booking system
- Payment processing
- Profile management
- Review system
- Notification system
- Mobile responsiveness

### Non-Functional Requirements
- Performance criteria (load times)
- Accessibility standards
- Security validations
- Error handling
- Edge cases

## Usage Instructions

These test plans can be used for:

1. **Manual Testing**: Step-by-step instructions for QA testers
2. **Automated Test Development**: Convert scenarios to Playwright tests
3. **Requirements Validation**: Ensure all features work as expected
4. **Regression Testing**: Verify features after updates

## Converting to Automated Tests

To convert these plans to Playwright tests:

1. Each scenario becomes a test case
2. Test steps map to Playwright commands
3. Expected results become assertions
4. Use Page Object Model for maintainability

Example conversion:
```javascript
// From: Shop Search Flow - Scenario 1
test('Basic Shop Search from Homepage', async ({ page }) => {
  // Navigate to the homepage
  await page.goto('/')

  // Locate the main search bar
  const searchBar = page.locator('[data-testid="main-search"]')

  // Enter search term "大阪"
  await searchBar.fill('大阪')

  // Click search button or press Enter
  await searchBar.press('Enter')

  // Wait for search results to load
  await page.waitForSelector('[data-testid="search-results"]')

  // Verify results contain shops with "大阪"
  const results = page.locator('[data-testid="shop-card"]')
  await expect(results.first()).toContainText('大阪')
})
```

## Maintenance

These test plans should be updated when:
- New features are added
- User flows change
- UI/UX updates occur
- Business rules change

Last updated: 2025-12-25