# Desert Storm Command Center

A readable server-backed remake of the original single-file Command Center.

## Project knowledge

Read [`DESERT_STORM_PROJECT_KNOWLEDGE.md`](DESERT_STORM_PROJECT_KNOWLEDGE.md)
before changing event terminology, team assignments, map objectives, readiness,
results, or battle-history behavior. It records the researched event mechanics,
the project owner's canonical map, product goals, domain model, and
patch-sensitive uncertainties.

Implementation priorities and release milestones are maintained in
[`ROADMAP.md`](ROADMAP.md).

## What changed

- The server is now the source of truth.
- Every device reads and writes through `/api/state`.
- Firebase Email/Password login protects access.
- Data is saved to `data/state.json`.
- The client is split into small, readable files.
- No build step or framework is required.

## Run locally

```powershell
npm run seed
npm run dev
```

Open `http://localhost:8082`.

## Docker deploy

```powershell
docker compose up -d --build
```

Open `http://localhost:8082`.

The compose setup mounts `./data` into the container so roster and battle data
survive rebuilds.

## Project layout

```text
server.js                  Web server and API routes
src/dataStore.js           State loading, validation, and saving
scripts/seed-from-legacy.js Imports the roster from ../index.html
public/index.html          App shell
public/login.html          Sign-in page
public/register.html       Registration page
public/styles.css          UI styling
public/app.js              Client behavior
public/auth.js             Firebase Auth helper
src/resultScreenshotReader.js OCR parser for game result screenshots
data/state.json            Shared app data, created by npm run seed
```

## Sync model

Sync works because everyone uses the same server. When one officer saves a
change, the next refresh or update on another device pulls the same shared JSON
state from the server.

## Results screenshot import

On the Results page, officers choose Team A or Team B and upload a Battle
Results screenshot. The server uses bundled OCR data to read the image, matches
`[Ewar]` player names against the roster, and stages those scores as imported
results for that team.
If OCR finds a score but cannot confidently match the name, the page shows a
manual match row. Choosing a player there applies the score and saves the OCR
text as an alias for future imports.

Screenshot imports do not change the directory roster, weekly team assignment,
or availability fields. They become historical event data when the battle is
archived.

## Firebase Auth

This build uses the configured Firebase project for Email/Password access:

- API key: configured in `public/auth.js` and `server.js`
- Database URL: `https://ds-command-master-default-rtdb.firebaseio.com`

Registration creates a Firebase Auth account. The server checks each API request
against Firebase before returning shared data.

### Role bootstrap

New accounts always start with the `member` role. Before the first administrator
signs in, set `DSCC_BOOTSTRAP_ADMIN_EMAIL` to that administrator's exact email:

```powershell
$env:DSCC_BOOTSTRAP_ADMIN_EMAIL="admin@example.com"
npm run dev
```

Only an account whose email matches that server-controlled value is initially
created as an administrator. Do not expose this value in browser code. After
bootstrap, administrators can manage roles and player links through the
authenticated `/api/users` endpoints.

Application user records contain `uid`, `email`, `displayName`, `role`,
`playerId`, `active`, `createdAt`, and `lastLoginAt`. All protected writes check
the authenticated user's active record and role on the server.

Realtime Database subscriptions are not enabled yet. They require deploying
matching Firebase Database Security Rules (and preferably configuring the
Firebase Admin SDK/service account on the server) before local JSON state can be
migrated safely.
