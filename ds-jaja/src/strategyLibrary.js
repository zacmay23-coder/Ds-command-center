const GROUPS = ["Unit A", "Unit B", "Unit C", "Unit D", "Strike Team", "Scout + Support", "Reserve"];
const PHASES = ["0-5", "5-10", "10-15", "15-20", "20-25", "25-30"];

const definitions = [
  {
    id: "strategy-standard-control-rotation",
    key: "standardControlRotation",
    name: "Standard Control & Rotation",
    shortName: "Control & Rotation",
    category: "Balanced",
    difficulty: "Intermediate",
    tags: ["Balanced", "Control", "Rotation", "Default"],
    goal: "Maintain reliable control of key structures while retaining flexibility to reinforce weak areas and rotate toward scoring opportunities.",
    strengths: ["Flexible against unknown opponents", "Stable objective coverage", "Reduces uncontrolled movement"],
    risks: ["Requires timely officer communication", "Over-rotation can leave structures undefended"]
  },
  {
    id: "strategy-early-refinery-pressure",
    key: "earlyRefineryPressure",
    name: "Early Refinery Pressure",
    shortName: "Refinery Pressure",
    category: "Aggressive",
    difficulty: "Advanced",
    tags: ["Aggressive", "Refinery", "Opening Pressure", "Fast Start"],
    goal: "Gain an early scoring and positioning advantage by pressuring both refinery lanes while protecting central coverage.",
    strengths: ["Creates immediate pressure", "Disrupts enemy deployment", "Can create an early scoring lead"],
    risks: ["Can expose the center", "Requires fast attendance and clear assignments"]
  },
  {
    id: "strategy-defensive-structure-hold",
    key: "defensiveStructureHold",
    name: "Defensive Structure Hold",
    shortName: "Structure Hold",
    category: "Defensive",
    difficulty: "Beginner",
    tags: ["Defensive", "Hold", "Reinforcement", "Lower Risk"],
    goal: "Build a defensible network of high-value objectives and force the opponent to overcommit against organized defenders.",
    strengths: ["Clear responsibilities", "Works with mixed experience", "Reduces random movement"],
    risks: ["Can surrender too much map control", "Needs a mobile counterattack group"]
  },
  {
    id: "strategy-late-game-strike",
    key: "lateGameStrike",
    name: "Late-Game Strike",
    shortName: "Late Strike",
    category: "Timing",
    difficulty: "Advanced",
    tags: ["Late Game", "Timing", "Final Push", "Counterattack"],
    goal: "Maintain stable early control and execute a coordinated final rotation against selected high-impact objectives.",
    strengths: ["Can reverse a close battle", "Rewards scouting and coordination", "Creates a clear final action"],
    risks: ["A poor early score may be unrecoverable", "Requires disciplined timing and communication"]
  },
  {
    id: "strategy-aggressive-center-control",
    key: "aggressiveCenterControl",
    name: "Aggressive Center Control",
    shortName: "Center Control",
    category: "Aggressive",
    difficulty: "Advanced",
    tags: ["Generic", "Center", "Pressure"],
    goal: "Concentrate coordinated pressure on Arsenal and Nuclear Silo while maintaining one stable scoring lane.",
    strengths: ["Strong center presence", "Clear focus for strike groups"],
    risks: ["Side objectives can become exposed"],
    templateType: "Generic Strategy"
  },
  {
    id: "strategy-balanced-east-control",
    key: "balancedEastControl",
    name: "Balanced East Control",
    shortName: "East Control",
    category: "Balanced",
    difficulty: "Intermediate",
    tags: ["Generic", "East", "Balanced"],
    goal: "Establish reliable eastern-lane control before rotating coordinated groups into the center.",
    strengths: ["Stable eastern coverage", "Predictable reinforcement routes"],
    risks: ["Western objectives may receive less pressure"],
    templateType: "Generic Strategy"
  },
  {
    id: "strategy-balanced-control",
    key: "balancedControl",
    name: "Balanced Control",
    shortName: "Balanced Control",
    category: "Balanced",
    difficulty: "Intermediate",
    bestAgainst: "Even matchups",
    tags: ["Workbook", "Balanced", "Coverage", "Rotation"],
    goal: "Maintain stable control of important structures while retaining flexibility to reinforce center and protect the scoring base.",
    stageSummaries: ["Opening control: secure refineries, information structures, and nearby hospitals.", "Central contest: send strongest groups to Nuclear Silo while maintaining backup ownership.", "Endgame: protect the lead and reinforce threatened high-value structures."],
    strengths: ["Reliable default plan", "Flexible for either team", "Strong structure coverage"],
    risks: ["Can spread the roster too thin", "Requires clear rotation calls"],
    templateType: "Workbook Strategy"
  },
  {
    id: "strategy-iron-wall",
    key: "ironWall",
    name: "Iron Wall",
    shortName: "Iron Wall",
    category: "Defensive",
    difficulty: "Beginner",
    bestAgainst: "Stronger opponents",
    tags: ["Workbook", "Defensive", "Home Side", "Counterattack"],
    goal: "Build a disciplined defensive network around scoring structures, hospitals, and important lanes while punishing overextension.",
    stageSummaries: ["Defensive foundation: secure home-side structures and establish backup defenders.", "Controlled defense: defend Silo lanes selectively and punish overextension.", "Protect the result: maintain the defensive core and recover exposed structures."],
    strengths: ["Clear responsibilities", "Stable scoring", "Effective against aggressive opponents"],
    risks: ["May concede map control", "Can become too passive"],
    templateType: "Workbook Strategy"
  },
  {
    id: "strategy-silo-rush",
    key: "siloRush",
    name: "Silo Rush",
    shortName: "Silo Rush",
    category: "Aggressive",
    difficulty: "Advanced",
    bestAgainst: "Close or favorable matchups",
    tags: ["Workbook", "Nuclear Silo", "Concentration", "High THP"],
    goal: "Prepare quickly during the opening and concentrate the strongest groups on Nuclear Silo as it becomes the central priority.",
    stageSummaries: ["Mobility setup: secure routes and position frontline groups.", "Silo concentration: commit defined frontline and support groups to center.", "Convert control: hold Silo or exploit structures exposed by the enemy concentration."],
    strengths: ["High scoring potential", "Clear central objective", "Strong with dependable attendance"],
    risks: ["Can overcommit to center", "Opening structures may become exposed"],
    templateType: "Workbook Strategy"
  },
  {
    id: "strategy-split-pressure",
    key: "splitPressure",
    name: "Split Pressure",
    shortName: "Split Pressure",
    category: "Multi-lane aggressive",
    difficulty: "Advanced",
    bestAgainst: "Slow or disorganized opponents",
    tags: ["Workbook", "Multi-lane", "Mobility", "Pressure"],
    goal: "Divide pressure across multiple areas so the opponent cannot defend every refinery, central structure, and support asset.",
    stageSummaries: ["Distributed opening: establish west, center, and east responsibilities.", "Dual pressure: contest Silo while the strike team attacks exposed assets.", "Mobility exploitation: steal abandoned structures and collapse only on officer call."],
    strengths: ["Creates whole-map pressure", "Punishes slow rotations", "Enables scouts and strike teams"],
    risks: ["Groups may become too weak individually", "Requires excellent communication"],
    templateType: "Workbook Strategy"
  },
  {
    id: "strategy-counterpunch",
    key: "counterpunch",
    name: "Counterpunch",
    shortName: "Counterpunch",
    category: "Reactive",
    difficulty: "Advanced",
    bestAgainst: "Aggressive opponents",
    tags: ["Workbook", "Reactive", "Scouting", "Counterattack"],
    goal: "Hold secure positions, observe the enemy opening, and attack the structures abandoned after a heavy commitment.",
    stageSummaries: ["Observe and hold: secure safe scoring structures and identify the main enemy push.", "Collapse on overextension: reinforce only as needed and attack exposed flanks.", "Exploit abandoned assets: take open structures while preserving must-hold defenders."],
    strengths: ["Punishes predictable aggression", "Rewards scouting", "Avoids unnecessary opening losses"],
    risks: ["Requires accurate scouting", "A slow response can miss the counterattack window"],
    templateType: "Workbook Strategy"
  }
];

