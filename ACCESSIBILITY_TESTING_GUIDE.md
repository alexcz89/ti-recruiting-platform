# ♿ Accessibility Testing Guide

Quick tests to verify WCAG 2.1 AA improvements are working correctly.

---

## 🎯 Quick Tests (5-10 minutes)

### Test 1: Keyboard Navigation ✅
**Location:** `/jobs` page (job listings)

1. Open the page
2. Press **Tab** repeatedly
3. Verify you see a **green outline** around job items
4. Press **Enter** or **Space** on a job item
5. Job detail panel should open/highlight

**Expected:** Visible focus ring on all interactive elements ✅

---

### Test 2: Focus Visibility 📍
**Location:** Any form page (e.g., `/auth/signin`)

1. Open the page
2. Press **Tab** to focus on form inputs
3. Look for **green outline** around inputs
4. Outline should be **2px solid**, offset **2px** from element
5. Dark mode should show **emerald-300** instead of **emerald-500**

**Expected:** Clear visual focus indicator on inputs ✅

---

### Test 3: Form Validation 🚨
**Location:** `/auth/signin` or `/profile/edit`

1. Try to submit form without filling inputs
2. Look for **error message** below each field
3. Message text should be **readable** (not faded)
4. Text color should be **dark red** (not light red)
5. Error should have **red border** or **red icon**

**Expected:** Error messages are clearly visible and readable ✅

---

### Test 4: Loading States ⏳
**Location:** Any page with loading state

1. Open browser DevTools (F12)
2. Go to Network tab
3. Set throttling to "Slow 3G"
4. Reload the page
5. Instead of blank space, you should see **skeleton loaders**
6. Skeleton should **pulse/animate** to show it's loading

**Expected:** Visual placeholder instead of blank space ✅

---

### Test 5: Color Contrast 🎨
**Location:** Any page (test both light and dark modes)

