# Code Review — Obsidian Kleinanzeigen Tracker

Date: 2026-03-27

---

## Critical (Must Fix)

### C1. Modals Mutate Listing by Reference
**Files:** `src/modals/soldModal.ts`, `shipModal.ts`, `relistModal.ts`, `editListingModal.ts`

All modals receive a `Listing` object and directly mutate it before calling `onSubmit`. If the vault write fails, in-memory state is already corrupted (new status set, but file on disk unchanged). On next `refresh()`, dashboard reloads from disk and states diverge.

Additionally, `editListingModal.ts` mutates via `onChange` callbacks — pressing Escape after partial edits leaves the original object partially mutated even though `onSubmit` was never called.

**Fix:** Clone the listing in each modal constructor (`{ ...listing }`) or build a fresh object from form fields on submit.

### C2. Missing Error Handling on Modal Vault Writes
**File:** `src/main.ts` (lines 79-105)

`openEditListingModal`, `openSoldModal`, `openShipModal`, and `openRelistModal` all `await updateListing()` without try/catch. Only `openNewItemModal` has proper error handling. If the write fails, the error is unhandled and the user gets no feedback.

**Fix:** Wrap all modal callbacks in try/catch with `new Notice()` for error feedback, matching the pattern in `openNewItemModal`.

### C3. File Name Collision on Create
**File:** `src/services/vaultService.ts` (line 24)

If two articles sanitize to the same filename (e.g., both "USB Kabel"), `vault.create` throws. No collision detection or deduplication.

**Fix:** Check if file exists and append a numeric suffix if needed.

---

## Important (Should Fix)

### I1. Dual Action Patterns Create Inconsistency
**Files:** `src/main.ts`, `src/views/dashboard.ts`

Two completely different patterns for status transitions:
- **Pattern A (via main.ts):** Sold, Ship, Relist, Edit — modal → callback → `refreshDashboard()` (200ms delay)
- **Pattern B (in dashboard.ts):** Abgeschlossen, Archivieren, Abgelaufen, Undo, bulk ops — `transitionStatus()`/`undoStatus()` → `refreshAfterWrite()` (200ms delay)

This split makes it hard to reason about the flow and creates inconsistent error handling. Consider consolidating on one pattern.

### I2. setTimeout(200) is Fragile
**Files:** `src/views/dashboard.ts` (line 178), `src/main.ts` (lines 107-117)

Both refresh mechanisms use a hardcoded 200ms delay for Obsidian's metadata cache. Large vaults or iCloud sync could take longer. Multiple rapid operations queue separate timeouts.

**Improvement:** Use `metadataCache.on('changed')` event, or at minimum debounce.

### I3. Bulk Operations Have No Error Recovery
**File:** `src/views/dashboard.ts` (lines 366-392)

If item 3 of 10 fails in a bulk operation, items 1-2 are written, 4-10 are skipped, no feedback to user.

**Fix:** Wrap in try/catch, track failures, show Notice with success/failure count.

### I4. dashboard.ts is 1,146 Lines
**File:** `src/views/dashboard.ts`

Mixes overview tab, stats tab, settings tab (AI settings, templates, platform settings), detail view, table renderer, bulk operations, export dropdown, sorting, filtering, and keyboard handling.

**Improvement:** Extract SettingsTab, StatsTab, and potentially TableRenderer into separate files.

### I5. Custom Frontmatter Parser is Fragile
**File:** `src/services/vaultService.ts` (lines 115-138)

Naive line-by-line YAML parser doesn't handle:
- Multiline values, lists, or nested objects
- YAML special values (`null`, `~`, `yes`/`no`)
- Tracking numbers like `00123456` get parsed as number `123456`
- Colons within values (first colon wins)

**Fix:** Use a proper YAML parser or add special handling for known edge cases.

### I6. data.json Not Gitignored
**Files:** `data.json`, `.gitignore`

Contains API keys in plain text. Not in `.gitignore`. Already noted in PLAN.md as TODO.

**Fix:** Add `data.json` and `.claude/` to `.gitignore`.

### I7. confirm() is Not Obsidian-Idiomatic
**File:** `src/views/dashboard.ts` (lines 387, 561, 806)

`window.confirm()` breaks Obsidian UI paradigm and doesn't work on mobile. Community plugin review will likely flag this.

**Fix:** Use a confirmation modal (extend `Modal`).

---

## Suggestions (Nice to Have)

### S1. catch (e: any) Throughout Codebase
**Files:** `main.ts:73`, `aiService.ts:49`, `dashboard.ts:1019`, `newItemModal.ts:167`

Use `catch (e: unknown)` with `e instanceof Error ? e.message : String(e)` for proper type safety.

### S2. No Test Coverage
Zero test files. Key pure functions that are easy to test:
- `statsService.ts` — `calculateStats`, `calculateMonthlyStats`, `calculateExtendedStats`
- `formatting.ts` — `formatDate`, `formatCurrency`, `parsePortoPrice`
- `templateService.ts` — CRUD operations
- `vaultService.ts` — `parseFrontmatter`, `buildFileContent`

### S3. onunload() is Empty
**File:** `src/main.ts` (line 48)

Fine for now but should be documented as intentional.

### S4. eBay Toggle Has Dead Click Handler
**File:** `src/views/dashboard.ts` (lines 1094-1102)

Button is disabled but has a click handler that can never fire.

### S5. statusIcon() Still Returns Emoji
**File:** `src/views/dashboard.ts` (lines 1135-1144)

PLAN.md Phase 6 says "Alle Emojis durch Lucide Icons ersetzt", but `statusIcon()` still returns emoji strings.

### S6. CSS !important Usage
**File:** `styles.css` (8 occurrences)

Some `!important` declarations could be avoided with higher CSS specificity.

### S7. Missing versions.json
Required for Obsidian community plugin release process.

### S8. .claude/ Directory Not Gitignored
Appears as untracked in git status. Should be added to `.gitignore`.

### S9. Hardcoded Base Folder
**File:** `src/services/vaultService.ts` (lines 4, 49-53)

`kleinanzeigen` folder is hardcoded with a capitalized fallback. Consider making configurable in settings.

### S10. Listing Interface Mixes Domain State and UI Metadata
**File:** `src/models/listing.ts` (lines 18-54)

`filePath` is vault metadata in the domain model. `verkauft`/`verschickt` booleans are redundant with `status` field — risk of desync.
