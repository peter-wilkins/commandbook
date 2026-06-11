# Field Relay Web Runtime

This folder holds the JavaScript runtime loaded by the Field Relay Android
WebView. Android stays responsible for battery-sensitive and permission-heavy
work. This runtime owns the fast-changing command UI and command logic.

Field Relay fetches this file from GitHub, caches it in app-private storage,
and falls back to the APK-bundled copy when offline.

Manifest URL:

```text
https://raw.githubusercontent.com/peter-wilkins/commandbook/main/web/fieldrelay/runtime-manifest.json
```

Raw runtime URLs:

```text
https://raw.githubusercontent.com/peter-wilkins/commandbook/main/web/fieldrelay/coffee-grinder.js
https://raw.githubusercontent.com/peter-wilkins/commandbook/main/web/fieldrelay/runtime.js
```
