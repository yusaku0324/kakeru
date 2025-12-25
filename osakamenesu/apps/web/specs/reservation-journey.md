# Reservation Journey Test Plan

## Overview
This test plan covers the complete reservation flow from selecting a service to confirmation, including various booking paths and payment options.

## Test Scenarios

### Scenario 1: Complete Reservation Flow from Shop

**Objective**: Test standard reservation process starting from shop page

**Preconditions**:
- User has account but not logged in
- Valid shop with available slots exists

**Test Steps**:
1. Navigate to shop details page
2. Click "予約する" (Reserve) button
3. System prompts for login
4. Login with valid credentials
5. Select service from menu:
   - Choose "90分コース" (90-min course)
   - Note price: ¥15,000
6. Choose therapist or "指名なし" (No preference)
7. Select date from calendar
8. Choose available time slot (e.g., 14:00)
9. Review booking details
10. Add optional requests in comments
11. Proceed to confirmation
12. Select payment method
13. Complete booking

**Expected Results**:
- Each step flows smoothly to next
- Selected information carries through
- Price calculations are accurate
- Confirmation page shows all details
- Booking confirmation email sent
- Booking appears in user's history

### Scenario 2: Quick Booking from Therapist Profile

**Objective**: Test direct booking of specific therapist

**Test Steps**:
1. Navigate to therapist profile
2. Click "この therapist を予約" (Book this therapist)
3. Login if required
4. Calendar shows only this therapist's availability
5. Select date and time
6. Choose service duration
7. Confirm booking details
8. Complete payment
9. Receive confirmation

**Expected Results**:
- Therapist pre-selected and locked
- Only their available slots shown
- Cannot change therapist during flow
- Therapist name prominent throughout
- Special requests section available

### Scenario 3: Group/Multiple Reservation

**Objective**: Test booking for multiple people

**Test Steps**:
1. Start standard reservation flow
2. Look for "人数" (Number of people) option
3. Select "2名" (2 people)
4. Choose if same or different services
5. If different, select each service
6. Select therapists (if available for groups)
7. Choose time slot that accommodates both
8. Review doubled pricing
9. Complete booking

**Expected Results**:
- System checks availability for multiple slots
- Price correctly multiplies
- Can assign different therapists
- Confirmation shows all participants
- Special group instructions appear

### Scenario 4: Reservation with Special Requests

**Objective**: Test handling of customer special requests

**Test Steps**:
1. Proceed through booking to comments section
2. Enter special requests:
   - "強めの圧でお願いします" (Strong pressure please)
   - "香りの少ないオイル希望" (Low-scent oil preferred)
3. Check character limit (if any)
4. Continue to confirmation
5. Verify requests appear in summary
6. Complete booking

**Expected Results**:
- Text field accepts Japanese characters
- Character counter if limit exists
- Requests shown in confirmation
- Requests included in confirmation email
- Shop can view requests in their system

### Scenario 5: Modification of Existing Reservation

**Objective**: Test changing existing booking

**Test Steps**:
1. Login to account
2. Go to "予約履歴" (Booking History)
3. Find future reservation
4. Click "変更" (Modify)
5. Change time from 14:00 to 16:00
6. Review change summary
7. Confirm modification
8. Check for confirmation

**Expected Results**:
- Only future bookings can be modified
- Modification deadline shown (e.g., 24h before)
- New availability checked in real-time
- Price adjustments if service changed
- Confirmation email for changes
- Original booking updated, not duplicated

### Scenario 6: Cancellation Flow

**Objective**: Test reservation cancellation process

**Test Steps**:
1. Access booking history
2. Select future reservation
3. Click "キャンセル" (Cancel)
4. Read cancellation policy
5. Select cancellation reason
6. Confirm cancellation
7. Check for confirmation message

**Expected Results**:
- Cancellation policy clearly shown
- Cancellation deadline enforced
- Reason selection (optional/required)
- Immediate confirmation
- Refund information if applicable
- Slot becomes available again
- Cancellation email sent

### Scenario 7: Payment Method Selection

**Objective**: Test various payment options

**Test Steps**:
1. Reach payment step in booking flow
2. Review available payment methods:
   - Credit card
   - PayPay
   - LINE Pay
   - Cash on arrival (if available)