const routeSets = {
  standardControlRotation: {
    A: {
      "Unit A": ["Oil Refinery 1", "Oil Refinery 1", "Arsenal", "Arsenal", "Nuclear Silo", "Nuclear Silo"],
      "Unit B": ["Info Center", "Info Center", "Nuclear Silo", "Nuclear Silo", "Arsenal", "Arsenal"],
      "Unit C": ["Field Hospital 1", "Mercenary Factory", "Mercenary Factory", "Field Hospital 3", "Mercenary Factory", "Mercenary Factory"],
      "Unit D": ["Science Hub", "Science Hub", "Oil Refinery 2", "Oil Refinery 2", "Science Hub", "Oil Refinery 2"],
      "Strike Team": ["Arsenal", "Arsenal", "Nuclear Silo", "Nuclear Silo", "Arsenal", "Nuclear Silo"],
      "Scout + Support": ["Info Center", "Info Center", "Info Center", "Arsenal", "Info Center", "Arsenal"],
      "Reserve": ["", "Oil Refinery 1", "", "Field Hospital 1", "", ""]
    },
    B: {
      "Unit A": ["Oil Refinery 2", "Oil Refinery 2", "Arsenal", "Arsenal", "Nuclear Silo", "Nuclear Silo"],
      "Unit B": ["Science Hub", "Science Hub", "Nuclear Silo", "Nuclear Silo", "Arsenal", "Arsenal"],
      "Unit C": ["Field Hospital 2", "Mercenary Factory", "Mercenary Factory", "Field Hospital 4", "Mercenary Factory", "Mercenary Factory"],
      "Unit D": ["Info Center", "Info Center", "Oil Refinery 1", "Oil Refinery 1", "Info Center", "Oil Refinery 1"],
      "Strike Team": ["Arsenal", "Arsenal", "Nuclear Silo", "Nuclear Silo", "Arsenal", "Nuclear Silo"],
      "Scout + Support": ["Science Hub", "Science Hub", "Info Center", "Arsenal", "Science Hub", "Arsenal"],
      "Reserve": ["", "Oil Refinery 2", "", "Field Hospital 2", "", ""]
    }
  },
  earlyRefineryPressure: {
    A: {
      "Unit A": ["Oil Refinery 1", "Oil Refinery 1", "Oil Refinery 1", "Field Hospital 1", "Oil Refinery 1", "Oil Refinery 1"],
      "Unit B": ["Oil Refinery 2", "Oil Refinery 2", "Oil Refinery 2", "Field Hospital 2", "Oil Refinery 2", "Oil Refinery 2"],
      "Unit C": ["Info Center", "Info Center", "Arsenal", "Arsenal", "Nuclear Silo", "Nuclear Silo"],
      "Unit D": ["Field Hospital 1", "Field Hospital 2", "Mercenary Factory", "Science Hub", "Mercenary Factory", "Arsenal"],
      "Strike Team": ["Oil Refinery 1", "Oil Refinery 2", "Nuclear Silo", "Nuclear Silo", "Arsenal", "Nuclear Silo"],
      "Scout + Support": ["Info Center", "Info Center", "Science Hub", "Info Center", "Info Center", "Arsenal"],
      "Reserve": ["", "Field Hospital 1", "", "Oil Refinery 1", "", ""]
    }
  },
  defensiveStructureHold: {
    A: {
      "Unit A": ["Info Center", "Info Center", "Info Center", "Info Center", "Arsenal", "Arsenal"],
      "Unit B": ["Arsenal", "Arsenal", "Nuclear Silo", "Nuclear Silo", "Nuclear Silo", "Nuclear Silo"],
      "Unit C": ["Oil Refinery 1", "Oil Refinery 1", "Oil Refinery 1", "Field Hospital 1", "Oil Refinery 1", "Oil Refinery 1"],
      "Unit D": ["Field Hospital 1", "Field Hospital 1", "Mercenary Factory", "Mercenary Factory", "Field Hospital 1", "Arsenal"],
      "Strike Team": ["Arsenal", "Nuclear Silo", "Nuclear Silo", "Arsenal", "Nuclear Silo", "Nuclear Silo"],
      "Scout + Support": ["Info Center", "Info Center", "Info Center", "Info Center", "Arsenal", "Arsenal"],
      "Reserve": ["Field Hospital 1", "", "Oil Refinery 1", "", "Nuclear Silo", "Nuclear Silo"]
    }
  },
  lateGameStrike: {
    A: {
      "Unit A": ["Info Center", "Info Center", "Arsenal", "Arsenal", "Arsenal", "Nuclear Silo"],
      "Unit B": ["Oil Refinery 1", "Oil Refinery 1", "Oil Refinery 1", "Oil Refinery 1", "Arsenal", "Nuclear Silo"],
      "Unit C": ["Field Hospital 1", "Mercenary Factory", "Mercenary Factory", "Mercenary Factory", "Nuclear Silo", "Arsenal"],
      "Unit D": ["Science Hub", "Science Hub", "Oil Refinery 2", "Oil Refinery 2", "Oil Refinery 2", "Oil Refinery 2"],
      "Strike Team": ["Arsenal", "Arsenal", "Arsenal", "Nuclear Silo", "Nuclear Silo", "Nuclear Silo"],
      "Scout + Support": ["Info Center", "Info Center", "Info Center", "Info Center", "Arsenal", "Arsenal"],
      "Reserve": ["", "", "Field Hospital 1", "", "", "Nuclear Silo"]
    }
  }
};

