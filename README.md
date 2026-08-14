# CourseRoad

CourseRoad is a degree planner for MIT students. It lays out classes
term by term, audits the plan against degree requirements, and syncs
roads to an account when logged in. Catalog data, the requirements
engine, auth, and sync come from the [FireRoad](https://fireroad.mit.edu)
API.

Vue 3, TypeScript, Pinia, vue-router, Vite. Unit tests run under Vitest,
end-to-end tests under Playwright.

## Install

Node 22 or newer (`.nvmrc` names the CI version).

```sh
npm install
npm run dev
```

The dev server serves http://localhost:8080.

## Scripts

- `npm run dev`: Vite dev server at http://localhost:8080
- `npm run devdev`: dev server in `devdev` mode (local FireRoad)
- `npm test`: unit suite (Vitest)
- `npm run test:watch`: unit suite in watch mode
- `npm run test:coverage`: unit suite with coverage
- `npm run test:e2e`: Playwright suite; builds, then serves on port 4173
- `npm run typecheck`: vue-tsc over the app and test configs
- `npm run lint`: ESLint
- `npm run format` / `npm run format:check`: Prettier
- `npm run palette`: regenerate `src/design/departmentColors.css`
- `npm run build-prod` / `npm run build-dev`: production and staging builds
- `npm run preview`: serve the last build locally

## Environment

Set in `.env.development`, `.env.staging`, `.env.production`, and
`.env.devdev`:

- `VITE_FIREROAD_URL`: FireRoad API base URL
- `VITE_URL`: this app's base URL, used for the OAuth redirect

## Routes

- `/road/:road?`: the planner, optionally deep-linked to a road id
- `/explore`: the Connections graph
- `/styleguide`: design tokens and components in both themes
- `/road?demo=1`: seeds a demo plan (dev builds only)

## Deploy

```sh
./deploy.sh [dev|prod] [kerberos]
```

Builds, then copies `dist/` to the MIT locker over scp. `dev` publishes
to courseroad.mit.edu/dev/; `prod` asks for confirmation first and
publishes to courseroad.mit.edu. Requires access to the courseroad
locker.