3. Select credit card
4. Enter card details (test card)
5. Complete payment
6. Verify payment confirmation

**Expected Results**:
- All advertised payment methods shown
- Secure payment form (HTTPS)
- Card validation in real-time
- 3D Secure flow if required
- Payment receipt generated
- Payment status in booking details

### Scenario 8: Waitlist Functionality

**Objective**: Test waitlist when preferred slot unavailable

**Test Steps**:
1. Select fully booked time slot
2. Click "キャンセル待ち" (Join Waitlist)
3. Confirm waitlist registration
4. Provide notification preferences
5. Submit waitlist request
6. Check confirmation

**Expected Results**:
- Waitlist option clearly visible
- Position in queue shown (if applicable)
- Notification method selection
- Can cancel waitlist position
- Auto-notification when slot opens
- Time limit to claim opened slot

### Scenario 9: Mobile Booking Experience

**Objective**: Test complete booking flow on mobile

**Test Steps**:
1. Access site on mobile (iPhone/Android)
2. Navigate to shop
3. Tap reserve button
4. Complete flow using touch interface
5. Test date picker on mobile
6. Test time slot selection
7. Complete payment on mobile

**Expected Results**:
- All buttons/links touch-friendly (44px min)
- Date picker mobile-optimized
- Form inputs trigger appropriate keyboards
- Payment form mobile-friendly
- No horizontal scrolling required
- Progress indicator stays visible

### Scenario 10: Recurring Reservation Setup

**Objective**: Test booking same slot weekly/monthly

**Test Steps**:
1. Complete regular booking
2. On confirmation, select "定期予約にする" (Make recurring)
3. Choose frequency:
   - 毎週 (Weekly)
   - 隔週 (Bi-weekly)
   - 毎月 (Monthly)
4. Set end date or number of occurrences
5. Review all future dates
6. Confirm recurring booking

**Expected Results**:
- Clear recurring options
- Conflict detection for future dates
- Can skip specific dates
- Bulk cancellation option
- Separate confirmations for each
- Price calculation for all bookings

### Scenario 11: Peak Time/Dynamic Pricing

**Objective**: Test booking during peak hours with different pricing

**Test Steps**:
1. Navigate to shop with dynamic pricing
2. Select weekend evening slot
3. Notice price difference indicator
4. Continue with booking
5. Verify peak pricing in summary

**Expected Results**:
- Price differences clearly marked
- "Peak time" badge or indicator
- Explanation of pricing available
- Correct price throughout flow
- No price changes after selection

### Scenario 12: Guest Booking (Without Account)

**Objective**: Test reservation without creating account

**Test Steps**:
1. Start booking flow
2. At login prompt, choose "ゲストとして続ける" (Continue as guest)
3. Enter contact information:
   - Name
   - Phone
   - Email
4. Complete booking flow
5. Receive confirmation

**Expected Results**:
- Guest option clearly available
- Required fields marked
- Email/SMS verification step
- Booking reference number provided
- Limited modification options
- Prompt to create account post-booking

## Edge Cases

### Edge Case 1: Double Booking Prevention
- Open same slot in two browser tabs
- Attempt to book both
- Expected: First booking succeeds, second shows error

### Edge Case 2: Last-Minute Booking
- Try to book slot starting in 30 minutes
- Expected: Either blocked or special confirmation required

### Edge Case 3: Payment Failure Recovery
- Use card that will be declined
- Expected: Clear error message, can retry with different payment

### Edge Case 4: Session Timeout
- Start booking, wait 30 minutes, try to complete
- Expected: Session saved or graceful redirect to re-login

### Edge Case 5: Network Interruption
- Disconnect during final submission
- Expected: Booking state preserved, can resume or check status

## Validation Rules

1. Cannot book past dates
2. Cannot book slots less than X hours in advance
3. Phone number format validation
4. Email format validation
5. Credit card number validation
6. Maximum advance booking limit (e.g., 1 month)

## Accessibility Requirements

1. All form fields properly labeled
2. Error messages associated with fields
3. Calendar keyboard navigable
4. Screen reader announces selected dates/times
5. Focus management through multi-step flow
6. High contrast mode support

## Performance Criteria

- Each step loads within 1 second
- Calendar renders within 500ms
- Payment processing under 3 seconds
- Real-time availability updates
- No double-booking due to race conditions