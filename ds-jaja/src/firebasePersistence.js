import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

const databaseUrl = process.env.DSCC_FIREBASE_DATABASE_URL
  || "https://ds-command-master-default-rtdb.firebaseio.com";
const statePath = process.env.DSCC_FIREBASE_STATE_PATH || "appState/current";

export function isFirebasePersistenceEnabled() {
  return String(process.env.DSCC_DATA_BACKEND || "").trim().toLowerCase() === "firebase";
}

export async function getFirebasePersistenceStatus() {
  const enabled = isFirebasePersistenceEnabled();
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
  const status = {
    enabled,
    databaseUrl,
    statePath,
    hasGoogleApplicationCredentials: Boolean(credentialsPath),
    credentialsPath: credentialsPath ? "[set]" : "",
    connected: false,
    stateExists: false
  };

  if (!enabled) return status;

  try {
    const snapshot = await stateReference().get();
    status.connected = true;
    status.stateExists = snapshot.exists();
    return status;
  } catch (error) {
    status.error = error.message || "Firebase connection failed";
    return status;
  }
}

function stateReference() {
  if (!getApps().length) {
    initializeApp({
      credential: applicationDefault(),
      databaseURL: databaseUrl
    });
  }
  return getDatabase().ref(statePath);
}

export async function loadFirebaseState() {
  if (!isFirebasePersistenceEnabled()) return null;
  const snapshot = await stateReference().get();
  return snapshot.exists() ? snapshot.val() : null;
}

export async function saveFirebaseState(state) {
  if (!isFirebasePersistenceEnabled()) return false;
  await stateReference().set(state);
  return true;
}
