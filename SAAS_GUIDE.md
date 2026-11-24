# Multi-tenant SaaS guide

One React frontend, one Express backend, one MongoDB, one deployment. Many schools.
Each school's data is separated by a `schoolId` field.

## How the separation works (read this first)

1. A school registers (`POST /api/schools/register`). The server creates the `School` and its first user, who is always an `admin`.
2. Every user has a `schoolId`. At login the JWT contains `id`, `role` and `schoolId`.
3. The `protect` middleware (`middleware/auth.js`) does NOT trust the token alone. It loads the user from the database, compares the schoolId in the token with the user's, checks the school is `active`, and then sets `req.schoolId` from the database user.
4. Every controller query uses `req.schoolId`:
   `Student.findOne({ _id: req.params.id, schoolId: req.schoolId })`.
   Nothing reads a `schoolId` from `req.body`, `req.query` or `req.params`.
5. A record of another school simply looks like it does not exist (404). When a request refers to related records (a class's teacher, a student's class, a grade's subject...) they are validated to be from the same school (400).

Special cases
- **Platform owner** (`role: "platform_owner"`): belongs to no school. Uses `protectPlatformOwner` and only `/api/platform/*`. School routes refuse this role.
- **Uploads**: saved in `uploads/<schoolId>/...` and served only to logged-in users of the same school.
- **Socket.IO**: the socket checks the user and school like `protect`; presence events go only to the school's own room; deactivating a school disconnects its sockets.
- **E-mail** stays unique across the whole platform (login is "email + password", no school picker).

## Parent Portal removal

The Parent Portal (parent role, parent pages, `/api/parents`, the `Parent` model, parent-to-student links) was removed. Roles are now `admin`, `teacher`, `student` (plus `platform_owner`). Messaging is Student↔Teacher and Admin↔Teacher; notifications are unchanged.

If your database already has parent data, back it up and clean it once:

```bash
cd server
npm run remove:parent-data            # dry run: shows what would be deleted
npm run remove:parent-data -- --apply # deletes parent users, their conversations,
                                      # messages and notifications, the "parents"
                                      # collection and every student's "parents" list
```

Until you run it, old parent accounts are harmless: they cannot log in and old tokens are refused (`utils/roles.js`). The only code that still mentions parents on purpose is `utils/roles.js` and `utils/removeParentData.js`.

## Setup (local)

```bash
cd server && cp .env.example .env     # set MONGO_URI and JWT_SECRET
npm install
npm run dev
# new terminal
cd client && npm install && npm run dev
```

Platform owner (once, from the command line - there is no public sign-up):

```bash
PLATFORM_OWNER_EMAIL=owner@example.com PLATFORM_OWNER_PASSWORD='a-strong-password' \
  npm run create:platform-owner
```
Sign in at `/login`; you land on `/platform/dashboard`.

## Upgrading an existing single-school database

Back up first, then (one time):

```bash
cd server && npm run migrate:multitenant
```
It creates a "Default School", gives every old record that school, rebuilds the per-school unique indexes, and moves old uploads into `uploads/<schoolId>/`. Everyone must log in again (old tokens have no `schoolId`).

## Docker

See the comments at the top of `docker-compose.yml`. In short: set `JWT_SECRET` (32+ chars) in `server/.env`, `docker compose up --build -d`, then create the platform owner with the command in that file. MongoDB is not exposed to the internet. In production the server refuses to start with a weak `JWT_SECRET`.

## API additions

| Route | Who | What |
|---|---|---|
| `POST /api/schools/register` | public (rate limited) | create school + first admin |
| `GET /api/schools/me` | any school user | own school |
| `PUT /api/schools/me` | admin | edit name, address, phone, logo |
| `GET /api/platform/stats` | platform owner | totals |
| `GET /api/platform/schools` | platform owner | list (search, status, page) |
| `GET /api/platform/schools/:id` | platform owner | school info + head-counts |
| `PATCH /api/platform/schools/:id/status` | platform owner | `active` / `inactive` |

`POST /api/auth/register` was removed.

## Tests

```bash
cd server
npm test                                  # runs without a database: unit tests + static audit
TEST_MONGO_URI=mongodb://127.0.0.1:27017/school-management-test \
JWT_SECRET=test-secret PORT=5099 npm test # also runs the 4 integration suites
```
Use a throw-away database: the integration tests DROP it.

- `tenantIsolation.static.test.js` - scans controllers; fails if a query on school data has no `schoolId`, if `findById` is used, or if a route lacks `protect`.
- `tenantIsolation.full.integration.test.js` - two complete schools; checks every module, students, teachers, uploads, platform owner, deactivation and the removal of the Parent Portal.
- `isolation.integration.test.js`, `schoolRegistration.integration.test.js`, `auth.integration.test.js` - earlier suites.

## Known limits

- No billing/subscriptions (by design for now).
- The same e-mail cannot be used in two schools.
- Uploaded files are stored on the server disk (use a volume; not suitable for several server copies without shared storage).
- Socket.IO presence is kept in memory (single server instance).
- There is intentionally no demo seed command: use the school registration flow to create a school and its first administrator, then add users through the admin interface.
