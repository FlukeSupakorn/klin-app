# Bruno Mock API Cleanup Guide (for switching to real AI API)

This file lists everything added/changed for the current Bruno + Node mock organize API.
Use this checklist when your real AI API is ready.

## 1) Remove local Node mock server

### File to delete
- `scripts/organize-api-server.mjs`

### Package script to remove
- File: `package.json`
- Remove this script entry:
```json
"api:organize": "node scripts/organize-api-server.mjs"
```

## 2) Bruno request definitions (optional)

Keep these if you still want manual API testing, otherwise remove:
- `brunoapi/organize/analyze-organize-files.bru`

You can keep `brunoapi/bruno.json` and `brunoapi/collection.bru` for other API tests.

## 3) Point app to real AI endpoint

### File to update
- `src/services/organize-api-service.ts`

### What to change
- Replace:
  - `http://localhost:3000/organize`
  - `http://localhost:3000/organize/analyze`
- With your real API URL(s), for example:
  - `https://<your-real-host>/organize/analyze`

## 4) Remove temporary compatibility logic (recommended once real API is stable)

### File to update
- `src/services/organize-api-service.ts`

### Temporary logic currently present
- Accepting typo key `reuslt` in addition to `result`
- Accepting `result/reuslt` as both array and object
- Accepting `score` as object/array/string
- Accepting `new_name` as array/string

### For real API cleanup
Once your real API contract is fixed, simplify parser to only your final format.

## 5) UI error text cleanup

### File to update
- `src/features/dashboard/organize-files-panel.tsx`

### Current message
Mentions localhost mock server (`localhost:3000`).

### Suggested real API message
Replace with generic production message, e.g.:
- `Could not analyze files. Please try again.`

## 6) Quick verification after cleanup

Run:
```bash
bun run lint
```

Then test organize flow:
1. Select files in app
2. Confirm request reaches real AI API
3. Confirm response drives:
   - category scores
   - suggested names list
   - summary
   - calendar (currently nullable)

---

## Files touched for Bruno mock API

- `scripts/organize-api-server.mjs` (added)
- `package.json` (added script: `api:organize`)
- `brunoapi/organize/analyze-organize-files.bru` (added)
- `src/services/organize-api-service.ts` (added API integration + compatibility parser)
- `src/features/dashboard/organize-files-panel.tsx` (uses API service + mock-server specific error message)
- `src/types/domain.ts` (organize API request/response types)
