# bugwarden

## 3.1.1

### Patch Changes

- f37fd78: Repo hygiene and discoverability improvements. No functional changes:

  - Added a LICENSE file, CONTRIBUTING.md, and README badges (npm version, downloads, build status, license)
  - Added GitHub issue templates, a PR template, and CI now runs on pull requests, not just pushes to master
  - Expanded npm keywords to match current functionality, and added a README comparison table against Morgan, Winston, and Sentry

## 3.1.0

### Minor Changes

- f0558fe: Fixed several bugs in Slack notification matching that could cause notifications to fire incorrectly, fire for the wrong config, or not fire at all:

  - Status code matching accidentally checked the `routes` array instead of `onStatus`, so setting any route to `"all"` bypassed status filtering entirely.
  - Match flags leaked across `notificationConfig` entries, so once one config matched, every later config in the array was treated as a match too, regardless of its own routes/status filters.
  - The `{response-time}` message placeholder was missing its surrounding braces and was never substituted.
  - `routes: "all"` never actually matched anything, since only status matching had an `"all"` special case — the most common documented example was silently broken.

  Also added support for exact status codes in `onStatus` (e.g. `"404"` or `"400,401,404,5xx"`), not just `"NxxN"` ranges, and added a full automated test suite (vitest + supertest) covering the request logging and Slack notification matching logic.

## 3.0.1

### Patch Changes

- 8c75efa: keywords added

## 3.0.0

### Major Changes

- d1f2ec1: Slack notification feature added

## 2.0.0

### Major Changes

- 1e61868: bugwarden function is not a middleware anymore. Instead it returns a middleware. Also, custom logging options are now added

## 1.1.2

### Patch Changes

- 312ff49: readme fixes

## 1.1.1

### Patch Changes

- 1ef2056: module file added to pkg json file

## 1.1.0

### Minor Changes

- 88873b8: Support for both cjs and esm based apps

## 1.0.4

### Patch Changes

- f4b113f: fixes for no dist folder on live
- a6441af: fixed issue where dist folder was not sent to the live

## 1.0.4

### Patch Changes

- 583f997: js to ts
