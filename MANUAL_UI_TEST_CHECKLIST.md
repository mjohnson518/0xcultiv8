# Cultiv8 Platform - Manual UI/UX Test Checklist

**Version:** 1.0  
**Date:** October 31, 2025  
**Tester:** _________________  
**Environment:** Local Dev (`localhost:4000`)

---

## Instructions

1. Open browser to `http://localhost:4000`
2. Have wallet (MetaMask) ready for testing
3. Test in **both Light and Dark modes**
4. Test on different screen sizes (Mobile, Tablet, Desktop)
5. Check all boxes as you complete each test
6. Note any issues in the "Notes" column

---

## Section 1: Visual & Layout Tests

### Dashboard Page (`/`)

| # | Test | Light Mode | Dark Mode | Mobile | Desktop | Notes |
|---|------|------------|-----------|--------|---------|-------|
| 1.1 | Page loads without errors | ☐ | ☐ | ☐ | ☐ | |
| 1.2 | ASCII logo displays correctly | ☐ | ☐ | ☐ | ☐ | |
| 1.3 | Metric cards show values | ☐ | ☐ | ☐ | ☐ | |
| 1.4 | Metric cards have correct border color | ☐ | ☐ Green | ☐ | ☐ | |
| 1.5 | "Run Scan" button visible | ☐ | ☐ | ☐ | ☐ | |
| 1.6 | Navigation links work | ☐ | ☐ | ☐ | ☐ | |
| 1.7 | Text readable in both modes | ☐ | ☐ | ☐ | ☐ | |
| 1.8 | No layout overflow/scroll issues | ☐ | ☐ | ☐ | ☐ | |
| 1.9 | Responsive on mobile (< 768px) | ☐ | ☐ | ☐ | ☐ | |
| 1.10 | Dark mode toggle button works | ☐ | ☐ | ☐ | ☐ | |

### Agent Page (`/agent`)

| # | Test | Light Mode | Dark Mode | Mobile | Desktop | Notes |
|---|------|------------|-----------|--------|---------|-------|
| 2.1 | Page loads without errors | ☐ | ☐ | ☐ | ☐ | |
| 2.2 | Terminal component displays | ☐ | ☐ | ☐ | ☐ | |
| 2.3 | Terminal has black background | ☐ | ☐ | ☐ | ☐ | |
| 2.4 | Terminal text is green | ☐ | ☐ | ☐ | ☐ | |
| 2.5 | Terminal text always readable | ☐ | ☐ | ☐ | ☐ | |
| 2.6 | Cursor blinks in terminal | ☐ | ☐ | ☐ | ☐ | |
| 2.7 | Agent status shows correctly | ☐ | ☐ | ☐ | ☐ | |
| 2.8 | Quick stats boxes display | ☐ | ☐ | ☐ | ☐ | |
| 2.9 | "Run Agent" button works | ☐ | ☐ | ☐ | ☐ | |
| 2.10 | Strategy preview card shows | ☐ | ☐ | ☐ | ☐ | |

### Opportunities Page (`/opportunities`)

| # | Test | Light Mode | Dark Mode | Mobile | Desktop | Notes |
|---|------|------------|-----------|--------|---------|-------|
| 3.1 | Page loads without errors | ☐ | ☐ | ☐ | ☐ | |
| 3.2 | Opportunities table displays | ☐ | ☐ | ☐ | ☐ | |
| 3.3 | Table headers visible | ☐ | ☐ | ☐ | ☐ | |
| 3.4 | Rows have correct border styling | ☐ | ☐ | ☐ | ☐ | |
| 3.5 | APY values display correctly | ☐ | ☐ | ☐ | ☐ | |
| 3.6 | Risk scores show 1-10 scale | ☐ | ☐ | ☐ | ☐ | |
| 3.7 | Filter dropdown works | ☐ | ☐ | ☐ | ☐ | |
| 3.8 | "Refresh" button works | ☐ | ☐ | ☐ | ☐ | |
| 3.9 | Row selection highlights | ☐ | ☐ | ☐ | ☐ | |
| 3.10 | Horizontal scroll on mobile | ☐ | ☐ | ☐ | ☐ | |

### Settings Page (`/settings`)

| # | Test | Light Mode | Dark Mode | Mobile | Desktop | Notes |
|---|------|------------|-----------|--------|---------|-------|
| 4.1 | Page loads without errors | ☐ | ☐ | ☐ | ☐ | |
| 4.2 | Agent Configuration card shows | ☐ | ☐ | ☐ | ☐ | |
| 4.3 | Fee Structure card shows | ☐ | ☐ | ☐ | ☐ | |
| 4.4 | Risk Framework card shows | ☐ | ☐ | ☐ | ☐ | |
| 4.5 | All cards collapsible | ☐ | ☐ | ☐ | ☐ | |
| 4.6 | Toggle switches work | ☐ | ☐ | ☐ | ☐ | |
| 4.7 | Number inputs validated | ☐ | ☐ | ☐ | ☐ | |
| 4.8 | Risk slider works | ☐ | ☐ | ☐ | ☐ | |
| 4.9 | Save button functional | ☐ | ☐ | ☐ | ☐ | |
| 4.10 | Changes persist after save | ☐ | ☐ | ☐ | ☐ | |

