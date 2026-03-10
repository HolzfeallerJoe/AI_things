# Context7 Documentation Cache

> Project-specific documentation cache. Queries are cached with version tracking.
> Docs are fetched on-demand when making changes.

---

## Android Developers Guide

### Query: "foreground service ongoing notification action buttons BroadcastReceiver PendingIntent notification channel Android 14 examples"
> Queried: 2026-03-10

- Foreground work should expose an ongoing notification.
- The notification can include action buttons backed by `PendingIntent`s.
- Android O+ requires a notification channel before posting foreground notifications.
- Android 14+ requires declaring a foreground service type in the manifest.
- `startForeground(...)` should happen quickly after service start.

### Query: "foreground service manifest foregroundServiceType permission Android 14 startForeground service declaration notification actions"
> Queried: 2026-03-10

- The manifest should declare the foreground service and its `android:foregroundServiceType`.
- The app should also request `android.permission.FOREGROUND_SERVICE` and the matching specialized permission for the chosen service type.
- Foreground notifications should stay ongoing while the long-running work is active.

---

## Capacitor Plugins

### Query: "Capacitor Android plugin notifyListeners plugin lifecycle examples addListener Android implementation"
> Queried: 2026-03-10

- Capacitor plugins can push native state changes back to the web layer with `notifyListeners(...)`.
- The app layer can also refresh state on resume using `App.addListener('resume', ...)` or `appStateChange`.
- Listener registration should survive normal app flow, but plugin-owned runtime state should not be the only owner when background longevity matters.

---

## Android Developers Guide

### Query: "POST_NOTIFICATIONS runtime permission Android 13 foreground service notifications request flow and behavior"
> Queried: 2026-03-10

- Foreground-service apps still need the notification permission path to be considered for normal Android 13+ notification behavior.
- The manifest must declare the foreground service permissions and service type.
- Foreground notifications should be posted promptly after service start.

### Query: "ActivityCompat requestPermissions Manifest.permission.POST_NOTIFICATIONS Android 13 runtime notification permission example"
> Queried: 2026-03-10

- Android’s standard runtime permission flow is:
  - check with `ContextCompat.checkSelfPermission(...)`
  - optionally show rationale with `ActivityCompat.shouldShowRequestPermissionRationale(...)`
  - request with `ActivityCompat.requestPermissions(...)` or the Activity Result API
- This fits a simple launch-time permission request for `Manifest.permission.POST_NOTIFICATIONS` on Android 13+.

Reference shape:

```java
if (ContextCompat.checkSelfPermission(this, Manifest.permission.REQUESTED_PERMISSION)
        != PackageManager.PERMISSION_GRANTED) {
    ActivityCompat.requestPermissions(
        this,
        new String[] { Manifest.permission.REQUESTED_PERMISSION },
        REQUEST_CODE
    );
}
```

---
