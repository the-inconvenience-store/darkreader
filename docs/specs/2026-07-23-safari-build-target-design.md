# Safari Build Target Design

Status: Approved

Approved by: Sam Stevens

Approved on: 2026-07-23

Product contract: Omitted at the user's direction; scope is governed by the
original request and the approved design in issue `darkreader-ohs`.

## Goal and Outcomes

Add an opt-in Safari build target to this Dark Reader fork and provide the
shortest maintainable route to a locally packaged macOS app that installs the
extension in Safari.

The design traces the following outcomes:

- `SAFARI-BUILD`: A developer can produce a Safari-specific web extension
  directory from the existing Dark Reader sources.
- `SAFARI-PACKAGE`: A developer can use Apple's supported packager to create a
  local macOS containing app without maintaining generated Xcode files in Git.
- `SAFARI-LOCAL-RUN`: The packaged extension can be enabled in Safari, darken a
  light page, and retain settings after it is re-enabled following a Safari
  restart. Safari resets **Allow unsigned extensions** on quit, so the tester
  must re-enable unsigned extensions and the development extension first.
- `EXISTING-TARGETS-UNCHANGED`: Adding Safari does not change the selection,
  contents, or verification expectations of existing browser targets.

App Store distribution, notarization, iOS, visionOS, native messaging, and
changes to the separately distributed official Dark Reader Safari app are
non-goals.

## Findings and Consequences

Dark Reader's build pipeline enumerates platforms in `tasks/platform.js` and
propagates selected platforms through the shared HTML, JavaScript, CSS, locale,
manifest, copy, formatting, and archive tasks. Safari therefore belongs in the
existing platform model rather than in a parallel build system.

Runtime code already identifies Safari when the Chromium, Firefox, and
Thunderbird compile-time flags are false. It also treats Safari background
execution as nonpersistent. A dedicated Safari platform can use those existing
branches without pretending to be Chromium or Firefox.

Safari 15.4 and later supports manifest versions 2 and 3. The existing
Dark Reader MV2 implementation is the smaller compatibility surface because it
already uses a background HTML page and does not require the Chromium MV3-only
main-world proxy entries. The Safari manifest will therefore be a small MV2
patch with a nonpersistent background page. Apple recommends a nonpersistent
background page for Safari on macOS and requires it on iOS:

