# Publishing to npm

This repo already has the package source under `packages/web3auth-algorand` and the UI add-on under `packages/web3auth-algorand-ui`. Both use plain TypeScript builds (no bundler).

## Prereqs
- npm account with 2FA configured (recommended).
- Access to the `@tokenizerwa` npm scope (or change `name` in each `package.json` to your scope).
- Node 20+.

## Build locally
```bash
cd packages/web3auth-algorand
npm install
npm run build   # emits dist/

cd ../web3auth-algorand-ui
npm install
npm run build
```

To double-check what will be published:
```bash
npm pack --dry-run
```

## Publish steps
1) Set the version you want in each `package.json` (`version` field). Use semver.
2) Make sure `files` includes `dist` (already set) and that `dist` exists (run `npm run build`).
3) Log in once if needed: `npm login`.
4) From each package folder, publish:
```bash
cd packages/web3auth-algorand
npm publish --access public

cd ../web3auth-algorand-ui
npm publish --access public
```

## Releasing updates
- Bump the version in the package you changed.
- Rebuild that package.
- Publish only the changed package(s).

## Troubleshooting
- 403 errors: ensure your npm token owns the scope or rename the package.
- Missing files in npm: verify `npm pack --dry-run` includes `dist` and `package.json` points to `dist/index.js`.
- Type errors: run `npm run build` to catch missing types before publishing.
