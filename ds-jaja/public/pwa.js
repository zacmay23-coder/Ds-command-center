const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
let installPrompt = null;

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js", { updateViaCache: "none" }).then((registration) => registration.update()).catch(() => {
      // The app remains fully usable online if registration is unavailable.
    });
  });
}

function createInstallButton() {
  const actions = document.querySelector(".header-actions");
  if (!actions || isStandalone || document.querySelector("#installAppButton")) return;

  const button = document.createElement("button");
  button.id = "installAppButton";
  button.className = "secondary-button install-app-button";
  button.type = "button";
  button.textContent = "Install App";
  button.hidden = true;
  actions.prepend(button);

  button.addEventListener("click", async () => {
    if (installPrompt) {
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      button.hidden = true;
      return;
    }

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    window.alert(isIos
      ? "To add Ewar Command Center: tap the Share button, then choose “Add to Home Screen.”"
      : "Open your browser menu and choose “Install app” or “Add to Home screen.”");
  });

  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) button.hidden = false;
}

createInstallButton();

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  createInstallButton();
  const button = document.querySelector("#installAppButton");
  if (button) button.hidden = false;
});

window.addEventListener("appinstalled", () => {
  installPrompt = null;
  document.querySelector("#installAppButton")?.remove();
});
