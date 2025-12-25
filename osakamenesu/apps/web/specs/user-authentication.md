# User Authentication Test Plan

## Overview
This test plan covers all authentication-related functionality including registration, login, password management, and account security features.

## Test Scenarios

### Scenario 1: New User Registration

**Objective**: Test complete new user registration flow

**Test Steps**:
1. Click "新規登録" (Sign Up) from homepage
2. Choose registration method:
   - Email registration
   - LINE registration
   - Google registration
3. For email registration:
   - Enter email address
   - Create password (min 8 chars)
   - Confirm password
   - Enter nickname
   - Accept terms and conditions
4. Click "登録" (Register)
5. Check email for verification
6. Click verification link
7. Return to site

**Expected Results**:
- Form validates in real-time
- Password strength indicator shows
- Terms must be accepted to proceed
- Verification email arrives within 1 minute
- After verification, auto-login occurs
- Welcome page/tutorial shown for new users

### Scenario 2: Email Login Flow

**Objective**: Test standard email/password login

**Test Steps**:
1. Click "ログイン" (Login)
2. Enter registered email
3. Enter correct password
4. Check "ログイン状態を保持" (Remember me) option
5. Click "ログイン" (Login)
6. Verify redirect to dashboard/previous page

**Expected Results**:
- Login form shows email and password fields
- Password field masks input
- "Show password" toggle available
- Remember me keeps session for 30 days
- Successful login redirects appropriately
- User name appears in header

### Scenario 3: Social Login (LINE)

**Objective**: Test LINE authentication integration

**Test Steps**:
1. Click "LINEでログイン" (Login with LINE)
2. Redirect to LINE authorization
3. Approve permissions if first time
4. Auto-redirect back to site
5. Complete profile if needed
6. Access account

**Expected Results**:
- Smooth redirect to LINE
- Permissions clearly explained
- Auto-return after authorization
- Profile pre-filled from LINE data
- Can unlink LINE account later
- Subsequent logins are faster

### Scenario 4: Password Reset Flow

**Objective**: Test forgotten password recovery

**Test Steps**:
1. Click "ログイン" (Login)
2. Click "パスワードを忘れた方" (Forgot password)
3. Enter registered email
4. Submit reset request
5. Check email for reset link
6. Click reset link
7. Enter new password twice
8. Submit password change
9. Try logging in with new password

**Expected Results**:
- Reset email arrives quickly
- Link expires after 24 hours
- Link works only once
- Password requirements enforced
- Success message after reset
- Old password no longer works
- Can immediately login with new password

### Scenario 5: Account Security Settings

**Objective**: Test security features and settings

**Test Steps**:
1. Login and go to account settings
2. Navigate to security section
3. Enable two-factor authentication
4. Scan QR code with authenticator app
5. Enter verification code
6. Save backup codes
7. Logout and login again
8. Enter 2FA code when prompted

**Expected Results**:
- 2FA setup clearly explained
- QR code displays properly
- Backup codes generated (8-10 codes)
- Can download/print backup codes
- 2FA required on next login
- Backup codes work if app unavailable
- Can disable 2FA with password confirmation

### Scenario 6: Session Management

**Objective**: Test multiple session handling

**Test Steps**:
1. Login on desktop browser
2. Login on mobile device
3. Go to account settings > "アクティブなセッション" (Active sessions)
4. Review all active sessions
5. Click "他のセッションをログアウト" (Logout other sessions)
6. Verify other device logged out

**Expected Results**:
- All sessions listed with:
  - Device type
  - Browser
  - Location (approximate)
  - Last active time
- Can revoke individual sessions
- Current session clearly marked
- Revoked sessions require re-login

### Scenario 7: Email Verification Resend

**Objective**: Test resending verification emails

**Test Steps**:
1. Register new account
2. Don't click verification link
3. Try to access restricted features
4. Click "確認メールを再送信" (Resend verification)
5. Check for new email
6. Verify using new link

