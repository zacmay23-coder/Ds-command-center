import { authFetch, endGuestSession, getSession } from "./auth.js";

const content = document.querySelector("#guestContent");
let demo;
let currentView = "overview";
let team = "A";
let phaseIndex = 0;
let selectedStructure = "Info Center";
let playback;

if (getSession()?.accountType !== "guest") window.location.replace("/login.html");

document.querySelector(".guest-nav").addEventListener("click", (event) => {
  const button = event.target.closest("[data-guest-view]");
  if (!button) return;
  currentView = button.dataset.guestView;
  document.querySelectorAll("[data-guest-view]").forEach((item) => item.classList.toggle("active", item === button));
  render();
});

document.querySelector("#exitGuestButton").addEventListener("click", async () => {
  stopPlayback();
  await endGuestSession();
  window.location.replace("/login.html");
});

content.addEventListener("click", (event) => {
  const viewLink = event.target.closest("[data-guest-view-link]");
  const teamButton = event.target.closest("[data-demo-team]");
  const phaseButton = event.target.closest("[data-demo-phase]");
  const structureButton = event.target.closest("[data-demo-structure]");
  if (viewLink) { document.querySelector(`[data-guest-view="${viewLink.dataset.guestViewLink}"]`)?.click(); }
  else if (teamButton) { team = teamButton.dataset.demoTeam; phaseIndex = 0; selectedStructure = "Info Center"; render(); }
  else if (phaseButton) { stopPlayback(); phaseIndex = Number(phaseButton.dataset.demoPhase); render(); }
  else if (structureButton) { selectedStructure = structureButton.dataset.demoStructure; render(); }
  else if (event.target.closest("[data-demo-play]")) togglePlayback();
  else if (event.target.closest("[data-demo-reset]")) { stopPlayback(); phaseIndex = 0; render(); }
});

load();

async function load() {
  try {
    const response = await authFetch("/api/guest/bootstrap");
    demo = await response.json();
    if (!response.ok) throw new Error(demo.message || demo.error);
    render();
  } catch (error) {
    content.innerHTML = `<section class="panel guest-error"><h2>Guest Preview is temporarily unavailable</h2><p>${escapeHtml(error.message)}</p><a class="primary-button" href="/login.html">Return to sign in</a></section>`;
  }
}

function render() {
  if (!demo) return;
  const views = { overview: renderOverview, events: renderEvents, map: renderMap, strategies: renderStrategies, features: renderFeatures };
  content.innerHTML = views[currentView]();
}

function renderOverview() {
  return `<section class="guest-hero panel"><p class="eyebrow">Guest Preview · Read Only</p><h1>Welcome to Ewar: Lords of War</h1><p>Explore how the Command Center coordinates events, teams, strategies, and operational planning.</p><small>${escapeHtml(demo.notice)}</small><div class="guest-actions"><button class="primary-button" data-guest-view-link="map">Open Interactive Map</button><a class="secondary-button" href="/register.html">Request Full Access</a></div></section><div class="guest-preview-grid">${renderEventCard()}${demo.features.map(featureCard).join("")}</div>`;
}

function renderEvents() { return `<div class="section-title"><h1>Events Preview</h1><p>Published demonstration content only.</p></div><div class="guest-preview-grid">${renderEventCard()}<article class="panel"><p class="eyebrow">Theme Week Preview</p><h3>Alliance Identity Week</h3><p>A safe example of member submissions, voting, and published results.</p></article><article class="panel"><p class="eyebrow">VS Week Preview</p><h3>Weekly Competition Operations</h3><p>Score auditing and standings are available to authorized alliance accounts.</p></article></div>`; }

function renderEventCard() { return `<article class="panel"><p class="eyebrow">Active demonstration</p><h3>${escapeHtml(demo.event.title)}</h3><p>${escapeHtml(demo.event.summary)}</p><button class="secondary-button" type="button" data-guest-view-link="map">View Interactive Map</button></article>`; }

function renderMap() {
  const map = demo.map;
  const phaseKey = map.phases[phaseIndex];
  const plan = map.teams[team];
  const orders = plan.phases[phaseKey] || {};
  const relevant = Object.entries(orders).filter(([, order]) => order.objective === selectedStructure || order.secondaryObjective === selectedStructure);
  return `<div class="section-title"><div><p class="eyebrow">Guest Preview · Read Only</p><h1>Interactive Desert Storm Map</h1></div><p>Planned strategy simulation using fictional player labels.</p></div>
    <section class="guest-map-controls panel"><div>${["A", "B"].map((value) => `<button data-demo-team="${value}" class="${team === value ? "active" : ""}">Team ${value}</button>`).join("")}</div><strong>${escapeHtml(plan.strategyName)}</strong><button data-demo-play>${playback ? "Pause" : "Play"} Simulation</button><button data-demo-reset>Reset</button></section>
    <div class="guest-phase-row">${map.phases.map((phase, index) => `<button data-demo-phase="${index}" class="${index === phaseIndex ? "active" : ""}">${phase.replace("-", "–")} min</button>`).join("")}</div>
    <div class="guest-map-layout"><div class="guest-map-stage"><img src="/assets/desert-storm-map-clean.png" alt="Desert Storm demonstration battlefield">${Object.entries(map.objectivePositions).map(([name, position]) => `<button data-demo-structure="${escapeHtml(name)}" aria-label="View ${escapeHtml(name)} details" class="guest-map-node ${name === selectedStructure ? "selected" : ""} ${Object.values(orders).some((order) => order.objective === name) ? "active" : ""}" style="left:${position[0]}%;top:${position[1]}%"><span>${escapeHtml(name)}</span></button>`).join("")}</div>
      <aside class="panel guest-structure-panel"><p class="eyebrow">${phaseKey.replace("-", "–")} minutes</p><h2>${escapeHtml(selectedStructure)}</h2>${relevant.map(([group, order]) => `<article><strong>${escapeHtml(group)} · ${escapeHtml(order.action)}</strong><p>${escapeHtml(order.instruction)}</p><small>Priority: ${escapeHtml(order.priority)}</small></article>`).join("") || `<p>No active objective during this phase.</p>`}<small>Demo assignments use anonymized unit groups and never expose alliance members.</small></aside></div>`;
}

function renderStrategies() { return `<div class="section-title"><h1>Published Strategy Examples</h1><p>Read-only demonstration doctrine.</p></div><div class="guest-preview-grid">${demo.strategies.map((item) => `<article class="panel"><p class="eyebrow">Six-phase strategy</p><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description)}</p><button type="button" data-guest-view-link="map">Explore on Map</button></article>`).join("")}</div>`; }
function renderFeatures() { return `<div class="section-title"><h1>Feature Tour</h1><p>Private workflows are explained without loading private records.</p></div><div class="guest-preview-grid">${demo.features.map(featureCard).join("")}</div>`; }
function featureCard(item) { return `<article class="panel guest-locked-card"><span aria-hidden="true">🔒</span><p class="eyebrow">Available to Alliance Members</p><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p></article>`; }
function togglePlayback() { if (playback) stopPlayback(); else playback = window.setInterval(() => { phaseIndex = (phaseIndex + 1) % demo.map.phases.length; render(); }, 2200); render(); }
function stopPlayback() { if (playback) window.clearInterval(playback); playback = null; }
function escapeHtml(value = "") { return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]); }
