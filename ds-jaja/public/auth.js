const firebaseConfig = {
  apiKey: "AIzaSyCnccjJ6h-RlTU1Qbp3Zgd2WQag0YVwsWs",
  databaseUrl: "https://ds-command-master-default-rtdb.firebaseio.com"
};

const sessionKey = "dscc-auth-session";

export function getSession() {
  try {
    const session = JSON.parse(localStorage.getItem(sessionKey) || "null");
    if (!session?.idToken) return null;
    return session;
  } catch {
    return null;
  }
}

export function requireSession() {
  const session = getSession();

  if (!session) {
    window.location.href = "/login.html";
    return null;
  }

  return session;
}

export function saveSession(session) {
  const expiresIn = Number(session.expiresIn || session.expires_in || 3600);
  localStorage.setItem(sessionKey, JSON.stringify({
    email: session.email || getSession()?.email || "",
    idToken: session.idToken || session.id_token,
    refreshToken: session.refreshToken || session.refresh_token,
    uid: session.localId || session.user_id,
    expiresAt: Date.now() + expiresIn * 1000,
    savedAt: new Date().toISOString()
  }));
}

export function clearSession() {
  localStorage.removeItem(sessionKey);
}

export async function authFetch(url, options = {}) {
  let session = requireSession();
  if (!session) throw new Error("Not signed in");
  if (!session.expiresAt || session.expiresAt - Date.now() < 60_000) {
    session = await refreshSession();
  }

  let response = await authorizedRequest(url, options, session.idToken);
  if (response.status === 401 && session.refreshToken) {
    session = await refreshSession();
    response = await authorizedRequest(url, options, session.idToken);
  }

  if (response.status === 401) {
    clearSession();
    window.location.href = "/login.html";
    throw new Error("Please sign in again");
  }

  return response;
}

async function authorizedRequest(url, options, idToken) {
  const headers = {
    Authorization: `Bearer ${idToken}`,
    ...(options.headers || {})
  };
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }
  return fetch(url, { ...options, headers });
}

let refreshPromise;

export async function refreshSession() {
  if (refreshPromise) return refreshPromise;
  const session = getSession();
  if (!session?.refreshToken) throw new Error("Your session expired. Please sign in again.");

  refreshPromise = (async () => {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: session.refreshToken
    });
    const response = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body
      }
    );
    const payload = await response.json();
    if (!response.ok) {
      clearSession();
      throw new Error("Your session expired. Please sign in again.");
    }
    saveSession(payload);
    return getSession();
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

export async function signIn(email, password) {
  return firebaseAuthRequest("accounts:signInWithPassword", {
    email,
    password,
    returnSecureToken: true
  });
}

export async function register(email, password, displayName = "") {
  const user = await firebaseAuthRequest("accounts:signUp", {
    email,
    password,
    returnSecureToken: true
  });
  const response = await authFetch("/api/register-profile", {
    method: "POST",
    body: JSON.stringify({ displayName })
  });
  user.profile = await response.json();
  return user;
}

async function firebaseAuthRequest(action, body) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/${action}?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(formatFirebaseError(payload));
  }

  saveSession(payload);
  return payload;
}

function formatFirebaseError(payload) {
  const code = payload?.error?.message || "AUTH_ERROR";
  const messages = {
    EMAIL_EXISTS: "That email is already registered.",
    EMAIL_NOT_FOUND: "No account exists for that email.",
    INVALID_LOGIN_CREDENTIALS: "Incorrect email or password.",
    INVALID_PASSWORD: "Incorrect email or password.",
    WEAK_PASSWORD: "Use a password with at least 6 characters.",
    OPERATION_NOT_ALLOWED: "Enable Email/Password sign-in in Firebase Authentication.",
    API_KEY_INVALID: "The Firebase API key is invalid."
  };

  return messages[code] || code.replaceAll("_", " ");
}