---

## Section 2: Fee Structure Display Tests

### Fee Breakdown Component

| # | Test | Pass | Notes |
|---|------|------|-------|
| 5.1 | Current tier displays with icon | ☐ | |
| 5.2 | Management fee % correct | ☐ | |
| 5.3 | Performance fee % correct | ☐ | |
| 5.4 | Current AUM shows | ☐ | |
| 5.5 | Monthly fee calculated correctly | ☐ | |
| 5.6 | Annual fee calculated correctly | ☐ | |
| 5.7 | ASCII borders render properly | ☐ | |
| 5.8 | All currency formatted with $ and 2 decimals | ☐ | |

### All Tiers Table

| # | Test | Pass | Notes |
|---|------|------|-------|
| 6.1 | All 4 tiers show in table | ☐ | |
| 6.2 | Tier icons display (◆ ◈ ◉ ◎) | ☐ | |
| 6.3 | Min AUM correct for each tier | ☐ | |
| 6.4 | Management fees correct | ☐ | |
| 6.5 | Performance fees correct | ☐ | |
| 6.6 | Current tier highlighted | ☐ | |
| 6.7 | Active tier shows [●ACTIVE] | ☐ | |
| 6.8 | Eligible tiers show [✓ELIGIBLE] | ☐ | |
| 6.9 | Locked tiers show [○LOCKED] | ☐ | |
| 6.10 | Table responsive on mobile | ☐ | |

### Legend & Explanation

| # | Test | Pass | Notes |
|---|------|------|-------|
| 7.1 | Legend shows status meanings | ☐ | |
| 7.2 | Fee explanation clear | ☐ | |
| 7.3 | Revenue model text displays | ☐ | |
| 7.4 | 15% margin note visible | ☐ | |
| 7.5 | All text readable in dark mode | ☐ | |

---

## Section 3: Functional Tests

### Dark Mode Toggle

| # | Test | Pass | Notes |
|---|------|------|-------|
| 8.1 | Button shows current mode | ☐ | |
| 8.2 | Click toggles mode | ☐ | |
| 8.3 | Background changes immediately | ☐ | |
| 8.4 | Text color adapts | ☐ | |
| 8.5 | Borders change to green in dark | ☐ | |
| 8.6 | Terminal remains black | ☐ | |
| 8.7 | Preference saved (survives reload) | ☐ | |
| 8.8 | Works on all pages | ☐ | |

### Navigation

| # | Test | Pass | Notes |
|---|------|------|-------|
| 9.1 | All nav links clickable | ☐ | |
| 9.2 | Active page highlighted | ☐ | |
| 9.3 | Browser back button works | ☐ | |
| 9.4 | Browser forward button works | ☐ | |
| 9.5 | Logo click returns to dashboard | ☐ | |
| 9.6 | No 404 errors | ☐ | |

### Form Inputs

| # | Test | Pass | Notes |
|---|------|------|-------|
| 10.1 | Number inputs accept valid values | ☐ | |
| 10.2 | Invalid inputs show error | ☐ | |
| 10.3 | Error messages clear | ☐ | |
| 10.4 | Submit disabled with errors | ☐ | |
| 10.5 | Success message after save | ☐ | |
| 10.6 | Range slider updates value display | ☐ | |

### Buttons

| # | Test | Pass | Notes |
|---|------|------|-------|
| 11.1 | All buttons have hover state | ☐ | |
| 11.2 | Primary buttons stand out | ☐ | |
| 11.3 | Disabled state visible | ☐ | |
| 11.4 | Loading state shows | ☐ | |
| 11.5 | Click feedback immediate | ☐ | |

---

## Section 4: Interactive Features

### Run Scan Functionality

| # | Test | Pass | Notes |
|---|------|------|-------|
| 12.1 | Button changes to "SCANNING..." | ☐ | |
| 12.2 | Loading indicator shows | ☐ | |
| 12.3 | Navigates to /agent on completion | ☐ | |
| 12.4 | Terminal shows scan results | ☐ | |
| 12.5 | Errors handled gracefully | ☐ | |

### Collapsible Cards

| # | Test | Pass | Notes |
|---|------|------|-------|
| 13.1 | Click header collapses card | ☐ | |
| 13.2 | Arrow icon changes direction | ☐ | |
| 13.3 | Content hidden when collapsed | ☐ | |
| 13.4 | Re-click expands card | ☐ | |
| 13.5 | Multiple cards work independently | ☐ | |

### Modals (if any)

| # | Test | Pass | Notes |
|---|------|------|-------|
| 14.1 | Modal opens on trigger | ☐ | |
| 14.2 | Backdrop prevents clicks | ☐ | |
| 14.3 | Close button works | ☐ | |
| 14.4 | Escape key closes modal | ☐ | |
| 14.5 | Focus trapped in modal | ☐ | |

---

## Section 5: Performance & Responsiveness

### Page Load Times

