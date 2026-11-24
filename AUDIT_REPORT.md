# School Management System SaaS — Review & Patch Report

## Scope
Reviewed the supplied ZIP contents, including the Express/Mongoose backend, React/Vite client source, test suites, Docker files, README and SaaS guide. The Parent Portal remains excluded.

## Changes applied

1. **Database startup is now deterministic**
   - The API waits for MongoDB before opening its HTTP listener.
   - Missing `MONGO_URI` now produces a clear startup error.
   - Database connection errors are propagated to the startup handler instead of calling `process.exit()` inside a reusable connection helper.
   - Importing the Express app in tests no longer starts a listener or an unawaited database connection.

2. **Health check reports actual readiness**
   - `/api/health` returns HTTP 200 only while Mongoose is connected.
   - It returns HTTP 503 and a disconnected status when MongoDB is unavailable, so container health checks no longer report a healthy API with a down database.

3. **Cross-origin request protection**
   - State-changing browser requests carrying an Origin header are rejected unless the origin matches `CLIENT_URL`.
   - Requests from non-browser clients without an Origin header remain supported.

4. **Password-reset email hardening**
   - The user's first name is HTML-escaped before being inserted into the reset email.
   - SMTP transport is reused instead of recreated for every message.
   - Production no longer silently simulates email delivery when SMTP is missing or still contains example placeholders.
   - Development logs only that delivery was skipped; it no longer prints reset URLs or message contents.

5. **Removed a broken package command**
   - Removed `npm run seed`, which referenced a missing `utils/seedData.js` file.
   - Updated the SaaS guide to explain that school registration creates the first administrator.

6. **Documentation accuracy**
   - Updated the README's phase-status wording so it does not imply that the full production validation has been completed.

## Verification performed

- All backend JavaScript files passed `node --check`.
- Backend test suite: **49 passed, 0 failed**.
- Static tenant-isolation audit passed, including the check that Parent Portal code is absent from active application modules.
- The existing test runner skipped the MongoDB-backed integration suites because `TEST_MONGO_URI` was not supplied.

## Remaining validation blockers

These are environment limitations, not confirmed application defects:

- No MongoDB server or Docker executable was available in this review environment, so the four database-backed integration suites could not be executed.
- Frontend dependencies could not be installed before the package-manager timeout. Consequently, Vite production build and ESLint could not be run here.
- No `package-lock.json` was present in the supplied project. A lockfile was not fabricated because dependency resolution could not complete.

## Before production deployment

1. Install frontend and backend dependencies in a network-enabled environment and commit generated lockfiles.
2. Run all four MongoDB integration suites against a disposable test database.
3. Run `npm run build` and `npm run lint` in `client`.
4. Configure a real SMTP provider and a strong production `JWT_SECRET` (32+ random characters).
5. Verify HTTPS, cookie behavior and allowed origins using the actual production domains.
6. Back up any existing database before running the Parent Portal legacy-data cleanup script with `--apply`.

## Parent Portal policy

No Parent Portal feature was added. The only remaining parent-related references are intentional legacy-role blocking and the opt-in migration/cleanup utility for old databases.
