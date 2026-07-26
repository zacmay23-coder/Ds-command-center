# Desert Storm Command Center — Project Knowledge

Last researched: 2026-07-26

## Purpose of this file

This is durable context for future work on the Desert Storm Command Center. It
summarizes the Last War: Survival event, defines project terminology, records
the supplied battle map, and explains what the software is intended to help
alliance officers accomplish.

Use this file before changing roster, assignment, availability, battle-plan,
results, screenshot-import, history, or strategy features.

## Source and certainty policy

Last War changes event rules over time. Use this priority order:

1. Current in-game event rules and screens
2. Screenshots and explicit instructions supplied by this project's user
3. Current official Last War support documentation
4. Recently maintained community guides
5. Older guides only as historical context

Do not hard-code a point value, reward threshold, schedule, or matchmaking rule
without marking it patch-sensitive. When sources conflict, preserve the
project's current data and ask for an in-game screenshot if the difference
would affect behavior.

The official game site is <https://www.lastwar.com/>. The public site provides
the game client and general game information, but it does not expose a detailed
Desert Storm rules page in its public text.

## Event overview

Desert Storm Battlefield is a scheduled alliance-versus-alliance event in a
dedicated battlefield.

- The battle lasts approximately 30 minutes.
- The winner is the alliance with the most Battlefield Points when time expires.
- Players also earn Individual Points for personal reward tiers.
- Troops used in the battlefield are restored rather than permanently lost.
- The alliance can field Task Force A and Task Force B as separate teams.
- Each task force supports 20 starters and 10 substitutes.
- With both task forces, an alliance can register up to 60 members.
- A five-minute preparation period allows starters to enter the safe zone.
- Substitutes can enter after the battle starts when a participant slot is open.
- The player's alliance is represented as blue and the opponent as red.

The project's labels **Team A** and **Team B** mean the game's **Task Force A**
and **Task Force B**. They fight separate matches, so assignments, results,
strategies, readiness, and histories must remain team-specific.

## How points are earned

### Battlefield Points

Battlefield Points determine the winning alliance. They come primarily from:

- Capturing and holding buildings
- Collecting Point Supply Boxes after eligible building ownership changes
- Gathering from Oil Wells late in the battle

Holding objectives is more important than attacking without occupying them.
The scoreboard can show each alliance's total points and current points-per-
second rate.

### Individual Points

Individual Points determine each participant's personal reward tier. They come
from:

- Capturing and holding buildings
- Killing hostile units while attacking or defending

The application should distinguish alliance outcome from individual
performance. A team can win while some participants fail to reach an individual
reward threshold, and the reverse is also possible.

### Plunderable points

Community documentation describes this mechanic as follows:

- During the first 60 seconds after capture, building output is non-plunderable.
- After 60 seconds, part of the building's output accumulates as plunderable
  points.
- If the enemy captures that building, accumulated plunderable points scatter
  nearby as Point Supply Boxes.
- Those points are deducted from the former owner's score and awarded to the
  alliance that collects the boxes.

The commonly documented split is 60% non-plunderable and 40% plunderable after
the first minute. Treat this ratio as patch-sensitive and verify it in-game
before building calculations around it.

## Battle stages

### Preparation — five minutes before the battle

- Starters enter the battlefield.
- Players begin in a protected safe zone.
- Officers confirm attendance, positioning, assignments, and communications.
- Late arrivals create an immediate disadvantage because early objectives open
  together.

### Stage 1 — battle start

The eight perimeter structures are available immediately:

- Oil Refinery 1
- Oil Refinery 2
- Field Hospital 1
- Field Hospital 2
- Field Hospital 3
- Field Hospital 4
- Info Center
- Science Hub

Opening priorities are usually the Oil Refineries plus the strategic buildings
that improve mobility, scoring, or healing.

### Stage 2 — 10 minutes

The three protected central structures unlock:

- Arsenal
- Nuclear Silo
- Mercenary Factory

The Nuclear Silo is normally the highest-output building. The Arsenal and
Mercenary Factory create a large combat-stat swing, so central control is about
both points and battlefield strength.

### Stage 3 — 13 minutes

Oil Wells appear and can be gathered for additional points. They are generally
lower priority than defending or recapturing high-value buildings, but they can
help players who need Individual Points or teams in specific score situations.

### End — 30 minutes

The alliance with the higher Battlefield Point total wins.

## Canonical project map

The map supplied by the project owner is the canonical assignment map for this
application:

```text
                         NORTH

            Info Center      Arsenal      Field Hospital 4

 Oil Refinery 1                                      Field Hospital 2

                         Nuclear Silo

 Field Hospital 1                                   Oil Refinery 2

            Field Hospital 3  Mercenary Factory     Science Hub

 Blue deployment                                    Red deployment
                         SOUTH
```

The app must use these exact unit names:

1. Oil Refinery 1
2. Oil Refinery 2
3. Field Hospital 1
4. Field Hospital 2
5. Field Hospital 3
6. Field Hospital 4
7. Info Center
8. Arsenal
9. Nuclear Silo
10. Mercenary Factory
11. Science Hub

`Unassigned` is a workflow state, not a map structure.

Older generic labels such as `A`, `B`, `C`, `D`, `Strike Team`,
`Disrupters`, `Scout + Support`, and `Reserve / Relief` are legacy values and
must not be presented as current map units. Existing legacy values should be
shown as unassigned until an officer deliberately chooses a current structure.

## Building roles

Exact point yields can change. The functional roles below are the durable part
of the model.