| # | Test | Target | Actual | Pass | Notes |
|---|------|--------|--------|------|-------|
| 15.1 | Dashboard first load | < 2s | | ☐ | |
| 15.2 | Agent page load | < 2s | | ☐ | |
| 15.3 | Opportunities page load | < 3s | | ☐ | |
| 15.4 | Settings page load | < 2s | | ☐ | |
| 15.5 | Navigation between pages | < 500ms | | ☐ | |

### Mobile Responsiveness

| # | Device | Test | Pass | Notes |
|---|--------|------|------|-------|
| 16.1 | iPhone SE (375px) | All pages render | ☐ | |
| 16.2 | iPhone 12 (390px) | All pages render | ☐ | |
| 16.3 | iPad Mini (768px) | All pages render | ☐ | |
| 16.4 | iPad Pro (1024px) | All pages render | ☐ | |
| 16.5 | Desktop (1920px) | All pages render | ☐ | |

### Touch Interactions (Mobile)

| # | Test | Pass | Notes |
|---|------|------|-------|
| 17.1 | Buttons tap-able | ☐ | |
| 17.2 | Links tap-able | ☐ | |
| 17.3 | No accidental touches | ☐ | |
| 17.4 | Scroll smooth | ☐ | |
| 17.5 | Pinch zoom disabled (if intended) | ☐ | |

---

## Section 6: Accessibility

### Keyboard Navigation

| # | Test | Pass | Notes |
|---|------|------|-------|
| 18.1 | Tab through all interactive elements | ☐ | |
| 18.2 | Focus indicators visible | ☐ | |
| 18.3 | Enter activates buttons | ☐ | |
| 18.4 | Space activates buttons | ☐ | |
| 18.5 | Escape closes modals | ☐ | |
| 18.6 | Tab order logical | ☐ | |

### Screen Reader

| # | Test | Pass | Notes |
|---|------|------|-------|
| 19.1 | All images have alt text | ☐ | |
| 19.2 | Form inputs have labels | ☐ | |
| 19.3 | Buttons have descriptive text | ☐ | |
| 19.4 | Error messages announced | ☐ | |
| 19.5 | Page title descriptive | ☐ | |

### Color Contrast

| # | Test | Pass | Notes |
|---|------|------|-------|
| 20.1 | Light mode text readable | ☐ | |
| 20.2 | Dark mode text readable | ☐ | |
| 20.3 | Links distinguishable | ☐ | |
| 20.4 | Buttons have sufficient contrast | ☐ | |
| 20.5 | Focus indicators visible | ☐ | |

---

## Section 7: Browser Compatibility

Test in multiple browsers:

### Chrome

| # | Test | Pass | Notes |
|---|------|------|-------|
| 21.1 | All pages render correctly | ☐ | |
| 21.2 | All features work | ☐ | |
| 21.3 | No console errors | ☐ | |

### Firefox

| # | Test | Pass | Notes |
|---|------|------|-------|
| 22.1 | All pages render correctly | ☐ | |
| 22.2 | All features work | ☐ | |
| 22.3 | No console errors | ☐ | |

### Safari

| # | Test | Pass | Notes |
|---|------|------|-------|
| 23.1 | All pages render correctly | ☐ | |
| 23.2 | All features work | ☐ | |
| 23.3 | No console errors | ☐ | |

### Edge

| # | Test | Pass | Notes |
|---|------|------|-------|
| 24.1 | All pages render correctly | ☐ | |
| 24.2 | All features work | ☐ | |
| 24.3 | No console errors | ☐ | |

---

## Section 8: Error Handling

### Network Errors

| # | Test | Pass | Notes |
|---|------|------|-------|
| 25.1 | Offline mode shows message | ☐ | |
| 25.2 | API failure handled gracefully | ☐ | |
| 25.3 | Retry mechanism works | ☐ | |
| 25.4 | Error messages user-friendly | ☐ | |

### Invalid Data

| # | Test | Pass | Notes |
|---|------|------|-------|
| 26.1 | Invalid form data rejected | ☐ | |
| 26.2 | Missing required fields caught | ☐ | |
| 26.3 | Type mismatches prevented | ☐ | |
| 26.4 | Boundary values handled | ☐ | |

---

## Final Checklist Summary

**Total Tests:** 150+  
**Tests Passed:** _____  
**Tests Failed:** _____  
**Success Rate:** _____%

### Critical Issues Found:
1. _________________________________
2. _________________________________
3. _________________________________

### Medium Issues Found:
1. _________________________________
2. _________________________________
3. _________________________________

### Minor Issues Found:
1. _________________________________
2. _________________________________
3. _________________________________

---

## Tester Sign-Off

**Name:** _________________________________  
**Date:** _________________________________  
**Time Spent:** ____________ hours  
**Overall Assessment:** ☐ Pass ☐ Fail ☐ Needs Work

**Recommendation:**
☐ Ready for mainnet deployment  
☐ Needs bug fixes before deployment  
☐ Requires significant rework

**Comments:**
____________________________________________
____________________________________________
____________________________________________
____________________________________________

---

**Version:** 1.0  
**Last Updated:** October 31, 2025  
**Status:** Ready for Testing

