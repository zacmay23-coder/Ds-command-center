# Desert Storm Command Center v2.0 PWA

This package turns the existing v1.4 Command Center into an installable web application for desktop, iPhone, iPad, Android phones, and Android tablets.

## Included
- Responsive Command Center application
- Offline application shell and local-device saving
- Install prompt on supported browsers
- iPhone/iPad Add to Home Screen support
- Firebase Email/Password officer sign-in
- Firebase Realtime Database shared master record
- Team A/B rosters, readiness, assignments, strategies, timeline, history, evidence, rewards, import/export, and weekly reset

## Deploy
### Netlify
Drag this entire folder into Netlify Drop, or connect it to a Git repository. `netlify.toml` is included.

### Vercel
Import the folder/repository as a static site. `vercel.json` is included.

### Any HTTPS web host
Upload every file and folder without changing the paths. PWA installation and service workers require HTTPS (localhost is also allowed for testing).

## Firebase setup
1. Create a Firebase project.
2. Enable **Authentication > Sign-in method > Email/Password**.
3. Create each authorised officer account.
4. Create a **Realtime Database**.
5. Paste `firebase-database-rules.json` into the database Rules editor and publish it.
6. In Realtime Database data, add `/officers/<OFFICER_UID> = true` for each authorised officer.
7. Open the deployed app, go to **Secure Cloud Master Record**, and enter:
   - Realtime Database URL
   - Firebase Web API key
   - Master key (`desert-storm-master` by default)
   - Officer email and password
8. Sign in, then use **Publish This Device** to create the first cloud master.

## Install on devices
- **Android/Chrome:** open the site and tap Install App or browser menu > Install app.
- **iPhone/iPad/Safari:** Share > Add to Home Screen.
- **Desktop Chrome/Edge:** use the install icon in the address bar or the Install App button.

## Important
The app is fully usable offline with local storage. Cloud synchronisation becomes live after Firebase is configured. Screenshot evidence is stored inside the master record, so very large image archives may increase database usage.
