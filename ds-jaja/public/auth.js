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
    savedAt: new Date().toISOString()
  }));
}

export function clearSession() {
  localStorage.removeItem(sessionKey);
}

export async function authFetch(url, options = {}) {
  const session = requireSession();
  if (!session) throw new Error("Not signed in");

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

  if (response.status === 401) {
    clearSession();
    window.location.href = "/login.html";
    throw new Error("Please sign in again");
  }

  return response;
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
