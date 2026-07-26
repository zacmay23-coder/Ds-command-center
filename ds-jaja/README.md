# Desert Storm Command Center

A readable server-backed remake of the original single-file Command Center.

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
