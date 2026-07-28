import { authFetch, register } from "./auth.js";

const form = document.querySelector("#registerForm");
const message = document.querySelector("#authMessage");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const password = data.get("password");
  const confirmPassword = data.get("confirmPassword");

  if (password !== confirmPassword) {
    message.textContent = "Passwords do not match.";
    return;
  }

  try {
    message.textContent = "Creating account...";
    const user = await register(data.get("email"), password);
    await authFetch("/api/me");
    message.textContent = "Account created. Confirm your in-game profile next.";
    window.setTimeout(() => {
      window.location.href = "/profile-link.html";
    }, 900);
  } catch (error) {
    message.textContent = error.message;
  }
});
