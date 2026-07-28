# Desert Storm Command Center Roadmap

Last updated: 2026-07-26

## Product direction

Evolve the current roster-and-results application into a reliable operational
tool for preparing, running, and reviewing two independent Last War: Survival
Desert Storm task-force battles.

The finished product should support the full event cycle:

```text
Alliance directory
       ↓
Team A / Team B selection
       ↓
Availability and map assignments
       ↓
Battle preparation and substitute order
       ↓
Live 30-minute battle command
       ↓
Separate team results and OCR imports
       ↓
Battle history and selection insights
```

The researched event and project rules are maintained in
[`DESERT_STORM_PROJECT_KNOWLEDGE.md`](DESERT_STORM_PROJECT_KNOWLEDGE.md).

## Roadmap principles

- Team A and Team B are independent task forces and independent matches.
- Data correctness and access control come before new tactical features.
- The server is responsible for authorization and validation.
- Weekly preparation data is mutable; archived battle data is historical.
- Live game values that may change must be configurable or marked
  patch-sensitive.
- Operational screens must work well on phones.
- Officer decisions remain explicit; the software assists rather than silently
  inferring availability, assignment, or strategy.

## Phase 0 — Baseline and safety net

**Goal:** Make future changes measurable and reduce regression risk.

### Deliverables

- Add automated tests for:
  - Team capacity limits
  - Valid team, role, unit, availability, and attendance values
  - Weekly reset behavior
  - Battle archive creation
  - OCR name and alias matching
  - OCR/manual result merging
- Add API integration tests for protected and unprotected routes.
- Add representative fixture data for Team A, Team B, and OCR screenshots.
- Document the current JSON state schema.
- Add a state-file backup command.
- Add a startup check that reports invalid or legacy state values.

### Acceptance criteria

- Tests can be run with one documented command.
- Existing valid state loads without modification.
- Invalid state produces a clear report.
- A backup can be created before migrations or releases.

### Dependencies

None.

---

## Phase 1 — Correct the two-task-force data model

**Goal:** Remove the largest mismatch between the app and Desert Storm.

### Deliverables

- Add a team field to every battle record.
- Archive Team A and Team B as separate battle records.
- Store independent values for each match:
  - Opponent
  - Date and scheduled time
  - Outcome
  - Alliance score
  - Enemy score
  - Strategy
  - Notes
  - Participants
- Separate pending OCR imports by team and battle.
- Merge OCR scores into selected-member snapshots instead of replacing them.
- Preserve role, unit, availability, attendance, and notes for OCR-matched
  members.
- Ensure OCR-imported attendance updates member attendance history.
- Add a migration for existing combined battle records.
- Mark ambiguous migrated history as legacy rather than guessing a team.

### Acceptance criteria

- Team A can be archived without changing or archiving Team B.
- Team B can be archived without changing or archiving Team A.
- Both teams can have different opponents, results, and scores in the same week.
- An OCR-matched player retains the correct role and map assignment.
- Archiving one team clears only that team's pending results.
- Historical counters are updated once per archived participant.

### Dependencies

Phase 0 test foundation.

---

## Phase 2 — Authorization, validation, and auditability

**Goal:** Restrict sensitive operations and protect shared data integrity.

### Deliverables

- Disable unrestricted public registration.
- Add an approved-officer allowlist.
- Add roles:
  - Administrator
  - Officer
  - Read-only
- Enforce permissions on the server.
- Restrict full-state replacement, weekly reset, officer management, and
  destructive history operations to administrators.
- Validate server-side enums:
  - Team
  - Starter/Substitute role
  - Canonical map unit
  - Availability
  - Attendance
  - Outcome
- Require selected players to belong to Team A or Team B.
- Validate archive payloads and scores.
- Add automatic Firebase ID-token refresh.
- Move deployment-specific configuration into environment variables.
- Add an audit log for:
  - Roster changes
  - Assignment changes
  - Strategy changes
  - Weekly resets
  - Battle archives
  - Match corrections

### Acceptance criteria

- An unapproved Firebase account cannot access shared state.
- Read-only users cannot mutate data.
- Officers cannot perform administrator-only actions.
- Invalid units or team values are rejected by the API.
- Normal sessions continue without forcing sign-in after token expiration.
- Every important mutation records actor, time, action, and target.

