# Context7 Documentation Cache

> Project-specific documentation cache. Queries are cached with version tracking.
> Docs are fetched on-demand when making changes.

---

## @angular/core@21.2.13 / @angular/build@21.2.11

### Query: "Angular 21 unit-test builder with Vitest runner configuration and standalone component testing with signals, HttpClient testing providers"
> Queried: 2026-05-19

- Angular 21 can use the `@angular/build:unit-test` builder for Vitest-based unit tests.
- A project `test` target can be configured with `"builder": "@angular/build:unit-test"` and options such as `"runner": "vitest"` and a test `tsConfig`.
- Standalone apps should provide `HttpClient` through `provideHttpClient()`.
- Component/service tests can configure `TestBed` with `provideHttpClientTesting()` and use `HttpTestingController` to flush HTTP requests.

---

## rxjs@7.8.x

### Query: "RxJS switchMap takeUntil Subject cancellation finalize Angular request lifecycle patterns"
> Queried: 2026-05-19

- `switchMap` keeps only the latest inner observable subscription, which is useful for autocomplete and request race prevention.
- `Subscription.unsubscribe()` cancels observable execution and releases resources.
- `finalize()` runs on complete, error, or unsubscribe, making it suitable for guarded loading-state cleanup.