**Expected Results**:
- Unverified accounts have limited access
- Clear message about verification needed
- Resend option easily accessible
- Rate limiting (e.g., once per minute)
- New email invalidates old links
- Success message after verification

### Scenario 8: Account Deactivation/Deletion

**Objective**: Test account closure process

**Test Steps**:
1. Login to account
2. Go to settings > "アカウント削除" (Delete account)
3. Read deletion warnings
4. Select reason for leaving (optional)
5. Enter password to confirm
6. Click "アカウントを削除" (Delete account)
7. Try logging in again

**Expected Results**:
- Clear warnings about data loss
- Requires password re-entry
- Grace period mentioned (30 days)
- Confirmation email sent
- Cannot login after deletion
- Data recovery possible within grace period

### Scenario 9: Login Attempts and Lockout

**Objective**: Test security against brute force

**Test Steps**:
1. Go to login page
2. Enter valid email
3. Enter wrong password 5 times
4. Observe lockout message
5. Wait or use password reset
6. Login with correct credentials

**Expected Results**:
- Failed attempts counted
- Warning after 3 attempts
- Account locked after 5 attempts
- Lockout duration shown (15-30 min)
- Can still reset password during lockout
- IP-based rate limiting active

### Scenario 10: Remember Me Functionality

**Objective**: Test persistent login feature

**Test Steps**:
1. Login with "Remember me" checked
2. Close browser completely
3. Reopen and navigate to site
4. Verify still logged in
5. Check cookie expiration
6. Test on different browsers

**Expected Results**:
- Session persists after browser close
- Cookie expires after 30 days
- Different browsers require separate login
- Can revoke all remembered sessions
- Secure actions still require password

### Scenario 11: Profile Completion Flow

**Objective**: Test mandatory profile completion

**Test Steps**:
1. Register via social login
2. Skip profile completion
3. Try to make reservation
4. Get redirected to profile completion
5. Fill required fields:
   - Phone number
   - Birth date
   - Gender
6. Save profile
7. Continue to reservation

**Expected Results**:
- Clear indication of required fields
- Cannot access certain features without completion
- Progress indicator shows completion %
- Social login data pre-populates where possible
- Validation for phone format
- Age verification for adult services

### Scenario 12: Mobile App Authentication

**Objective**: Test authentication in mobile context

**Test Steps**:
1. Open site on mobile browser
2. Complete login flow
3. Add to home screen if PWA
4. Open from home screen
5. Verify still authenticated
6. Test biometric login if available

**Expected Results**:
- Mobile-optimized login forms
- Keyboard types match input fields
- Biometric prompt for supported devices
- Sessions shared between browser and PWA
- Deep links maintain authentication

## Edge Cases

### Edge Case 1: Duplicate Email Registration
- Try registering with already-used email
- Expected: Clear message that email exists, option to reset password

### Edge Case 2: Expired Verification Link
- Click verification link after 48 hours
- Expected: Link expired message, option to resend

### Edge Case 3: Social Account Email Conflict
- Try social login with email already registered
- Expected: Option to link accounts or use different method

### Edge Case 4: Invalid Social Login State
- Manipulate OAuth callback parameters
- Expected: Graceful error handling, return to login

### Edge Case 5: Simultaneous Password Resets
- Request reset from two devices quickly
- Expected: Both emails sent, latest link valid

## Security Requirements

1. All auth pages use HTTPS
2. Passwords never sent in plain text
3. Session tokens use secure, httpOnly cookies
4. CSRF protection on all forms
5. Rate limiting on all auth endpoints
6. Password complexity requirements enforced
7. SQL injection prevention
8. XSS protection in user inputs

## Accessibility Requirements

1. Form labels associated with inputs
2. Error messages linked to fields
3. Tab order logical through forms
4. Password visibility toggle keyboard accessible
5. Social login buttons properly labeled
6. Loading states announced to screen readers

## Performance Criteria

- Login page loads in < 1 second
- Authentication process < 2 seconds
- Social login redirect < 3 seconds total
- Email delivery within 1 minute
- No noticeable delay for 2FA verification