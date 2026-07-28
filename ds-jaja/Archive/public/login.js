import { signIn } from "./auth.js";

const form = document.querySelector("#loginForm");
const message = document.querySelector("#authMessage");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);

  try {
    message.textContent = "Signing in...";
    await signIn(data.get("email"), data.get("password"));
    window.location.href = "/";
  } catch (error) {
    message.textContent = error.message;
  }
});
