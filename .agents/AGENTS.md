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
- **Tailwind CSS**: ALWAYS use Tailwind CSS utility classes for styling.
- **Accessibility**: Follow all WCAG accessibility rules strictly. Ensure semantic HTML, proper `aria` attributes, and keyboard navigability.