- [Assessing Safari web extension compatibility](https://developer.apple.com/documentation/safariservices/assessing-your-safari-web-extension-s-browser-compatibility)
- [Optimizing a web extension for Safari](https://developer.apple.com/documentation/safariservices/optimizing-your-web-extension-for-safari)

Apple's Safari web extension packager can generate a macOS containing app and
Xcode project from an existing extension directory. By default, the generated
project references the supplied directory rather than copying it. That behavior
allows the Xcode wrapper to remain a disposable, ignored build artifact while
the repository continues to own the extension sources:

- [Safari web extensions](https://developer.apple.com/documentation/safariservices/safari-web-extensions)
- [Packaging a web extension for Safari](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari)

An official Dark Reader Safari app already exists. The local development app
must use a distinct display name and bundle identifier so it does not masquerade
as or collide with the official product:

- [Official Dark Reader Safari edition](https://darkreader.org/safari/)

## Approaches Considered

### Generate an ignored Xcode wrapper once

The repository builds the Safari extension directory. Apple's packager creates
a macOS-only Xcode wrapper under the ignored `build/` tree and references that
directory. Subsequent source changes rebuild the extension directory; the
wrapper is regenerated only when its structure needs to change.

This is the selected approach because it has the smallest tracked change and
the lowest ongoing Xcode maintenance.

### Commit the generated Xcode project

This makes the native wrapper directly reproducible from Git, but it adds
generated project files, native boilerplate, signing configuration churn, and
more upstream drift. The request does not require native customization, so
these costs provide no current benefit.

### Regenerate the wrapper on every build

This reduces the number of documented commands but makes ordinary JavaScript
iteration slower and risks replacing local signing configuration. Packaging
and extension compilation have different lifecycles and should remain separate.

## Architecture

### Safari web extension build

Add `PLATFORM.SAFARI` with the value `safari`. The build CLI accepts
`--safari` and advertises it in help output.

The development and release entries are:

```bash
npm run debug -- --safari
npm run build -- --release --safari
```

They produce:

```text
build/debug/safari/
build/release/safari/
build/release/darkreader-safari.zip
```

Safari is opt-in. Invocations that currently build the default target set must
continue to select the same existing targets. This avoids changing routine CI,
release output, or non-macOS developer workflows.

The target uses the shared build tasks. Platform-specific adjustments are
limited to:

- adding Safari to the platform and CLI selection model;
- emitting Safari as a ZIP archive rather than an XPI;
- including `background/index.html` for the Safari MV2 target;
- selecting a Safari-specific manifest patch; and
- ensuring debug-only manifest behavior does not claim unsupported Safari
  permissions.

No dependency, `package.json`, or `package-lock.json` change is required.

### Manifest boundary

Add `src/manifest-safari.json` as a shallow patch over `src/manifest.json`.
The resulting manifest remains MV2 and:

- keeps `background/index.html`;
- sets `background.persistent` to `false`;
- retains the host and tab access required to inspect and modify webpages;
- retains alarms and storage;
- omits `fontSettings`, because Safari does not provide that API and
  `src/ui/utils.ts` already falls back to generic font families when the API is
  absent;
- adds no native messaging or containing-app capabilities; and
- avoids unsupported debug-only permissions that would create packager
  warnings or reference absent APIs.

Safari implements `storage.sync`, but does not sync it between devices. Local
settings persistence satisfies this design; cross-device synchronization is a
non-goal.

The broad website access is existing product behavior required to darken
arbitrary sites. Safari remains the authority for granting or denying access,
and the user grants it through Safari's extension permission interface:

- [Managing Safari web extension permissions](https://developer.apple.com/documentation/safariservices/managing-safari-web-extension-permissions)

### Compile-time platform behavior

For the Safari target, the existing Chromium, Firefox, and Thunderbird
compile-time constants remain false. This activates the current Safari
user-agent detection and nonpersistent-background behavior in
`src/utils/platform.ts`.

The target must not reuse a Chrome build artifact. Doing so would compile
Chromium-specific behavior into code later executed by Safari and would bypass
existing Safari-specific workarounds.

No new Safari global or native bridge is introduced. If future code needs
compile-time Safari branching that cannot use the existing runtime platform
module, that is separate follow-up work.

### macOS containing app

After building the Safari extension, generate the local wrapper once:

```bash
xcrun safari-web-extension-packager \
    build/debug/safari \
    --project-location build/safari-app \
    --app-name "Dark Reader Development" \
    --bundle-identifier com.the-inconvenience-store.darkreader.Dark-Reader-Development \
    --macos-only \
    --swift \
    --no-prompt
```

Do not pass `--copy-resources`; the Xcode project must reference
`build/debug/safari`. Do not pass `--force`; an existing project may contain
local signing selections and must not be overwritten silently.

The wrapper is generated under the already ignored `build/` directory. It is
not committed and contains no maintained native functionality. The bundle
identifier is explicitly development-only and is not an assertion of App Store
ownership. It matches the containing app identifier Xcode derives from the app
name so the packager's `.Extension` child identifier passes macOS embedded
binary validation.

### Local run lifecycle

The first-run journey is:

1. Build the Safari extension target.
2. Run Apple's packager once.
3. Open the generated Xcode project.
4. Select **Sign to Run Locally** with **Team: None** for both the macOS app and
   extension targets.
5. Run the containing app.
6. Enable **Dark Reader Development** in Safari's Extensions settings.
7. Grant website access through Safari.

Apple documents local signing without a development team in its sample setup:

- [Developing a Safari web extension](https://developer.apple.com/documentation/safariservices/developing-a-safari-web-extension)

For subsequent source changes, rebuild `build/debug/safari` and build or run the
project again in Xcode. Because the project references the build directory, it
normally does not need regeneration.

## Failure and Recovery

A JavaScript build failure does not mutate the generated Xcode project or an
already built app. The build command reports the failing shared task and owns
recovery.

The Apple packager may report unsupported manifest keys or APIs. Any warning
that affects page injection, background execution, storage, tabs, permissions,
or the popup blocks acceptance. Cosmetic or unused capability warnings must be
recorded and deliberately classified before proceeding.

If the ignored Xcode wrapper becomes invalid, recovery is to remove only
`build/safari-app/` and rerun the documented packager command. The maintained
source of truth remains the repository and `build/debug/safari` remains
reproducible.

Signing failures remain isolated to Xcode. They must not cause changes to
shared manifests, other targets, or repository credentials. No signing
identity, provisioning profile, certificate, or Apple account information is
stored in Git.

If Safari denies site permission, the extension must remain installed and its
popup must communicate the resulting protected or inaccessible page state
using existing behavior. The design does not bypass Safari's permission model.

## Security and Privacy

The Safari build receives only the existing extension resources and the
permissions required for Dark Reader behavior. It adds no native messaging,
network service, secret, credential, entitlement, or data store.

The containing app is packaging infrastructure only. It does not gain authority
over browser data and does not mediate extension messages.

Safari's website permission UI remains the user-visible authority boundary.
The extension must continue working when access is granted to all websites and
must fail safely when access is denied.

Generated Xcode and signing material stays under ignored local build paths.
Release, App Store, and notarization credentials are outside the scope.

## Evidence Strategy

### Automated evidence

- `npm run debug -- --safari` exits successfully.
- The output contains the manifest, background page, content scripts, popup,
  icons, locales, configuration, CSS, and JavaScript expected by the manifest.
- The output manifest is MV2, declares a nonpersistent background page, and
  does not claim `fontSettings`.
- A focused build or manifest test protects the Safari-specific transformation
  and opt-in selection behavior.
- Existing unit tests and lint pass.
- Existing Chrome, Chrome MV3, Firefox, and Thunderbird selection behavior is
  unchanged.

The existing Safari Karma coverage tests injected page behavior, not packaged
extension lifecycle. They remain useful regression evidence but do not replace
the packaged Safari smoke test.

### Toolchain evidence

- `xcrun safari-web-extension-packager` successfully generates the macOS
  project from `build/debug/safari`.
- Packager warnings contain no unresolved critical capability.
- The generated Xcode project builds with local signing.

### Manual Safari smoke evidence

On a light test page:

1. The Safari toolbar popup opens.
2. The page becomes dark.
3. Toggling the current site off and on works.
4. Popup settings can be changed.
5. Quit and reopen Safari, re-enable **Allow unsigned extensions** and
   **Dark Reader Development** as required by Safari's development security
   model, and confirm the setting survives.
6. Denying page access does not crash the background page or popup.

These checks prove `SAFARI-LOCAL-RUN`; a successful Xcode build alone does not.

## Rollout

The change initially lands as an opt-in fork target. It does not enter default
release builds and does not create an upstream pull request.

The first supported environment is the current local macOS, Safari, Xcode, and
Apple packager toolchain. Broader Safari-version guarantees require additional
compatibility testing and are not inferred from a successful current-machine
smoke test.

Promotion to a default target, CI target, signed artifact, App Store package, or
iOS target requires a separate decision and evidence.

## Coverage Summary

| Cell | Observed evidence | Resolution | Risk | Outcomes |
|---|---|---|---|---|
| Entry and route | Existing build flags select platforms | Add opt-in `--safari` | Low | `SAFARI-BUILD` |
| Authority boundary | Xcode and Safari control local signing and site access | Add no alternative authority path | Low | `SAFARI-LOCAL-RUN` |
| Domain ownership | Repository owns web resources; Apple owns wrapper format | Keep wrapper generated and disposable | Low | `SAFARI-PACKAGE` |
| Lifecycle and recovery | Packager references the supplied directory | Rebuild resources normally; regenerate wrapper only when needed | Medium | `SAFARI-PACKAGE` |
| Interfaces and dependencies | Apple packager consumes a valid extension directory | `build/debug/safari` is the integration interface | Medium | `SAFARI-BUILD`, `SAFARI-PACKAGE` |
| Security and privacy | Dark Reader requires webpage access | Preserve necessary access, add no native capability, rely on Safari consent | Medium | `SAFARI-LOCAL-RUN` |
| Evidence and observability | Current browser tests do not launch a packaged Safari extension | Combine automated, packager, Xcode, and manual smoke evidence | Medium | All |
| Rollout and compatibility | Existing targets and defaults predate Safari | Keep Safari opt-in | Low | `EXISTING-TARGETS-UNCHANGED` |
| Accessibility and presentation | Existing shared popup is the only affected UI | Smoke-test popup and denied-access state | Low | `SAFARI-LOCAL-RUN` |

No applicable high-risk cell is unresolved.

## Implementation Topology

| Seam ID | State / data owner | Entry / integration interface | Produces | Consumes | Security / authority boundary | Failure / recovery owner | Likely write zones | Semantic prerequisites | Resource conflicts |
|---|---|---|---|---|---|---|---|---|---|
| `SAFARI-WEB-BUILD` | Dark Reader build pipeline | `npm run debug -- --safari` | `build/debug/safari` | Shared extension sources and Safari manifest patch | Output contains declared extension permissions | Node build task | `tasks/platform.js`, `tasks/build.js`, `tasks/cli.js`, bundling tasks, `src/manifest-safari.json`, focused tests | None | Shared platform enumeration and default selection |
| `SAFARI-MAC-PACKAGE` | Apple packager and local Xcode | `build/debug/safari` directory | Ignored macOS Xcode project and app | Valid Safari extension output | Xcode local signing; no stored identity | Developer through packager/Xcode | Documentation and ignored `build/safari-app` | `SAFARI-WEB-BUILD` | Local Xcode project and signing selections |
| `SAFARI-EVIDENCE` | Developer and test suite | Built extension and packaged app | Acceptance evidence | Both prior seams | Safari permission UI | Developer | Focused tests and verification record | `SAFARI-WEB-BUILD`, `SAFARI-MAC-PACKAGE` | Interactive Safari profile and site permissions |

## Technical Risk Capsule

| Seam ID | High-risk boundaries | Acceptance surface | Evidence tier | Likely correction shape |
|---|---|---|---|---|
| `SAFARI-WEB-BUILD` | Parsing, protocol, security | One valid and correctly permissioned Safari extension artifact | Automated build and manifest assertions | Narrow platform or manifest correction |
| `SAFARI-MAC-PACKAGE` | Protocol, security, recovery | One locally signed macOS app containing the current extension output | Packager output and Xcode build | Packaging command or manifest compatibility correction |
| `SAFARI-EVIDENCE` | Evidence | One operable Safari extension journey | Manual browser smoke evidence backed by automated regressions | Browser-specific compatibility fix or improved test seam |

Each seam has one coherent acceptance surface and crosses no more than two
high-risk boundaries.

## Assumptions

### Verified

- The repository currently has no Safari build platform or Safari manifest.
  If invalidated, the implementation plan must reconcile rather than duplicate
  the existing target.
- The current source contains Safari detection and Safari-specific runtime
  workarounds. If removed before implementation, the target would need
  additional runtime changes.
- The local environment has Xcode 26.5 and exposes
  `safari-web-extension-packager`. If the command changes, update the packaging
  interface using the installed tool's help and current Apple documentation.
- Apple's current documentation says the packager references input resources
  by default. If that behavior changes, the wrapper lifecycle and update
  instructions must be redesigned.
- `build/` is ignored by Git. If that changes, generated Xcode artifacts require
  an explicit ignore rule before packaging.

### Recalled

- None. Platform claims in this design are based on repository inspection,
  installed tool output, or linked current Apple documentation.

### Assumed

- Local development does not require coexistence with another app using
  `com.the-inconvenience-store.darkreader.Dark-Reader-Development`. If a
  collision occurs,
  the developer must choose another development-only identifier and document
  it locally.
- The present Safari version supports the MV2 APIs Dark Reader exercises beyond
  the compatibility constraints explicitly documented by Apple. If packaging
  or smoke testing disproves this, the correction should remain within the
  Safari manifest/platform seam unless evidence requires an MV3 redesign.
- The existing nonpersistent-background recovery behavior is sufficient under
  Safari's actual suspension timing. If settings or listeners fail after
  suspension, `SAFARI-LOCAL-RUN` is not met and background lifecycle work
  becomes required.

## Self-Review

- No placeholder or unresolved decision remains.
- Product outcomes map to architecture and evidence.
- Authority remains with local Xcode signing and Safari permissions.
- Generated native artifacts have one owner and a bounded recovery path.
- Existing browser targets remain isolated from the opt-in Safari rollout.
- The design does not silently expand into distribution, iOS, or native code.