routeSets.aggressiveCenterControl = {
  A: structuredClone(routeSets.standardControlRotation.A),
  B: structuredClone(routeSets.standardControlRotation.B)
};
routeSets.balancedEastControl = {
  A: structuredClone(routeSets.standardControlRotation.B),
  B: structuredClone(routeSets.standardControlRotation.B)
};
routeSets.balancedControl = {
  A: structuredClone(routeSets.standardControlRotation.A),
  B: structuredClone(routeSets.standardControlRotation.B)
};
routeSets.ironWall = {
  A: structuredClone(routeSets.defensiveStructureHold.A),
  B: mirroredRoutes(routeSets.defensiveStructureHold.A)
};
routeSets.siloRush = {
  A: {
    "Unit A": ["Oil Refinery 1", "Arsenal", "Nuclear Silo", "Nuclear Silo", "Nuclear Silo", "Nuclear Silo"],
    "Unit B": ["Info Center", "Arsenal", "Nuclear Silo", "Nuclear Silo", "Arsenal", "Arsenal"],
    "Unit C": ["Field Hospital 1", "Mercenary Factory", "Mercenary Factory", "Mercenary Factory", "Oil Refinery 2", "Oil Refinery 2"],
    "Unit D": ["Science Hub", "Science Hub", "Oil Refinery 2", "Oil Refinery 2", "Science Hub", "Science Hub"],
    "Strike Team": ["Arsenal", "Arsenal", "Nuclear Silo", "Nuclear Silo", "Nuclear Silo", "Nuclear Silo"],
    "Scout + Support": ["Info Center", "Info Center", "Nuclear Silo", "Info Center", "Arsenal", "Arsenal"],
    "Reserve": ["", "Arsenal", "Nuclear Silo", "", "Oil Refinery 1", ""]
  }
};
routeSets.splitPressure = {
  A: {
    "Unit A": ["Oil Refinery 1", "Oil Refinery 1", "Oil Refinery 1", "Field Hospital 1", "Oil Refinery 1", "Oil Refinery 1"],
    "Unit B": ["Oil Refinery 2", "Oil Refinery 2", "Oil Refinery 2", "Field Hospital 2", "Oil Refinery 2", "Oil Refinery 2"],
    "Unit C": ["Info Center", "Info Center", "Nuclear Silo", "Nuclear Silo", "Arsenal", "Arsenal"],
    "Unit D": ["Science Hub", "Science Hub", "Mercenary Factory", "Mercenary Factory", "Science Hub", "Field Hospital 4"],
    "Strike Team": ["Arsenal", "Field Hospital 4", "Arsenal", "Field Hospital 3", "Nuclear Silo", "Nuclear Silo"],
    "Scout + Support": ["Info Center", "Science Hub", "Info Center", "Science Hub", "Info Center", "Arsenal"],
    "Reserve": ["", "Field Hospital 1", "", "Oil Refinery 2", "", ""]
  }
};
routeSets.counterpunch = {
  A: {
    "Unit A": ["Oil Refinery 1", "Oil Refinery 1", "Oil Refinery 1", "Arsenal", "Arsenal", "Nuclear Silo"],
    "Unit B": ["Info Center", "Info Center", "Info Center", "Nuclear Silo", "Nuclear Silo", "Nuclear Silo"],
    "Unit C": ["Field Hospital 1", "Field Hospital 1", "Mercenary Factory", "Mercenary Factory", "Oil Refinery 2", "Oil Refinery 2"],
    "Unit D": ["Science Hub", "Science Hub", "Science Hub", "Field Hospital 4", "Field Hospital 4", "Arsenal"],
    "Strike Team": ["Arsenal", "Arsenal", "Arsenal", "Nuclear Silo", "Oil Refinery 2", "Nuclear Silo"],
    "Scout + Support": ["Info Center", "Info Center", "Info Center", "Science Hub", "Science Hub", "Arsenal"],
    "Reserve": ["", "", "Oil Refinery 1", "", "Field Hospital 2", ""]
  }
};

