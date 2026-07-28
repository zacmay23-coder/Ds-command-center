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
  localStorage.setItem(sessionKey, JSON.stringify({
    email: session.email,
    idToken: session.idToken,
    refreshToken: session.refreshToken,
    uid: session.localId,
    expiresAt: Date.now() + Number(session.expiresIn || 3600) * 1000,
    savedAt: new Date().toISOString()
  }));
}

export function clearSession() {
  localStorage.removeItem(sessionKey);
}

export async function authFetch(url, options = {}) {
  let session = requireSession();
  if (!session) throw new Error("Not signed in");
  if (!session.expiresAt || Date.now() > session.expiresAt - 60_000) {
    session = await refreshSession(session);
  }

  const headers = {
    Authorization: `Bearer ${session.idToken}`,
    ...(options.headers || {})
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 401 && !options._retried) {
    try {
      await refreshSession(session);
      return authFetch(url, { ...options, _retried: true });
    } catch {
      clearSession();
      window.location.href = "/login.html";
      throw new Error("Your session expired. Please sign in again.");
    }
  }

  return response;
}

export function liveUpdatesUrl() {
  const session = getSession();
  return session?.idToken ? `/api/live?token=${encodeURIComponent(session.idToken)}` : null;
}

async function refreshSession(session) {
  if (!session?.refreshToken) throw new Error("No refresh token is available");
  const response = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: session.refreshToken })
    }
  );
  const payload = await response.json();
  if (!response.ok) throw new Error("Your session could not be refreshed");
  const refreshed = {
    email: session.email,
    idToken: payload.id_token,
    refreshToken: payload.refresh_token,
    localId: payload.user_id,
    expiresIn: payload.expires_in
  };
  saveSession(refreshed);
  return getSession();
}

export async function signIn(email, password) {
  return firebaseAuthRequest("accounts:signInWithPassword", {
    email,
    password,
    returnSecureToken: true
  });
}

export async function register(email, password) {
  return firebaseAuthRequest("accounts:signUp", {
    email,
    password,
    returnSecureToken: true
  });
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