| Structure | Availability | Durable role |
| --- | --- | --- |
| Oil Refinery 1 and 2 | Battle start | Highest-value perimeter scoring structures |
| Field Hospitals 1–4 | Battle start | Points plus troop recovery; each held hospital restores troops over time |
| Info Center | Battle start | Increases the point output of captured buildings in commonly documented rules |
| Science Hub | Battle start | Reduces free-teleport cooldown, improving reinforcement speed |
| Nuclear Silo | 10 minutes | Highest-value central scoring structure |
| Arsenal | 10 minutes | Buffs friendly hero Attack, Defense, and HP |
| Mercenary Factory | 10 minutes | Reduces enemy hero Attack, Defense, and HP |
| Oil Wells | 13 minutes | Late gathering targets; not permanent assignment units |

Commonly documented combat modifiers are +15% for the Arsenal and -15% for the
Mercenary Factory. The Science Hub is commonly documented as reducing free
teleport cooldown from two minutes to one. Verify these values against the live
event before using them in calculations or UI promises.

## Project goals

The Desert Storm Command Center exists to give alliance officers one shared,
readable source of truth before, during, and after battle.

### Before battle

- Maintain the alliance member directory.
- Select Task Force/Team A and Task Force/Team B independently.
- Enforce 20-starter and 10-substitute limits for each team.
- Record player availability.
- Assign every selected player to one canonical map structure.
- Show readiness gaps: missing participants, confirmations, substitutes, or
  unit assignments.
- Publish a clear team-specific briefing and strategy.

### During battle

- Give each team a concise assignment board.
- Keep Team A and Team B information separate.
- Make structure names and responsibilities easy to scan on mobile.
- Support officers in identifying no-shows and activating substitutes.
- Preserve the distinction between starting assignment and live tactical
  rotation; an assignment is the default responsibility, not a ban on moving.

### After battle

- Record opponent, outcome, scores, attendance, and notes.
- Import ranking screenshots with OCR.
- Match OCR names to roster members and learn aliases from manual corrections.
- Archive results without silently changing the weekly roster.
- Preserve team, role, map assignment, availability, attendance, and score in
  battle history.
- Use historical attendance and performance to improve future selections.

## Domain model

### Member

A persistent alliance member with name, rank, OCR aliases, participation
counters, and historical results.

### Weekly selection

Mutable preparation data for the next battle:

- `selected`
- `team`: `A`, `B`, or `Reserve`
- `type`: `Starter` or `Sub`
- `unit`: canonical structure or `Unassigned`
- `availability`: `Pending`, `Confirmed`, or `Not available`

### Team

Team A and Team B are independent task forces. Each has its own:

- Roster capacity
- Strategy
- Readiness
- Assignment page
- Match result
- Individual participant results

Do not merge the two teams into a single assignment board or assume they share
one battlefield.

### Battle archive

An immutable historical snapshot containing the opponent, date, outcome, team,
player role, assignment, attendance, score, notes, and whether a result came
from manual entry or screenshot import.

### Readiness

Readiness is a project planning score, not an in-game statistic. It should
communicate operational completeness rather than predict victory. Current
inputs include roster fill, starter/substitute coverage, confirmations, and
valid map assignments.

## Product principles for future changes

- Prefer the exact in-game vocabulary.
- Keep Team A and Team B workflows separate.
- Optimize operational pages for phones and rapid scanning.
- Make officer-editable facts explicit; do not infer availability or assignment.
- Preserve history when resetting weekly preparation data.
- Do not let screenshot imports alter roster selection or assignments.
- Treat OCR matches as suggestions unless confidence is sufficient.
- Validate team capacity on the server, not only in the browser.
- Keep a human correction path for names, scores, and assignments.
- Mark tactics as guidance, not fixed game rules.
- Never promise that documented point values or schedules are permanent.

## Useful tactical implications for the product

These are informed strategy implications, not guaranteed rules:

- Attendance and punctuality deserve prominent status because all perimeter
  buildings open simultaneously.
- Oil Refineries should be easy to identify as priority Stage 1 objectives.
- A countdown or phase indicator should emphasize the center unlock at 10:00.
- Science Hub ownership affects rotation speed and can influence response plans.
- Hospitals affect sustain and should not be treated as low-value merely because
  they score less than the Silo.
- Nuclear Silo ownership alone does not replace perimeter control.
- Point Supply Box collection can justify assigning mobile scouts or floaters.
- Late Oil Well gathering should not pull essential defenders away
  automatically.
- Substitute activation should be fast and should not overwrite archived data.

## Known uncertainties

Verify these in the live event before implementing exact rules:

- Current registration days and available battle time slots
- Eligibility requirements and matchmaking formula
- Current reward tiers and minimum Individual Points
- Exact point output for every structure
- Exact plunderable/non-plunderable split
- Buff percentages and healing rate
- Whether seasonal variants alter building types or positions
- Whether Task Force A and B rewards differ in the current season

## Research sources

- Official Last War website: <https://www.lastwar.com/>
- Official support article (may require sign-in):
  <https://firstfungroup.zendesk.com/hc/en-us/articles/44310431770771-Desert-Storm-Battlefield-Guide>
- Last War Tutorial, detailed Desert Storm mechanics:
  <https://www.lastwartutorial.com/desert-storm/>
- Virgo Vixen Last War Operations, mechanics reviewed June 2026:
  <https://www.virgovixen.info/war-room/desert-storm/>
- Last War community guide:
  <https://www.lastwargame.online/en/desert-storm-battlefield/>

These third-party sources are useful but are not authoritative over the live
game interface.
