# Code Review — Obsidian Kleinanzeigen Tracker

Date: 2026-03-27

---

## Critical (Must Fix)

### ~~C1. Modals Mutate Listing by Reference~~ ✅
**Files:** `src/modals/soldModal.ts`, `shipModal.ts`, `relistModal.ts`, `editListingModal.ts`

~~All modals receive a `Listing` object and directly mutate it before calling `onSubmit`.~~

**Fixed:** All modals now clone the listing via spread operator (`{ ...listing }`) in their constructors.

### ~~C2. Missing Error Handling on Modal Vault Writes~~ ✅
**File:** `src/main.ts`

~~`openEditListingModal`, `openSoldModal`, `openShipModal`, and `openRelistModal` all `await updateListing()` without try/catch.~~

**Fixed:** All modal callbacks now have try/catch with `new Notice()` error feedback.

### ~~C3. File Name Collision on Create~~ ✅
**File:** `src/services/vaultService.ts`

~~If two articles sanitize to the same filename, `vault.create` throws.~~

**Fixed:** Collision detection with numeric suffix increment implemented.

---

## Important (Should Fix)

### ~~I1. Dual Action Patterns Create Inconsistency~~ ✅
**Files:** `src/main.ts`, `src/views/dashboard.ts`

~~Two completely different patterns for status transitions.~~

**Fixed:** Unified action patterns via `actionMap` in dashboard.ts.

### ~~I2. setTimeout(200) is Fragile~~ ✅
**Files:** `src/views/dashboard.ts`, `src/main.ts`

**Fixed:** Both locations now use `metadataCache.on('changed')` one-shot listener with a 500ms fallback timeout instead of a blind 200ms delay.

### ~~I3. Bulk Operations Have No Error Recovery~~ ✅
**File:** `src/views/dashboard.ts`

~~If item 3 of 10 fails in a bulk operation, no feedback to user.~~

**Fixed:** All bulk operations now have try/catch with failure counting and Notice feedback.

### ~~I4. dashboard.ts is 1,146 Lines~~ ✅
**File:** `src/views/dashboard.ts`

**Fixed:** Extracted into 6 focused modules:
- `dashboard.ts` (222 lines) — thin coordinator
- `dashboard-types.ts` (44 lines) — shared types/interfaces
- `dashboard-helpers.ts` (43 lines) — DOM helper functions
- `dashboard-overview.ts` (518 lines) — overview tab
- `dashboard-stats.ts` (87 lines) — stats tab
- `dashboard-settings.ts` (334 lines) — settings tab

### ~~I5. Custom Frontmatter Parser is Fragile~~ ✅
**File:** `src/services/vaultService.ts`

**Fixed:** Replaced custom line-by-line parser with Obsidian's built-in `parseYaml()`. Handles all YAML edge cases (multiline, lists, nested objects, special values).

### ~~I6. data.json Not Gitignored~~ ✅
**Files:** `data.json`, `.gitignore`

**Fixed:** Both `data.json` and `.claude/` are now in `.gitignore`.

### ~~I7. confirm() is Not Obsidian-Idiomatic~~ ✅
**File:** `src/views/dashboard.ts`

~~`window.confirm()` breaks Obsidian UI paradigm and doesn't work on mobile.~~

**Fixed:** All `window.confirm()` calls replaced with custom `ConfirmModal` (extends `Modal`).

---

## Suggestions (Nice to Have)

### ~~S1. catch (e: any) Throughout Codebase~~ ✅

**Fixed:** All catch blocks now use proper `instanceof Error` checks with `String(e)` fallback.

### ~~S2. No Test Coverage~~ ✅

**Fixed:** 33 tests across 3 test files using Vitest:
- `tests/formatting.test.ts` — `formatDate`, `formatDateDE`, `formatCurrency`, `parsePortoPrice`
- `tests/statsService.test.ts` — `calculateStats`, `calculateExtendedStats`, `calculateMonthlyStats`, `calculateYearlyStats`
- `tests/templateService.test.ts` — CRUD operations (`create`, `update`, `delete`, `getById`)

### ~~S3. onunload() is Empty~~ ✅
**File:** `src/main.ts`

**Fixed:** Now documented with comment: "Cleanup handled by DashboardView.onClose()".

### ~~S4. eBay Toggle Has Dead Click Handler~~ ✅
**File:** `src/views/dashboard.ts`

**Fixed:** Button properly disabled with hint text for future feature.

### ~~S5. statusIcon() Still Returns Emoji~~ ✅
**File:** `src/views/dashboard.ts`

**Fixed:** Now uses Lucide icons via `statusLucideIcon` map and `renderStatusBadge()`.

### ~~S6. CSS !important Usage~~ ✅
**File:** `styles.css`

**Fixed:** Reduced from 8 to 4 occurrences — remaining ones are reasonable framework overrides.

### ~~S7. Missing versions.json~~ ✅

**Fixed:** `versions.json` exists with version mapping.

### ~~S8. .claude/ Directory Not Gitignored~~ ✅

**Fixed:** `.claude/` added to `.gitignore`.

### ~~S9. Hardcoded Base Folder~~ ✅
**File:** `src/services/vaultService.ts`, `src/models/listing.ts`, `src/views/dashboard-settings.ts`

**Fixed:** `baseFolder` added to `PluginSettings` (default: `'kleinanzeigen'`). VaultService accepts a folder getter via constructor. Settings UI added under "Allgemein" section with input validation.

### ~~S10. Listing Interface Mixes Domain State and UI Metadata~~ ✅
**File:** `src/models/listing.ts`

**Fixed:** Clean interface with no redundant boolean fields.
