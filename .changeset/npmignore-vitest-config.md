---
"bugwarden": patch
---

Excludes vitest.config.ts from the published package (it was leaking into the npm tarball since .npmignore only listed tsconfig.json, not vitest.config.ts). No functional change — found while smoke-testing the published 3.2.0 package.