function mirroredRoutes(routes) {
  const swap = {
    "Oil Refinery 1": "Oil Refinery 2",
    "Oil Refinery 2": "Oil Refinery 1",
    "Field Hospital 1": "Field Hospital 2",
    "Field Hospital 2": "Field Hospital 1",
    "Field Hospital 3": "Field Hospital 4",
    "Field Hospital 4": "Field Hospital 3",
    "Info Center": "Science Hub",
    "Science Hub": "Info Center"
  };
  return Object.fromEntries(Object.entries(routes).map(([group, values]) => [
    group,
    values.map((value) => swap[value] || value)
  ]));
}

const secondaryObjectives = {
  "Oil Refinery 1": ["Field Hospital 1", "Info Center"],
  "Oil Refinery 2": ["Field Hospital 2", "Science Hub"],
  "Field Hospital 1": ["Oil Refinery 1", "Field Hospital 3"],
  "Field Hospital 2": ["Oil Refinery 2", "Field Hospital 4"],
  "Field Hospital 3": ["Mercenary Factory", "Field Hospital 1"],
  "Field Hospital 4": ["Arsenal", "Field Hospital 2"],
  "Info Center": ["Arsenal", "Oil Refinery 1"],
  "Science Hub": ["Mercenary Factory", "Oil Refinery 2"],
  "Arsenal": ["Nuclear Silo", "Info Center"],
  "Nuclear Silo": ["Arsenal", "Mercenary Factory"],
  "Mercenary Factory": ["Nuclear Silo", "Science Hub"]
};

