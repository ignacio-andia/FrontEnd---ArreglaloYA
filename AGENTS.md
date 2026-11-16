You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## Git Rules (mandatory and permanent)

The user is solely responsible for every Git operation and decides when and how to commit. These rules apply to every task in this project.

- NEVER run `git commit`.
- NEVER run `git commit --amend`.
- NEVER modify the Git history: no `reset`, `rebase`, `cherry-pick`, `revert`, `merge` or any other command that writes to the history.
- NEVER run `git push` (nor `git pull`).
- Read-only commands are allowed: `git status`, `git diff`, `git log`, `git show`, `git branch` (listing) and similar queries.
- You may prepare changes in the working tree and review the differences.
- At the end of every task, report the files created, modified and deleted.
- Wait for the user to decide when to make a commit.

## Project Identity

- Official visible name: **ArreglaloYA** (exactly this spelling). Use it in the browser title, route titles, brand, header, footer and any visible text. The former name "Servicios Hogar" must not appear in the UI.
- Technical identifiers keep their current names: package/project `servicios-hogar-frontend`, folders, the session storage key `servicios-hogar.access-token`, the backend repository and its paths.
- Visual palette: primary `#117A59`, dark green `#145C46`, pale green `#E8F5EF`, background `#F7F9F8`; font Inter.

## Backend for Integration Tests

- The only official backend is `C:\Users\LENOVO\source\servicios_hogar\backend`. Use exclusively that folder to check contracts and to run real integration tests.
- Do NOT create another backend, clone it, copy its files into the frontend or use other copies. Do NOT modify it.
- Before starting it, check whether it is already running and read its README/configuration. Do NOT run migrations, seeders or destructive operations without authorization. Stop only the processes you started.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Do NOT set `changeDetection: ChangeDetectionStrategy.OnPush` explicitly. `OnPush` is the default in Angular v22+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

## Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `model()` for two-way bound properties with `[(prop)]` syntax instead of pairing `input()` with `output()`
- Use `computed()` for derived state
- Use `linkedSignal()` for state derived from multiple reactive sources that must stay synchronized
- Prefer inline templates for small components
- Use Reactive Forms (`@angular/forms`) for all forms. This is a project architecture decision: do NOT use Signal Forms or Template-driven forms
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- Do NOT import `CommonModule`, import only the directives and pipes the template uses, such as `AsyncPipe` or `DatePipe`
- When using external templates/styles, use paths relative to the component TS file.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Prefer the `@Service` decorator over `@Injectable({providedIn: 'root'})` for new singleton services (Angular v22+)
- Use the `inject()` function instead of constructor injection

## Project Architecture

The reference document is `Arquitectura_Frontend_Angular22_Integracion_Backend.docx`. The backend API contracts live in `docs/frontend-api-contracts/`. Do NOT change the architecture or invent endpoints, DTOs, models, enums, permissions or business rules: if something is not in the contracts, it has no contract yet (see `09-gaps-and-pending-contracts.md`).

- Layers: `src/app/core/` (app-wide singletons: auth, session, guards, interceptors, API URL, common models), `src/app/shared/` (reusable UI, pipes, directives, validators, utils; must not depend on features), `src/app/layouts/` (public, client, worker, admin), `src/app/features/<feature>/` (`pages/`, `components/`, `services/`, `models/`, `validators/`, `<feature>.routes.ts`).
- Single main route tree in `app.routes.ts`; features are lazy-loaded with `loadChildren`/`loadComponent`.
- Signals for local and session state; RxJS for async and HTTP composition.
- Components never build URLs or call `HttpClient` directly; one API service per resource/feature.
- HTTP: `provideHttpClient(withInterceptors([...]))`. Base URL comes from `environment.apiBaseUrl` (`/api`, proxied to `http://localhost:3000` by `proxy.conf.json`). Do not duplicate the `/api` prefix, do not enable `withCredentials`, do not set `Content-Type` for `FormData`.
- Guards are UX only; the backend is the authority for authorization.
- Use the exact backend enum literals; amounts are decimal strings (`"150.50"`); dates are ISO 8601 UTC strings displayed in `America/La_Paz`; app locale is `es-BO`.
- PATCH bodies contain only the fields the DTO accepts (`forbidNonWhitelisted`).
- Do not create empty files or speculative abstractions.

## Naming and Files

- Files and folders in kebab-case with type suffix: `order-detail-page.component.ts`, `orders-api.service.ts`, `auth.guard.ts`, `auth.interceptor.ts`, `order.model.ts`. Classes in PascalCase with suffix: `OrderDetailPageComponent`.
- The CLI is configured (`angular.json`) to generate `.component.ts` with SCSS, and `.guard.ts`, `.interceptor.ts`, `.pipe.ts`.

## Styles

- SCSS only. Global entry `src/styles.scss`; tokens, mixins and global base rules in `src/styles/` (`_tokens.scss`, `_mixins.scss`, `_global.scss`).
- In component styles use `@use 'tokens';` and `@use 'mixins';` (`src/styles` is in `includePaths`). Global styles must not contain page- or component-specific rules.
- Form controls (`.field*`, `.form-alert`, `.form-notice`, `.form-submit`) live in the Sass module `src/styles/_form-controls.scss`. It is NOT part of the global styles: components with forms include it with `@use 'form-controls';`.

## Quality Checks

- Before finishing a change run `npm run build`, `npm test -- --watch=false` and `npm run lint`.
