# Repository Guidelines

## Project Structure & Module Organization
- `src/main/`: Electron main-process code, IPC handlers, vault services, schedules, and persistence.
- `src/preload/`: secure renderer bridge exposed to the UI.
- `src/renderer/src/`: React app shell, pages, hooks, renderer utilities, and UI primitives.
- `src/shared/`: cross-process types, IPC channel names, and pure helpers.
- `tests/`: Vitest unit tests such as `calendarTasks.test.ts`.
- `e2e/`: Playwright Electron flows such as `grid-page.spec.ts`.
- `docs/`, `assets/`, `build/`, and `resources/`: product notes, images, icons, and packaging assets.

## Build, Test, and Development Commands
- `npm install`: install dependencies and native bindings.
- `npm run dev`: start the Electron + Vite dev environment.
- `npm run build`: run type checks, then produce a production build.
- `npm run start`: preview the built app.
- `npm run lint`: run ESLint.
- `npm run format`: apply Prettier formatting.
- `npm run test:run`: run Vitest once.
- `npm run test:e2e`: build the app and run Playwright tests.

## Coding Style & Naming Conventions
- Use TypeScript throughout. Follow existing style: 2-space indentation, single quotes, and no semicolons.
- Prefer React function components and hooks. Components/pages use PascalCase filenames like `SettingsPage.tsx`; utilities use camelCase like `calendarTasks.ts`.
- Keep shared contracts in `src/shared/` and renderer-only helpers in `src/renderer/src/lib/`.
- Keep comments sparse. Favor descriptive names over explanatory comments.

## Testing Guidelines
- Unit coverage uses Vitest in `tests/`; end-to-end coverage uses Playwright in `e2e/`.
- Name unit tests `*.test.ts` and e2e specs `*.spec.ts`.
- When changing a page or workflow, add or update the nearest targeted test instead of relying only on broad manual checks.
- Before opening a PR, run the most relevant commands for your change, for example: `npm run lint`, `npm run test:run`, `npm run test:e2e -- e2e/grid-page.spec.ts`.

## Commit & Pull Request Guidelines
- Recent history uses very short subjects (`Update`, `update`). Keep commits short and imperative, but make them more specific when possible, for example: `renderer: move grid controls into sidebar`.
- PRs should include a concise summary, affected areas, test evidence, and UI screenshots.
- Link the relevant issue or task when one exists, and note any follow-up work or known limitations.

## Security & Runtime Boundaries
- Keep filesystem, shell, and OS access in `src/main/` or `src/preload/`; do not call Node APIs directly from renderer components.
- Respect Electron’s isolation model (`contextIsolation: true`, `nodeIntegration: false`) when adding new capabilities.