function secondaryObjectiveFor(routes, group, phaseIndex, objective, team) {
  const nextObjective = routes[group]?.[phaseIndex + 1];
  if (nextObjective && nextObjective !== objective) return nextObjective;

  const candidates = secondaryObjectives[objective] || [];
  const teamOrderedCandidates = team === "B" ? candidates.slice().reverse() : candidates;
  return teamOrderedCandidates.find((candidate) => candidate !== objective)
    || (team === "B" ? "Oil Refinery 2" : "Oil Refinery 1");
}

function simpleActionFor(routes, group, phaseIndex, objective) {
  if (group === "Reserve") return "Reinforce";
  if (group === "Scout + Support") return "Scout";
  if (group === "Strike Team") return phaseIndex < 2 ? "Pressure" : "Attack";
  if (phaseIndex === 0) return "Secure";
  return routes[group]?.[phaseIndex - 1] === objective ? "Hold" : "Rotate";
}

function simplePriorityFor(group, phaseIndex) {
  if (group === "Strike Team") return "Critical";
  if (group === "Reserve") return "Standby";
  if (group === "Scout + Support") return "Medium";
  return phaseIndex >= 2 ? "High" : "Medium";
}

function createPhases(routes, team) {

  return Object.fromEntries(PHASES.map((phase, phaseIndex) => [
    phase,
    Object.fromEntries(GROUPS.map((group) => {
      const objective = routes[group]?.[phaseIndex]
        || (team === "B" ? "Field Hospital 2" : "Field Hospital 1");
      const secondaryObjective = secondaryObjectiveFor(routes, group, phaseIndex, objective, team);
      const action = simpleActionFor(routes, group, phaseIndex, objective);
      return [group, {
        objective,
        secondaryObjective,
        action,
        priority: simplePriorityFor(group, phaseIndex),
        instruction: `${action}: ${objective}. Shift to ${secondaryObjective} on officer call.`
      }];
    }))
  ]));
}