### Dependencies

Phase 1 data model.

---

## Phase 3 — Battle preparation workspace

**Goal:** Give officers an actionable pre-battle workflow for each task force.

### Deliverables

- Create separate Team A and Team B preparation pages.
- Store team-specific:
  - Scheduled battle time
  - Opponent
  - Commander
  - Supporting officers
  - Communications channel
  - Opening strategy
  - Center-unlock plan
  - Substitute order
  - Briefing notes
- Add check-in states:
  - Pending
  - Ready
  - Late
  - Missing
- Add a fast substitute-activation workflow.
- Allow assignments to be edited from the preparation and assignment pages.
- Always display all eleven map structures.
- Mark empty objectives clearly.
- Group structures by battle stage.
- Highlight:
  - Oil Refineries
  - Nuclear Silo
  - Strategic buff/debuff structures
  - Hospitals
- Add optional tactical roles within assignments:
  - Lead
  - Defender
  - Reinforcement
  - Scout
  - Point-box collector
  - Float
- Generate a copyable briefing for Discord or alliance chat.

### Acceptance criteria

- Officers can prepare each team without switching through the master directory.
- Every selected player has a visible readiness, assignment, and roster role.
- Every empty objective is visible.
- A missing starter can be replaced from the ordered substitute list quickly.
- The generated briefing contains the correct team only.

### Dependencies

Phases 1 and 2.

---

## Phase 4 — Actionable readiness and mobile operations

**Goal:** Replace abstract readiness percentages with clear officer actions.

### Deliverables

- Retain a readiness percentage but add explicit gap warnings:
  - Missing starters
  - Missing substitutes
  - Pending availability
  - Missing check-ins
  - Unassigned players
  - Uncovered priority structures
  - Missing commander or battle time
  - Missing substitute order
- Add team-specific filters for:
  - Starters
  - Substitutes
  - Confirmed
  - Pending
  - Not available
  - Unassigned
  - Missing
- Replace wide mobile tables with player cards.
- Add accessible color and text status indicators.
- Add larger touch targets and visible keyboard focus.
- Add sticky save/sync status.
- Add per-team quick navigation.

### Acceptance criteria

- An officer can identify all unfinished preparation work without interpreting a
  formula.
- Directory, preparation, assignments, and results are usable without
  horizontal scrolling on a phone.
- Status is never conveyed by color alone.
- Keyboard navigation covers all controls.

### Dependencies

Phase 3 preparation workflow.

---

## Phase 5 — Live battle command view

**Goal:** Support officers during the actual Desert Storm match.

### Deliverables

- Create independent Team A and Team B live views.
- Add a configurable battle timer with:
  - Five-minute preparation
  - Stage 1 start
  - Center unlock at 10 minutes
  - Oil Wells at 13 minutes
  - Battle end at 30 minutes
- Add objective states:
  - Neutral
  - Friendly
  - Enemy
  - Contested
  - Reinforce
- Add live fields for:
  - Alliance score
  - Enemy score
  - Friendly points per second
  - Enemy points per second
- Add quick commands:
  - Attack
  - Defend
  - Reinforce
  - Rotate
  - Gather
  - Collect Point Supply Boxes
- Add no-show and substitute activation controls.
- Add configurable phase notifications.
- Preserve an event log of major changes and officer orders.
- Keep exact point values configurable and disabled by default unless verified
  against the live event.

### Acceptance criteria

- Team A and Team B timers and objective states never affect each other.
- Officers can update an objective in a few taps.
- The center-unlock and Oil Well phases are clearly announced.
- Live activity is retained for the post-battle debrief.
- The interface makes clear that assignments are defaults and rotations are
  expected.

### Dependencies

Phases 2–4.

---

## Phase 6 — Results, OCR, and debriefing

**Goal:** Make post-battle recording fast, correct, and reviewable.

### Deliverables

- Build separate Team A and Team B results pages.
- Add OCR match confidence.
- Allow correction of automatic matches as well as unmatched rows.
- Add staged-result removal and replacement.
- Detect duplicate screenshots and duplicate player results.
- Preserve screenshot evidence or a durable reference to it.
- Add image preprocessing:
  - Resize
  - Contrast adjustment
  - Crop guidance
