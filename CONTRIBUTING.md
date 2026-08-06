# Contributing to BugWarden

Thanks for taking the time to contribute! Here's how to get set up and send a good pull request.

## Setup

```bash
git clone https://github.com/Bugs-point/bug-warden.git
cd bug-warden
npm install
```

## Development workflow

- `npm run lint` — type-check with `tsc`
- `npm test` — run the test suite (vitest)
- `npm run build` — build the `dist/` output with `tsup`
- `npm run ci` — run all three of the above, in order (this is what CI runs)

Run `npm run ci` before opening a pull request to make sure everything passes locally.

## Making changes

1. Fork the repo and create a branch off `master`.
2. Make your change, and add or update tests in `src/**/*.test.ts` alongside the code you touched.
3. Add a changeset describing your change:

   ```bash
   npx changeset
   ```

   Pick `patch` for bug fixes, `minor` for backward-compatible features, and `major` for breaking changes. This is what drives the version bump and changelog entry when the release is published — PRs that change behavior should include one.

4. Open a pull request against `master` describing what changed and why.

## Reporting bugs / requesting features

Please open a [GitHub issue](https://github.com/Bugs-point/bug-warden/issues) with:

- What you expected to happen vs. what actually happened
- A minimal reproduction (a small Express app snippet is ideal)
- Your Node.js and `bugwarden` versions

## Code style

- TypeScript, strict mode. Keep new code consistent with the existing style in `src/`.
- Prefer small, focused pull requests over large ones — easier to review, easier to release.
