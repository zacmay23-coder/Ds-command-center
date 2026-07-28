import { authFetch, clearSession, requireSession } from "./auth.js";

const form = document.querySelector("#profileLinkForm");
const playerSelect = document.querySelector("#playerId");
const message = document.querySelector("#linkMessage");

document.addEventListener("DOMContentLoaded", initialize);
form.addEventListener("submit", linkProfile);
document.querySelector("#signOutButton").addEventListener("click", () => {
  clearSession();
  window.location.href = "/login.html";
});

async function initialize() {
  requireSession();
  try {
    const [meResponse, profilesResponse] = await Promise.all([
      authFetch("/api/me"),
      authFetch("/api/available-player-profiles")
    ]);
    const me = await meResponse.json();
    const profiles = await profilesResponse.json();
    if (!meResponse.ok) throw new Error(me.error || "Account could not be loaded");
    if (!profilesResponse.ok) throw new Error(profiles.error || "Directory profiles could not be loaded");

    if (me.profileConfirmedAt) {
      window.location.href = "/";
      return;
    }

    playerSelect.innerHTML = `
      <option value="">Choose your in-game name</option>
      ${profiles
        .map((member) => `<option value="${escapeHtml(member.id)}"
          ${member.id === me.playerId ? "selected" : ""}
          ${member.linkStatus === "linked" ? "disabled" : ""}>
          ${escapeHtml(member.name)} · ${escapeHtml(member.rank || "No rank")} · Team ${escapeHtml(member.team)} · ${escapeHtml(member.unit)}${member.linkStatus === "linked" ? " · Linked to another account" : ""}
        </option>`)
        .join("")}
    `;
    message.textContent = me.playerId
      ? "Confirm your current Master Directory profile or ask an officer to change the link."
      : "Choose the profile that matches your current Master Directory entry.";
  } catch (error) {
    message.textContent = error.message;
  }
}

async function linkProfile(event) {
  event.preventDefault();
  const playerId = playerSelect.value;
  if (!playerId) {
    message.textContent = "Choose your roster profile first.";
    return;
  }

  const selectedName = playerSelect.selectedOptions[0]?.textContent || "this profile";
  if (!confirm(`Link your account to ${selectedName}? An administrator is required to change it later.`)) return;

  try {
    message.textContent = "Linking your profile…";
    const response = await authFetch("/api/link-player", {
      method: "POST",
      body: JSON.stringify({ playerId })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Profile could not be linked");
    window.location.href = "/";
  } catch (error) {
    message.textContent = error.message;
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;"
  })[character]);
}
