# Android target architecture

Summer Quest is currently delivered as a PWA, but all new work should be built as an application core that can later run inside an Android shell rather than as browser-only page logic.

## Boundary

```text
UI / Activities
      ↓
Quest + Agent application services
      ↓
Platform interface
      ↓
Browser adapter today
Android / Capacitor adapter later
```

`SQPlatform` is the initial seam for:

- haptics;
- text-to-speech;
- scheduled notifications;
- Android back handling;
- future camera/microphone/native capabilities.

## Requirements for new code

- Touch-first interactions and coarse-pointer support.
- Safe-area-aware layouts and `100dvh` rather than fixed browser viewport assumptions.
- Do not put OpenAI or other privileged API credentials in client assets or an APK.
- Agent calls go through a protected provider/proxy.
- Core Quest/Reward rules remain local and deterministic.
- Offline functionality remains usable if the network/model is unavailable.
- Background reminders are platform intents, not long-running JavaScript timers.
- Activity/game integration should expose state through adapters rather than DOM scraping.

## Expected packaging path

The current PWA can later be hosted by a lightweight Android shell (for example a Capacitor-style WebView application) while native plugins replace browser platform services incrementally. A full native UI rewrite is not required to gain native notifications, haptics, back navigation, storage and lifecycle integration.
