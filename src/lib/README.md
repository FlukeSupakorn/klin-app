# Utility Functions

Centralized utility functions used across features. Each module has a single, focused responsibility.

## `error-utils.ts`

Error checking and handling utilities.

- **`isAbortError(error)`** - Check if an error is an AbortError
  - Used when handling cancellable async operations
  - Works with DOMException, Error instances, and plain objects

## `path-utils.ts`

Path manipulation and normalization utilities.

- **`normalizePath(path)`** - Normalize path for comparison
  - Converts backslashes to forward slashes
  - Removes trailing slashes
  - Converts to lowercase
  - Trims whitespace
  - Use for comparing paths consistently across OS

- **`splitDestinationPath(path)`** - Split a path into folder and filename
  - Returns `{ folderPath: string; fileName: string }`
  - Handles both Windows and Unix paths

- **`getPathName(path)`** - Extract filename from a path
  - Removes folder part, keeps only filename
  - Returns original path if no filename found

## `text-utils.ts`

Text normalization and comparison utilities.

- **`normalizeCategoryLabel(value)`** - Normalize text for category matching
  - Converts to lowercase
  - Removes non-alphanumeric characters (except spaces)
  - Trims whitespace
  - Use for fuzzy category name matching

- **`normalizeCategoryName(value)`** - Normalize for display
  - Converts to lowercase
  - Trims whitespace
  - Use for category comparison in UI

## `category-utils.ts`

Category-specific utility functions.

- **`findCategoryColor(name, palette)`** - Find color for a category name
  - Searches palette for matching category
  - Uses normalized name comparison
  - Returns color hex code or `null` if not found

## `utils.ts` (Existing)

General utilities.

- **`cn(...inputs)`** - Tailwind className merging
  - Uses `clsx` for conditional classes
  - Uses `tailwind-merge` for conflict resolution
  - Standard for combining Tailwind classes in React components

## Usage

All utilities are centralized to:
- Prevent code duplication
- Ensure consistent behavior across features
- Make bug fixes easier (fix in one place)
- Simplify testing and maintenance

Example:
```ts
import { normalizePath } from "@/lib/path-utils";
import { findCategoryColor } from "@/lib/category-utils";

// Use in your code
const normalized = normalizePath("C:\\Users\\test");
const color = findCategoryColor("Documents", myPalette);
```

## Design Principles

Each utility:
- Has a single, clear responsibility
- Is independent of React or UI concerns
- Can be tested in isolation
- Has no side effects
- Is synchronous (no async operations)