1. Use [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
2. Sample these text colors:
   - "Muted text" (should use `text-zinc-600` or `text-zinc-400`)
   - Job location/date stamps
   - Form helper text
3. Verify contrast ratio is **at least 4.5:1**

**Expected:** All text meets minimum 4.5:1 contrast ratio ✅

---

## 🔧 Detailed Tests (15-30 minutes)

### Test 6: Screen Reader Support 🎧
**Tools:** NVDA (Windows) or VoiceOver (Mac)

#### With NVDA (Windows):
1. Download [NVDA](https://www.nvaccess.org/) (free)
2. Start NVDA (Ctrl + Alt + N)
3. Navigate to `/jobs` page
4. Press **H** to hear headings
5. Press **B** for buttons
6. Use **Down arrow** to read each job item

**Expected:**
- Hear: "Heading level 2: Vacantes" or similar
- Hear job title, company, location
- Hear button labels like "Postularme"

#### With VoiceOver (Mac):
1. Enable VoiceOver: **Cmd + F5**
2. Use **VO + Right/Left Arrow** to navigate
3. Navigate to a form field
4. Listen for label, hint text, and error messages

**Expected:**
- Screen reader announces all labels and field types
- Error messages are announced as alerts
- Button states ("loading", "already applied") are announced

---

### Test 7: Comprehensive Keyboard Test ⌨️
**Location:** `/jobs` page → job detail view

1. **Tab** through the page - verify focus order makes sense
2. **Shift + Tab** to go backwards
3. On a job list item:
   - Focus should show **green outline**
   - Press **Enter** or **Space** to activate
   - Job detail should update
4. On buttons:
   - Press **Enter** or **Space** (not just Enter)
5. On form inputs:
   - Type text normally
   - Press **Shift + Tab** to go back to previous field
6. **Escape** key (if applicable to modals)

**Expected:**
- Can navigate entire page with keyboard only
- No focus gets trapped
- All buttons/links are keyboard accessible

---

### Test 8: Mobile Keyboard Test 📱
**Location:** `/jobs` page on mobile device

1. Open on mobile (iOS/Android)
2. Tap on a job item
3. Check if **blue/green outline** appears
4. Keyboard should NOT auto-hide
5. On buttons with hidden text (e.g., "Postularme" hidden on mobile)
6. Touch the button
7. Button should still be usable (aria-label should be announced)

**Expected:**
- Mobile keyboard focuses correctly
- Icon buttons are still usable
- Touch targets are at least 44x44px

---

### Test 9: Dark Mode Contrast ✨
**Location:** Toggle dark mode on any page

1. Enable dark mode (usually in app settings or browser)
2. Sample these colors:
   - Regular text (should still be readable)
   - Muted text (should use `text-zinc-400` or similar)
   - Focus rings (should show `emerald-300` instead of `emerald-500`)
3. Use WebAIM Contrast Checker with dark background colors

**Expected:**
- All text readable in both light and dark modes
- Focus indicator visible in dark mode
- Contrast ratio at least 4.5:1

---

### Test 10: Zoom Test 🔍
**Location:** Any page

1. Zoom in to **200%** (Ctrl + Plus several times)
2. Verify:
   - Text doesn't get cut off
   - Layout doesn't break
   - No horizontal scrollbar appears (except if intentional)
   - Focus indicator is still visible
3. Zoom back to 100%

**Expected:**
- Page remains usable at 200% zoom
- No content is hidden or inaccessible
- Focus indicators remain visible

---

## 🚀 Automated Testing

### Run axe DevTools
1. Install [axe DevTools](https://chrome.google.com/webstore/detail/axe-devtools-web-accessibility-testing/lhdoppojpmngadmnkpklempisson/)
2. Open the page
3. Click axe icon → "Scan ALL of my page"
4. Review report:
   - Should see fewer violations (especially contrast)
   - Check "Best Practices" section
5. Compare to baseline

**What to look for:**
- ✅ Contrast violations (should be reduced)
- ✅ Missing labels (should be fixed)
- ✅ Missing alt text (should be fixed)

---

### Run WAVE
1. Go to [WebAIM WAVE](https://wave.webaim.org/)
2. Enter URL of page
3. Check for:
   - Red errors (should be minimal)
   - Yellow alerts (note these for review)
   - Green checkmarks (these are good)

**Expected:**
- Fewer contrast errors than before
- Proper form labels present
- Meaningful alt text on images

---

## 📊 Before/After Comparison

### Components Tested

| Component | Test Type | Before | After |
|-----------|-----------|--------|-------|
| JobsFeed | Keyboard | ❌ No focus ring | ✅ Visible outline |
| JobsFeed | Screen reader | ❌ No aria-label | ✅ Announces title/company |
| RhfFields | Contrast | ❌ Error text faded (red-500) | ✅ Dark red (red-700) |
| RhfFields | Form errors | ❌ No aria-invalid | ✅ Marked as invalid |
| ApplyButton | Mobile | ❌ Hidden text unreadable | ✅ aria-label fallback |
| Nav | Keyboard | ⚠️ Works but no focus ring | ✅ Visible focus ring |
| Sign-in page | Loading | ❌ Text "Cargando..." | ✅ Form skeleton |

---

## 🐛 Known Limitations & Next Steps

### Current Status
- ✅ Keyboard navigation working
- ✅ Form accessibility improved
- ✅ Screen reader support (basic)
- ✅ Contrast ratios fixed
- ⚠️ Rich components (Kanban, date picker) need testing

### Future Improvements
- [ ] Test Kanban board with screen readers
- [ ] Add form field hints (aria-describedby)
- [ ] Required field indicators (*)
- [ ] Focus trap in modals
- [ ] Dialog ARIA attributes
- [ ] Tooltip accessibility

---

## 📋 Testing Checklist

### Quick Test (5 min)
- [ ] Keyboard Tab navigation works
- [ ] Focus ring is visible (green outline)
- [ ] Form errors are readable
- [ ] Loading states show skeleton
- [ ] Colors look good in dark mode

### Detailed Test (20 min)
- [ ] Screen reader announces labels
- [ ] All buttons keyboard accessible
- [ ] Mobile focus works correctly
- [ ] 200% zoom doesn't break layout
- [ ] axe DevTools shows fewer violations

### Full Audit (1 hour)
- [ ] Run WAVE scanner
- [ ] Run axe DevTools
- [ ] Test with NVDA/VoiceOver
- [ ] Test all interactive components
- [ ] Document findings in issue tracker

---

## 🔗 Useful Commands

### Test keyboard only (hide mouse)
```bash
# macOS
defaults write -g com.apple.mouse.scaling 0

# Windows (no direct command, use mouse hide utilities)
```

### Test with screen reader (command examples)
```bash
# NVDA (Windows) - keyboard shortcuts
# H = next heading
# B = next button
# L = next link
# Down arrow = next item
# Ctrl + Home = start of page

# VoiceOver (Mac)
# VO = Control + Option
# VO + Right/Left arrow = navigate
# VO + Space = activate
# VO + U = open rotor
```

---

## 📞 Support & Resources

### If Focus Ring Not Showing
1. Check if `focus-ring` class is applied to element
2. Verify `styles/focus.css` is imported in `app/globals.css`
3. Check browser CSS in DevTools: should show `outline: 2px solid`

### If Colors Look Wrong
1. Verify dark mode toggle is working
2. Check color values in `app/globals.css` CSS variables
3. Run WebAIM Contrast Checker to get exact ratio
4. Reference `lib/a11y/color-contrast.ts` for safe colors

### If Screen Reader Not Working
1. Verify screen reader is installed and running
2. Check that aria-label/aria-labelledby attributes are present
3. In DevTools, inspect element for ARIA attributes
4. Test in separate browser tab (sometimes browser quirks)

---

## 📚 Reference

### WCAG 2.1 Criteria We're Testing
- **1.4.3 Contrast (AA):** Text has 4.5:1 ratio
- **2.1.1 Keyboard:** All functionality available via keyboard
- **2.4.3 Focus Order:** Focus order is logical
- **2.4.7 Focus Visible:** Focus is clearly visible
- **3.3.1 Error Identification:** Errors are identified
- **4.1.2 Name/Role/Value:** Components have proper ARIA
- **4.1.3 Status Messages:** Updates announced to AT

### Tools to Bookmark
- [WCAG 2.1 Quickref](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [NVDA Download](https://www.nvaccess.org/)
- [axe DevTools](https://chrome.google.com/webstore/detail/axe-devtools-web-accessibility-testing/lhdoppojpmngadmnkpklempisson/)

---

**Last Updated:** June 10, 2026  
**Testing Status:** Ready for manual verification