- Improve matching for non-Latin roster names through aliases and
  Unicode-aware normalization.
- Reuse OCR workers to improve import speed.
- Add a debrief summary:
  - Attendance
  - Final score
  - Individual scores
  - No-shows
  - Assignment coverage
  - Strategy used
  - Officer notes
  - Live event timeline

### Acceptance criteria

- Every OCR match can be reviewed and corrected before archiving.
- Duplicate imports cannot silently overwrite results.
- Non-Latin members can be matched using stored aliases.
- Team archives preserve the complete participant snapshot.
- The debrief can be copied or exported.

### Dependencies

Phase 1 archive corrections and Phase 5 live-event data.

---

## Phase 7 — History, analytics, and selection assistance

**Goal:** Turn archived battles into useful preparation context.

### Deliverables

- Add history filters for:
  - Team
  - Date
  - Opponent
  - Outcome
  - Player
  - Map assignment
- Display archived role, unit, strategy, availability, attendance, notes, and
  source.
- Add member metrics:
  - Attendance rate
  - Confirmation reliability
  - No-show rate
  - Battles participated
  - Average individual score
  - Recent participation
  - Most common assignment
  - Performance by assignment
- Add team summaries and trends.
- Add export to CSV and a printable debrief.
- Provide selection assistance as explainable suggestions.
- Never automatically select or remove a player based on analytics.

### Acceptance criteria

- Officers can trace any archived score to its team and source.
- Historical assignments and strategies are visible.
- Metrics explain their underlying battle sample.
- Suggestions are advisory and require officer action.

### Dependencies

Reliable team-specific archives from Phases 1 and 6.

---

## Phase 8 — Persistence, synchronization, and operations

**Goal:** Make the shared application dependable for long-term use.

### Deliverables

- Move from a single JSON file to SQLite.
- Add database migrations.
- Add transaction-safe writes.
- Add revision or optimistic-concurrency checks.
- Add automatic backups and documented restore procedures.
- Add live synchronization using Server-Sent Events or WebSockets.
- Display stale-edit conflicts instead of overwriting silently.
- Add structured server logging.
- Add health and readiness endpoints.
- Add production monitoring and storage alerts.
- Document deployment, upgrade, backup, and rollback procedures.

### Acceptance criteria

- Simultaneous officer edits do not corrupt or silently replace data.
- Another officer's changes appear without manual refresh.
- Backups are created automatically and can be restored in a test.
- Database migrations preserve historical records.
- Operational failures produce actionable logs.

### Dependencies

Stable domain model from earlier phases.

---

## Suggested release milestones

### Release 1 — Correct and secure

Includes Phases 0–2.

Outcome: Team A/B records are correct, OCR imports preserve assignments, and
only approved officers can modify data.

### Release 2 — Battle-ready preparation

Includes Phases 3–4.

Outcome: Officers can prepare both task forces, resolve roster gaps, assign all
structures, activate substitutes, and publish briefings from mobile devices.

### Release 3 — Live command

Includes Phase 5.

Outcome: The app supports the 30-minute battle timeline, objective ownership,
orders, scoring status, and substitutions.

### Release 4 — Complete battle lifecycle

Includes Phases 6–7.

Outcome: Results, OCR review, debriefs, history, and selection insights form one
connected workflow.

### Release 5 — Durable shared platform

Includes Phase 8.

Outcome: SQLite persistence, live synchronization, backups, migrations, and
production operations support long-term alliance use.

## Immediate next sprint

The first implementation sprint should remain narrowly focused:

1. Add tests around current archive and OCR behavior.
2. Introduce team-specific battle records.
3. Split Team A and Team B results.
4. Merge OCR scores into full selected-member snapshots.
5. Correct attendance counters for OCR imports.
6. Migrate existing combined history safely.
7. Add strict server-side enum validation.

Do not begin the live battle timer until these data-model issues are resolved,
because later live-event and analytics features depend on accurate independent
team archives.

## Definition of done for every phase

A phase is complete only when:

- Server-side validation is implemented.
- Permissions are enforced where applicable.
- Automated tests cover the new behavior.
- Existing data has a safe migration path.
- Team A and Team B isolation is verified.
- Mobile behavior is checked for operational pages.
- Documentation and the knowledge file remain accurate.
- Backup and rollback implications are documented.
