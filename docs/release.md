# Release process

How to cut a release. Adapted from the dial repo flow; the artifact is a
signed-with-debug-keystore release APK attached to a GitHub Release.

## 1. Bump the version

Two files carry the app version and must stay in sync:

- `app.json` → `expo.version` (what the app shows in Settings → About, and
  what `android/` gets on the next prebuild)
- `package.json` → `version`

## 2. Draft the release notes

Write `docs/release-notes/RELEASE_NOTES_vX.Y.Z.md`. Keep it user-facing:
what changed, what to watch out for. Markdown formatting is what GitHub
renders on the release page.

## 3. Commit

```bash
git add app.json package.json docs/release-notes/RELEASE_NOTES_vX.Y.Z.md
git commit -m "chore: bump version to vX.Y.Z"
```

Commit before building: the APK file name stamps the short hash of the
current commit, so the hash in the name should be the release commit.

## 4. Build the APK

```bash
pnpm apk
```

Produces `dist/feedah-<yyMMdd-HHmm>-<short commit>.apk` (dist/ is
gitignored). `pnpm apk:arm64-v8a` builds for arm64-v8a only and appends the
ABI to the name: `dist/feedah-<yyMMdd-HHmm>-<short commit>-arm64-v8a.apk`.
Install it on a real device and smoke-test sign-in, sync, and one feed round
before publishing.

## 5. Tag

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

Tag the version-bump commit (`git tag vX.Y.Z <ref>` to be explicit).

## 6. Create the GitHub Release

```bash
gh release create vX.Y.Z dist/feedah-<stamp>-<hash>.apk \
  --title "vX.Y.Z" \
  --notes "$(cat docs/release-notes/RELEASE_NOTES_vX.Y.Z.md)"
```

The web UI works too: Releases → "Draft a new release" → pick the tag →
attach the APK → publish. APKs are well within GitHub's 2 GiB per-asset
limit, and a published release can be edited later to add or replace
assets.
