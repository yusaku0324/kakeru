# User Features Test Plan

## Overview
This test plan covers user account features including favorites management, booking history, profile settings, and notification preferences.

## Test Scenarios

### Scenario 1: Favorites Management - Shops

**Objective**: Test adding and managing favorite shops

**Preconditions**:
- User is logged in
- At least 5 shops exist in the system

**Test Steps**:
1. Navigate to shop details page
2. Click heart icon "お気に入りに追加" (Add to favorites)
3. See confirmation message
4. Navigate to account > "お気に入り店舗" (Favorite shops)
5. Verify shop appears in list
6. Click heart icon again to remove
7. Confirm removal

**Expected Results**:
- Heart icon fills when clicked
- Toast notification confirms addition
- Favorites page shows all favorited shops
- Can sort by: date added, name, area
- One-click removal from list
- Removed shops disappear immediately
- Maximum 50 favorites allowed

### Scenario 2: Favorites Management - Therapists

**Objective**: Test therapist favorites functionality

**Test Steps**:
1. Navigate to therapist profile
2. Click "お気に入り登録" (Add to favorites)
3. Go to account > "お気に入りセラピスト"
4. View favorited therapists grid
5. Check availability indicators
6. Click to view full profile
7. Remove from favorites

**Expected Results**:
- Star/heart icon shows favorited state
- Favorites list shows:
  - Therapist photo
  - Name and shop
  - Online/availability status
  - Last active indicator
- Can unfavorite from list or profile
- Push notification option for availability

### Scenario 3: Booking History Display

**Objective**: Test viewing past and upcoming bookings

**Test Steps**:
1. Navigate to "予約履歴" (Booking history)
2. View default tab "予定の予約" (Upcoming)
3. Check booking cards display:
   - Date and time
   - Shop and therapist
   - Service and duration
   - Status
4. Switch to "過去の予約" (Past bookings)
5. Try filtering by date range
6. Click booking for details

**Expected Results**:
- Upcoming bookings sorted by date
- Clear status indicators:
  - Confirmed (green)
  - Pending (yellow)
  - Cancelled (gray)
- Past bookings show "レビュー" (Review) button
- Can filter by: year, month, shop
- Pagination for long history
- Export option available

### Scenario 4: Booking Details View

**Objective**: Test comprehensive booking information display

**Test Steps**:
1. From booking history, click any booking
2. View detailed information:
   - Booking reference number
   - Full service details
   - Payment information
   - Shop address and map
   - Contact information
3. For upcoming: check action buttons
4. For past: check receipt download

**Expected Results**:
- All booking details clearly displayed
- QR code for easy check-in (if applicable)
- Upcoming bookings show:
  - Modify button
  - Cancel button
  - Add to calendar
- Past bookings show:
  - Receipt/invoice download
  - Rebook same service
  - Review options

### Scenario 5: Review Submission

**Objective**: Test post-service review process

**Test Steps**:
1. Find past booking without review
2. Click "レビューを書く" (Write review)
3. Rate overall experience (1-5 stars)
4. Rate specific aspects:
   - Service quality
   - Therapist skill
   - Cleanliness
   - Value for money
5. Write text review (optional)
6. Submit review
7. Check if published

**Expected Results**:
- Can only review completed bookings
- One review per booking
- Star ratings required
- Text review 10-500 characters
- Profanity filter active
- Review appears after moderation
- Points/rewards for reviewing

### Scenario 6: Profile Information Management

**Objective**: Test updating user profile details

**Test Steps**:
1. Go to "プロフィール設定" (Profile settings)
2. Update various fields:
   - Nickname
   - Phone number
   - Birth date
   - Email preferences
3. Upload profile photo
4. Save changes
5. Verify updates reflected

**Expected Results**:
- Current info pre-populated
- Real-time validation
- Photo upload with crop tool
- Photo size limit (5MB)
- Success message on save
- Changes reflected immediately
- Email change requires verification

### Scenario 7: Notification Preferences

**Objective**: Test notification settings management

**Test Steps**:
1. Navigate to "通知設定" (Notification settings)
2. Review notification categories:
   - Booking confirmations
   - Reminders
   - Promotions
   - Favorite therapist availability