export function createStarterStrategies(now = new Date().toISOString()) {
  return definitions.map((definition) => {
    const teamARoutes = routeSets[definition.key].A;
    const teamBRoutes = routeSets[definition.key].B || mirroredRoutes(teamARoutes);
    return {
      id: definition.id,
      name: definition.name,
      shortName: definition.shortName,
      category: definition.category,
      status: "Active",
      recommendedTeams: ["A", "B"],
      difficulty: definition.difficulty,
      bestAgainst: definition.bestAgainst || "",
      tags: definition.tags,
      goal: definition.goal,
      strengths: definition.strengths,
      risks: definition.risks,
      stageSummaries: definition.stageSummaries || [],
      isStarterTemplate: true,
      templateType: definition.templateType || "Original Strategy",
      systemTemplateKey: definition.key,
      version: 1,
      archived: false,
      createdAt: now,
      updatedAt: now,
      teamPlans: {
        A: { phases: createPhases(teamARoutes, "A") },
        B: { phases: createPhases(teamBRoutes, "B") }
      }
    };
  });
}

export function reapplyStarterStrategies(library = [], now = new Date().toISOString()) {
  const nextLibrary = Array.isArray(library) ? structuredClone(library) : [];
  const starters = createStarterStrategies(now);

  for (const starter of starters) {
    const existingIndex = nextLibrary.findIndex((strategy) =>
      strategy.id === starter.id
      || strategy.systemTemplateKey === starter.systemTemplateKey
      || (
        strategy.isStarterTemplate
        && String(strategy.name).trim().toLowerCase() === starter.name.toLowerCase()
      )
    );

    if (existingIndex === -1) {
      nextLibrary.push(starter);
      continue;
    }

    const existing = nextLibrary[existingIndex];
    const canonicalFields = Object.keys(starter).filter((key) =>
      !["createdAt", "updatedAt", "version"].includes(key)
    );
    const needsRefresh = canonicalFields.some((key) =>
      JSON.stringify(existing[key]) !== JSON.stringify(starter[key])
    );

    if (!needsRefresh) continue;

    nextLibrary[existingIndex] = {
      ...existing,
      ...starter,
      createdAt: existing.createdAt || starter.createdAt,
      updatedAt: now,
      version: Math.max(1, Number(existing.version || 0) + 1)
    };
  }

  return nextLibrary;
}

export function strategyIdForLegacyName(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  return {
    "standard control & rotation": "strategy-standard-control-rotation",
    "early refinery pressure": "strategy-early-refinery-pressure",
    "defensive structure hold": "strategy-defensive-structure-hold",
    "late-game strike": "strategy-late-game-strike",
    "late game strike": "strategy-late-game-strike"
  }[normalized] || "";
}
