# Test Accounts

This document contains test accounts for local development and testing.

## Test Candidate Account

**Created:** 2025-12-16
**Status:** ✅ Active & Email Verified

### Login Credentials
- **Email:** `candidate.test@example.com`
- **Password:** `TestCandidate123!`
- **Role:** CANDIDATE
- **Login URL:** http://localhost:3000/auth/signin?role=CANDIDATE

### Account Details
- **User ID:** `cmj8sxka40000yqs3xavv9wrw`
- **Name:** Test Candidate
- **Location:** Monterrey, NL, Mexico
- **Phone:** +528112345678
- **Email Verified:** Yes ✓

### Test Coverage

This account can be used to test:
- ✅ Candidate login flow
- ✅ Email verification (already verified)
- ✅ Job browsing at `/jobs`
- ✅ Job application submission
- ✅ Profile editing at `/profile/edit`
- ✅ Application tracking at `/profile/applications`
- ✅ Resume builder at `/resume/builder`

## Creating Additional Test Accounts

### Candidate Account
```bash
# Create with auto-verification
npx tsx scripts/create-test-candidate.ts --verify

# Create without verification (to test email flow)
npx tsx scripts/create-test-candidate.ts

# Delete and recreate
npx tsx scripts/create-test-candidate.ts --delete --verify
```

### Verify Test User
```bash
npx tsx scripts/verify-test-user.ts
```

### Test Login Credentials
```bash
# Test default candidate
npx tsx scripts/test-login.ts

# Test specific credentials
npx tsx scripts/test-login.ts "email@example.com" "password"
```

## Demo Recruiter Account

From `prisma/seed.ts`:
- **Email:** `alejandro@task.com.mx`
- **Company:** Task Consultores
- **Role:** RECRUITER
- **Status:** Approved
- **Login URL:** http://localhost:3000/auth/signin?role=RECRUITER

**Note:** Password must be set during first signup or manually in database.

## Security Notes

⚠️ **These are test accounts for local development only.**
- Never commit real passwords to version control
- Never use these credentials in production
- Change all test passwords before deploying

## Testing Email Verification

Since `EMAIL_ENABLED=false` in `.env`, verification emails are logged to console:

1. Sign up a new account
2. Check dev server console for: `📨 [MAIL:DRYRUN]`
3. Copy the verification URL with JWT token
4. Visit the URL to complete verification

The token includes:
- Signed JWT (can't be forged)
- 60-minute expiration
- Email payload (encrypted)

## Cleanup

To remove test accounts:
```bash
# Delete specific user
npx tsx scripts/create-test-candidate.ts --delete

# Or via Prisma Studio
npx prisma studio
# Navigate to User model and delete manually
```