3. Toggle email notifications
4. Toggle push notifications
5. Set quiet hours
6. Save preferences

**Expected Results**:
- Granular control per category
- Email/Push/SMS toggles separate
- Quiet hours respected
- Test notification button
- Changes save immediately
- Unsubscribe link in emails honors settings

### Scenario 8: Point/Reward System

**Objective**: Test loyalty points functionality

**Test Steps**:
1. Go to "ポイント" (Points) section
2. View current point balance
3. Check point history:
   - Earned from bookings
   - Used for discounts
   - Expiring soon
4. Browse point rewards catalog
5. Redeem points for discount

**Expected Results**:
- Point balance prominently displayed
- History shows:
  - Date
  - Action (earned/used)
  - Amount
  - Balance after
- Expiry warnings 30 days prior
- Clear redemption values
- Cannot exceed point balance

### Scenario 9: Referral Program

**Objective**: Test user referral features

**Test Steps**:
1. Access "友達紹介" (Refer friends)
2. View personal referral code
3. Copy sharing link
4. Check sharing options:
   - LINE
   - Email
   - QR code
5. View referral history
6. Check rewards earned

**Expected Results**:
- Unique referral code displayed
- One-click copy function
- Pre-filled sharing messages
- QR code downloadable
- Referral tracking shows:
  - Friend's join date
  - Booking status
  - Reward status
- Terms clearly stated

### Scenario 10: Data Privacy Controls

**Objective**: Test privacy and data management

**Test Steps**:
1. Go to "プライバシー設定" (Privacy settings)
2. Review data sharing options
3. Download personal data
4. Check activity visibility settings
5. Test profile visibility toggle
6. Request data deletion

**Expected Results**:
- Clear privacy controls
- Data download in JSON/CSV
- Can hide:
  - Profile from search
  - Booking history
  - Reviews
- Data deletion request process clear
- 30-day deletion grace period
- Confirmation required for changes

### Scenario 11: Mobile App Settings Sync

**Objective**: Test settings synchronization across devices

**Test Steps**:
1. Update settings on desktop
2. Access account on mobile
3. Verify settings synced
4. Change setting on mobile
5. Check desktop reflects change
6. Test offline behavior

**Expected Results**:
- Settings sync within 30 seconds
- No conflicts between devices
- Offline changes queue and sync
- Last updated timestamp shown
- Sync status indicator
- Manual sync button available

### Scenario 12: Account Activity Log

**Objective**: Test security activity monitoring

**Test Steps**:
1. Navigate to "アクティビティログ" (Activity log)
2. Review recent activities:
   - Logins
   - Password changes
   - Bookings made
   - Profile updates
3. Filter by activity type
4. Check suspicious activity alerts
5. Download activity report

**Expected Results**:
- Comprehensive activity history
- Each entry shows:
  - Timestamp
  - Activity type
  - IP address
  - Device/browser
- Filterable by date and type
- Suspicious activity highlighted
- CSV export option
- 90-day history retention

## Edge Cases

### Edge Case 1: Favorite Shop Closes
- Shop in favorites becomes inactive
- Expected: Marked as closed, option to remove, suggestions for similar shops

### Edge Case 2: Therapist Leaves Platform
- Favorited therapist no longer active
- Expected: Notification sent, marked as unavailable, removed after 30 days

### Edge Case 3: Points Expiration
- Points about to expire unused
- Expected: Email warning 7 days before, push notification 1 day before

### Edge Case 4: Review Moderation Rejection
- Submit review with prohibited content
- Expected: Clear rejection reason, option to edit and resubmit

### Edge Case 5: Data Export Request Limit
- Request data export multiple times rapidly
- Expected: Rate limited to once per 24 hours

## Performance Requirements

- Favorites operations < 500ms
- History loads within 1 second
- Profile updates save < 1 second
- Data export generation < 30 seconds
- Real-time notification delivery

## Accessibility Requirements

1. All interactive elements keyboard accessible
2. Screen reader announcements for state changes
3. Form validation messages clear
4. Color not sole indicator of status
5. Touch targets minimum 44px on mobile