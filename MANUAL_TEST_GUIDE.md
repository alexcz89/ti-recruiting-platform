# Manual Login Test Guide

## Dev Server Status
✅ Running at: **http://localhost:3000**

## Test Account Credentials
```
Email:    candidate.test@example.com
Password: TestCandidate123!
```

## Test Steps

### 1. Open Signin Page
Open your browser and navigate to:
```
http://localhost:3000/auth/signin?role=CANDIDATE
```

### 2. Fill in the Form
- **Email:** `candidate.test@example.com`
- **Password:** `TestCandidate123!`

### 3. Submit the Form
- Click "Ingresar" button
- Watch the browser's network tab (F12 → Network)

### 4. Expected Behavior

#### ✅ Success Indicators:
1. **Network requests you should see:**
   - `POST /api/auth/callback/credentials` → 200
   - `GET /api/auth/session` → 200 (should return user data)
   - Redirect to `/jobs`

2. **Page behavior:**
   - Form button shows "Ingresando..." briefly
   - Page redirects to http://localhost:3000/jobs
   - You should see the jobs listing page
   - User menu/avatar should appear (if implemented)

3. **Session check:**
   - Open DevTools Console (F12)
   - Run: `fetch('/api/debug-session').then(r => r.json()).then(console.log)`
   - Should show user object with:
     ```json
     {
       "user": {
         "id": "cmj8sxka40000yqs3xavv9wrw",
         "name": "Test Candidate",
         "email": "candidate.test@example.com",
         "role": "CANDIDATE"
       }
     }
     ```

#### ❌ Failure Indicators:
1. **Stays on signin page** → Check for error messages
2. **Error: "No se pudo iniciar sesión"** → Credential or auth issue
3. **Redirects to signin after brief loading** → Session not being set
4. **Console errors** → JavaScript/React issues

### 5. Test Protected Routes

After successful login, test these URLs:

- ✅ **http://localhost:3000/jobs** - Should work (public)
- ✅ **http://localhost:3000/profile** - Should work (authenticated)
- ✅ **http://localhost:3000/profile/edit** - Should work (authenticated)
- ❌ **http://localhost:3000/dashboard** - Should redirect (RECRUITER only)

### 6. Test Session Persistence

1. After login, refresh the page
2. Should stay logged in
3. Navigate to `/profile` - should not redirect to signin

### 7. Test Logout

Look for logout button (usually in header or user menu):
1. Click logout
2. Should redirect to home or signin page
3. Try to access `/profile` - should redirect to signin

## Debugging Tips

### If login fails:

1. **Check Server Logs**
   - Look at the terminal running `npm run dev`
   - Should see: `POST /api/auth/callback/credentials`
   - Check for any errors

2. **Check Browser Console**
   - F12 → Console tab
   - Look for JavaScript errors
   - Check Network tab for failed requests

3. **Verify Database**
   ```bash
   npx tsx scripts/verify-test-user.ts
   ```
   Should show email verified: Yes

4. **Test Credentials Directly**
   ```bash
   npx tsx scripts/test-login.ts
   ```
   Should show "✅ Password is correct!"

### If session doesn't persist:

1. **Check AUTH_SECRET in .env**
   - Must be set (not empty)
   - Should be the same across restarts

2. **Check cookies**
   - F12 → Application → Cookies
   - Look for `next-auth.session-token`
   - Should be present after login

3. **Check NEXTAUTH_URL**
   - Should match the URL you're using
   - Currently set to: `http://localhost:3000`

## Quick Verification Script

Run this in your browser console after attempting login:

```javascript
// Check if session exists
fetch('/api/auth/session')
  .then(r => r.json())
  .then(data => {
    if (data.user) {
      console.log('✅ Logged in as:', data.user.email);
      console.log('   Role:', data.user.role);
      console.log('   Email Verified:', data.user.emailVerified);
    } else {
      console.log('❌ Not logged in');
    }
  });
```

## Expected Server Logs

When you submit the login form, you should see:

```
POST /api/auth/callback/credentials 200 in XXXms
GET /api/auth/session 200 in XXms
GET /jobs 200 in XXms
```

## Test Email Verification Flow

To test a new signup with email verification:

1. Go to: http://localhost:3000/auth/signup/candidate
2. Fill in new email (different from test account)
3. Submit
4. Check server console for:
   ```
   📨 [MAIL:DRYRUN] {
     from: 'Bolsa TI <onboarding@resend.dev>',
     to: 'your@email.com',
     subject: 'Confirma tu correo en Bolsa TI'
   }
   ```
5. Copy the verification URL from console
6. Open it in browser
7. Should redirect to `/auth/verify?status=ok`
8. Click "Iniciar sesión" and login with new account

## Screenshots Location

If you ran the automated test, screenshots are saved in:
```
./test-screenshots/
  ├── 01-before-login.png
  ├── 02-after-login.png (if successful)
  └── error.png (if failed)
```
