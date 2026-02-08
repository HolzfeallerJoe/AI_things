# Repository Guidelines

## Project Structure & Module Organization
- Front-end source lives under `src/app/`. Feature pages sit in their own folders (`home`, `library-showcase`), while shared utilities belong in `src/app/shared/` (e.g., `host-discovery.service.ts`, `host-network.service.ts`).  
- Global styling and Ionic theming are in `src/global.scss` and `src/theme/`. Static assets (icons, demo iframes) reside in `src/assets/`.  
- Documentation and working notes live in `docs/` (`requirements-notes.md`, `networking.md`); keep new architectural decisions there.

## Build, Test, and Development Commands
- `npm install` – install project dependencies; rerun after modifying `package.json`.  
- `npm run start` – launch the Angular dev server at `http://localhost:4200/` with live reload.  
- `npm run build` – produce an optimized bundle in `dist/`.  
- `npm run lint` – enforce formatting and best practices via ESLint.  
- `npm test` – execute Karma/Jasmine unit tests (specs co-located with their components). Run selectively when needed; the UI prototype often stubs behaviour.

## Coding Style & Naming Conventions
- TypeScript: 2-space indentation, semicolons, single quotes, strict typing. Name components/services in `PascalCase` (`HomePage`, `HostNetworkService`) and helpers in `camelCase`.  
- Observables should end with `$`, e.g., `hostNetworkInfo$`. Favor pure pipes/services over component state for logic that spans pages.  
- SCSS: kebab-case selectors and nested blocks kept shallow; reuse CSS variables declared in `:root` or Ionic theme files.

## Testing Guidelines
- Unit specs (`*.spec.ts`) sit beside their sources and use Jasmine with Angular TestBed. Prefer lightweight stubs (see `home.page.spec.ts`) to isolate UI behaviour.  
- When adding features, cover: (1) form validation, (2) discovery/connection flows, and (3) logging side effects.  
- Document skipped or pending coverage in the PR if integration pieces (native plugins, networking) are not yet testable.

## Commit & Pull Request Guidelines
- Follow short, imperative commits (`Add host IP indicator`) or Conventional Commits (`feat: surface broadcast IP`).  
- PR descriptions must include: summary of user-visible changes, testing notes (`npm run lint`, targeted specs), and screenshots/GIFs for UI updates. Link relevant issues or requirements doc sections.  
- Keep PRs focused; prefer incremental changes so reviewers can validate new services (e.g., discovery, networking) in isolation.
