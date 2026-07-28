import { authFetch, signIn } from "./auth.js";

const form = document.querySelector("#loginForm");
const message = document.querySelector("#authMessage");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);

  try {
    message.textContent = "Signing in...";
    await signIn(data.get("email"), data.get("password"));
    const response = await authFetch("/api/me");
    const me = await response.json();
    if (!response.ok) throw new Error(me.error || "Account profile could not be loaded");
    window.location.href = me.profileConfirmedAt ? "/" : "/profile-link.html";
  } catch (error) {
    message.textContent = error.message;
  }
});
