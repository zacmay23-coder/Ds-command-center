import { authFetch, signIn, startGuestSession } from "./auth.js";

const form = document.querySelector("#loginForm");
const message = document.querySelector("#authMessage");

document.querySelectorAll("[data-toggle-password]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = button.closest(".auth-password-field").querySelector("input");
    const reveal = input.type === "password";
    input.type = reveal ? "text" : "password";
    button.textContent = reveal ? "Hide" : "Show";
    button.setAttribute("aria-label", reveal ? "Hide password" : "Show password");
  });
});

document.querySelector("#guestPreviewButton").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  try {
    message.textContent = "Starting Guest Preview…";
    button.disabled = true;
    await startGuestSession();
    window.location.href = "/guest.html";
  } catch (error) {
    message.textContent = error.message || "Guest Preview is temporarily unavailable. Please try again.";
    button.disabled = false;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const submitButton = form.querySelector("[type='submit']");

  try {
    message.textContent = "Signing in...";
    submitButton.disabled = true;
    await signIn(data.get("email"), data.get("password"));
    const response = await authFetch("/api/me");
    const me = await response.json();
    if (!response.ok) throw new Error(me.error || "Account profile could not be loaded");
    sessionStorage.setItem("ewar-entering-command-center", "true");
    window.location.href = me.profileConfirmedAt ? "/" : "/profile-link.html";
  } catch (error) {
    message.textContent = error.message;
    submitButton.disabled = false;
  }
});
