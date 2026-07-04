# Frontend Workspace Rules (Angular 17+)

When working on the frontend application in this workspace, ALL agents must strictly adhere to the following Domain Driven Design (DDD) and architectural rules:

## 1. Domain Driven Design (DDD) Folder Structure
Features should be divided into logical domains. Within each domain, adhere to this strict folder structure:
- `data/`: Use this folder exclusively for services, state management (store), and data fetching logic.
- `ui/`: Use this folder exclusively for components. Both "smart" (container) and "dumb" (presentational) components belong here.
- `utils/`: Use this folder exclusively for helper functions and utilities.

## 2. Component Architecture
- **Dumb Components**: Presentational (dumb) components must **ONLY** accept inputs and emit outputs. They must not inject services or contain business logic.

## 3. Signals & Strict Typing
- **Signals are REQUIRED**: You must use modern Angular Signal APIs (`signal()`, `computed()`, `input()`, `output()`, `effect()`) for all state and component communication.
- **Strictly Typed**: Everything must be strictly typed. Do not use `any`.
- **Types files**: All custom types and interfaces must be defined in dedicated `types.ts` files within the appropriate folder.

## 4. Styling & Accessibility (WCAG)
- **Tailwind CSS**: ALWAYS use Tailwind CSS utility classes for styling. Prefer viewport-relative units (e.g. `dvh`) so layouts never exceed the user's screen.
- **Accessibility**: Follow all WCAG accessibility rules strictly. Ensure semantic HTML (`<main>`, `<section>`, `<nav>`), proper `aria` attributes (`aria-label`, `aria-required`, `role="alert"`), and keyboard navigability.

## 5. Change Detection
- **OnPush is REQUIRED**: Every component must declare `changeDetection: ChangeDetectionStrategy.OnPush`.

## 6. Dependency Injection
- **Use `inject()`**: Always inject dependencies with the `inject()` function assigned to `private readonly` fields. Do not use constructor injection.
- **Services**: Data services live in `data/` and must be `@Injectable({ providedIn: 'root' })`, returning `Observable`s from `HttpClient`.
- **Injection Tokens**: Configuration values (e.g. API URLs) must be provided through dedicated `InjectionToken`s, never hard-coded.

## 7. Standalone Components
- **Standalone only**: Do not use `NgModule`s. Declare dependencies in the component `imports` array.

## 8. State & Async Feedback
- **Reactive state**: Model loading, disabled, and error states as signals (e.g. `submitting`, `errorMsg`) and drive the template from them.
- **Guard async actions**: Prevent duplicate submissions by checking and setting the loading signal before dispatching a request, and reset it on error.
