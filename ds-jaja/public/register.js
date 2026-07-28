import { authFetch, register } from "./auth.js";

const form = document.querySelector("#registerForm");
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

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const password = data.get("password");
  const confirmPassword = data.get("confirmPassword");
  const submitButton = form.querySelector("[type='submit']");

  if (password !== confirmPassword) {
    message.textContent = "Passwords do not match.";
    return;
  }

  try {
    message.textContent = "Creating account...";
    submitButton.disabled = true;
    const user = await register(data.get("email"), password);
    await authFetch("/api/me");
    message.textContent = "Account created. Confirm your in-game profile next.";
    window.setTimeout(() => {
      window.location.href = "/profile-link.html";
    }, 900);
  } catch (error) {
    message.textContent = error.message;
    submitButton.disabled = false;
  }
});
