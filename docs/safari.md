# Run the development build in Safari

This repository can build a Safari-specific Web Extension and package it in a
local macOS app. The app is for development only. It is separate from the
[official Dark Reader for Safari](https://darkreader.org/safari/) and is not
configured for App Store distribution.

## Prerequisites

- macOS with Safari
- Xcode with the `safari-web-extension-packager` command
- A supported Node.js version and the repository dependencies

You do not need an Apple Developer Program membership for a temporary local
test. Persistent enablement and settings across Safari restarts require an
Apple Development identity.

## Build the extension

From the repository root:

```bash
npm install
npm run debug -- --safari
```

The extension files are written to `build/debug/safari`.

## Generate the macOS app

Run the packager once from the repository root:

```bash
xcrun safari-web-extension-packager \
    build/debug/safari \
    --project-location build/safari-app \
    --app-name "Dark Reader Development" \
    --bundle-identifier com.the-inconvenience-store.darkreader.Dark-Reader-Development \
    --macos-only \
    --swift \
    --no-open \
    --no-prompt
```

The command deliberately omits `--copy-resources`, so the generated project
references `build/debug/safari`. It also omits `--force`, so rerunning the
command cannot silently replace local Xcode settings.

Keep the documented bundle identifier aligned with the generated app name.
Apple appends `.Extension` for the embedded target, and macOS requires that
identifier to be prefixed by the containing app's identifier.

Find the generated project with:

```bash
find build/safari-app -name '*.xcodeproj' -print
```

The generated project is beneath the ignored `build/` directory and must not be
committed.

## Quick unsigned test

1. Open the generated `.xcodeproj` in Xcode.
2. Select the macOS containing-app target. In **Signing & Capabilities**, set
   **Signing Certificate** to **Sign to Run Locally** and leave **Team** as
   **None**.
3. Repeat the signing selection for the Safari Web Extension target.
4. In Safari, enable developer features in **Safari > Settings > Advanced** if
   they are not already enabled.
5. In Safari's **Developer** settings, enable **Allow unsigned extensions**.
6. In Xcode, select the macOS app scheme and run it.
7. Open Safari's Extensions settings, enable **Dark Reader Development**, and
   grant access to the websites where you want it to run.

Safari remains responsible for website permission. Denying access should leave
the page unchanged; the development build does not bypass that decision.

Safari intentionally clears **Allow unsigned extensions** whenever Safari
quits. After each restart, enable that option again and re-enable
**Dark Reader Development** before testing. This reset is part of Safari's
unsigned-development security model. Treat this mode as a functional smoke
test, not persistence evidence.

## Persistent signed install

With an Apple Development identity already available to Xcode, replace
`YOUR_TEAM_ID` and run:

```bash
project_path=$(find build/safari-app -name '*.xcodeproj' -print -quit)

xcodebuild \
    -project "$project_path" \
    -scheme "Dark Reader Development" \
    -configuration Debug \
    -derivedDataPath build/safari-derived-signed \
    DEVELOPMENT_TEAM=YOUR_TEAM_ID \
    CODE_SIGN_STYLE=Automatic \
    CODE_SIGN_IDENTITY="Apple Development" \
    build

mkdir -p "$HOME/Applications"
source_app="build/safari-derived-signed/Build/Products/Debug/Dark Reader Development.app"
installed_app="$HOME/Applications/Dark Reader Development.app"

ditto "$source_app" "$installed_app"
pluginkit -r \
    "$source_app/Contents/PlugIns/Dark Reader Development Extension.appex"
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister \
    -u "$source_app"
open "$installed_app"
```

The generated project applies the same team to the app and extension targets.
The installed app uses a stable path and signed identity, so Safari does not
require **Allow unsigned extensions** after restart. The two unregister
commands remove Xcode's transient derived-build registration, preventing
duplicate entries beside the installed copy. Keep the team ID and all signing
material local; do not add them to the generated project or Git.

## Update the extension

After changing Dark Reader sources:

```bash
npm run debug -- --safari
```

Build or run the app again in Xcode. The project references the rebuilt
extension directory, so it normally does not need to be regenerated. For a
persistent signed install, rerun the signed build and replace the exact app in
`$HOME/Applications`.

## Review packager warnings

The packager reports manifest keys or APIs that the installed Safari version
does not support. A warning involving page injection, the background page,
storage, tabs, permissions, or the popup blocks acceptance until it is
resolved. Do not add native messaging, broader permissions, or copied resources
to suppress a warning.

## Recover the generated project

If the generated project becomes invalid:

1. Remove only `build/safari-app`.
2. Confirm that `build/debug/safari` still exists, or rebuild it.
3. Run the packaging command again.
4. Reapply the selected local-signing mode in Xcode.

Do not delete or replace source files, signing identities, or other browser
build outputs as part of this recovery.

## Release build

To create the Safari release directory and ZIP without packaging an App Store
app:

```bash
npm run build -- --safari
```

This produces `build/release/safari` and
`build/release/darkreader-safari.zip`.
