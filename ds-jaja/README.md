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

## V1–V3 event architecture

- Weekly reset has been replaced by immutable event records and participants.
- Events move through draft, published, in-progress, completed, and archived.
- Member, officer, and administrator roles are enforced on the server.
- New accounts default to member and must be linked to a player by an admin.
- Assignment writes are targeted and use record versions to detect conflicts.
- Important changes create audit entries.
- Connected clients receive lightweight live-update notifications.
- Participation metrics are calculated from archived event participants.
- Reusable timed strategy templates are copied into events and versioned.
- The source of truth remains `data/state.json`, using a Firebase-shaped schema.

See [`ARCHITECTURE_V1_3.md`](ARCHITECTURE_V1_3.md) for the assessment and target
schema, and [`MANUAL_TESTING.md`](MANUAL_TESTING.md) for deployment checks.

## Run locally

```powershell
npm run seed
npm run migrate:v1
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

## Roles and first administrator

Set `DSCC_ADMIN_UIDS` before the first administrator signs in:

```bash
DSCC_ADMIN_UIDS="firebase-auth-uid" npm start
```

Unrecognized authenticated users are created as active members with no player
link. This preserves self-registration without granting officer access.

## Persistence and live updates

Every mutation goes through a targeted API and rewrites the local JSON document
atomically at the process level. Server-sent events notify connected browsers
to fetch the changed active-event data. This provides live behavior for one
server instance. A multi-instance deployment should move the documented paths
to Firebase Realtime Database and use native transactions/subscriptions.

The first event-schema load creates:

- `data/state.pre-events-v1.json` — pre-migration backup
- `MIGRATION_REPORT.md` — migration totals and review items

Migration is idempotent.

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

### Administrator bootstrap and recovery

New accounts always start with the `member` role. Before the first administrator
signs in, set `DSCC_BOOTSTRAP_ADMIN_EMAIL` to that administrator's exact email:

```powershell
$env:DSCC_BOOTSTRAP_ADMIN_EMAIL="admin@example.com"
npm run dev
```

Only an account whose email matches that server-controlled value is initially
created as an administrator. The primary administrator account
`zacheryaaronmay@gmail.com` is also restored to an active administrator whenever that
authenticated Firebase account signs in. This repairs an accidentally removed,
demoted, or deactivated application account without weakening authorization for
other users. If the Firebase Authentication account was deleted and recreated
with a new UID, signing in with the same recovery email also transfers its
existing roster profile and player link to the new UID. For the primary
administrator, this restores the `Dark Wizard` profile link.

Additional recovery accounts can be configured as a comma-separated,
server-controlled list:

```powershell
$env:DSCC_RESTORE_ADMIN_EMAILS="owner@example.com,backup@example.com"
npm run dev
```

Do not expose these values in browser code. After bootstrap, administrators can
manage roles and player links through the authenticated `/api/users` endpoints.

Application user records contain `uid`, `email`, `displayName`, `role`,
`playerId`, `active`, `createdAt`, and `lastLoginAt`. All protected writes check
the authenticated user's active record and role on the server.

Realtime Database persistence is available through the Firebase Admin SDK. Set
`DSCC_DATA_BACKEND=firebase` and configure Application Default Credentials before
starting the server. On the first Firebase-backed startup, an empty database is
seeded from `data/state.json`; every later application mutation is saved to
`appState/current` automatically.

```powershell
$env:DSCC_DATA_BACKEND="firebase"
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\secure\service-account.json"
npm start
```

The Admin SDK is the only database client, so `database.rules.json` denies
direct browser reads and writes. Deploy those rules with:

```powershell
npm run firebase:login
npm run firebase:deploy:rules
```
