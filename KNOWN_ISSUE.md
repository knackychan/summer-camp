# Known Issues

## Android 8.1.0 PWA Does Not Launch

The installed PWA does not open on the Android 8.1.0 tablet. The same deployed app works when opened directly in Google Chrome on that tablet.

Tried mitigations:
- Removed newer JavaScript syntax from runtime files.
- Simplified the web manifest for older Android PWA install behavior.
- Bumped the service worker cache version.
- Made service worker app-shell caching more tolerant.
- Added explicit HTML document wrappers to `index.html`.

Current workaround: open the app in Google Chrome instead of launching it from the installed PWA icon on Android 8.1.0.

Status: unresolved. Treat Android 8.1.0 installed-PWA support as unsupported until tested on the physical tablet with remote debugging or a comparable Android WebView/Chrome version.

## Android 9 Installed PWA Does Not Auto-Rotate

On at least one low-end Android 9 tablet, the installed PWA stays locked to one orientation even when Android system auto-rotate is enabled.

Tried mitigations:
- Removed the restrictive `"orientation": "portrait"` manifest setting.
- Tested the manifest with no `orientation` property.
- Changed the manifest to explicitly use `"orientation": "any"`.
- Bumped the service worker cache version after each manifest change.
- Confirmed the live GitHub Pages manifest serves `"orientation": "any"`.

Current workaround: open the app directly in Google Chrome if rotation is needed, or use the installed PWA in its fixed orientation.

Status: unresolved. Treat auto-rotation in Android 9 installed PWA/WebAPK mode as unsupported on the affected tablet unless a future Chrome/WebView update or device-specific setting fixes it.
