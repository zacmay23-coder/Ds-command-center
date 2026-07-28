export const tacticalGroups = [
  "Unit A",
  "Unit B",
  "Unit C",
  "Unit D",
  "Strike Team",
  "Scout + Support",
  "Reserve"
];

export const battlePhases = ["0-5", "5-10", "10-15", "15-20", "20-25", "25-30"];

export const objectivePositions = {
  "Info Center": [29, 12],
  "Field Hospital 4": [67, 11],
  "Arsenal": [49, 27],
  "Oil Refinery 1": [13, 29],
  "Field Hospital 2": [83, 34],
  "Nuclear Silo": [50, 49],
  "Field Hospital 1": [13, 60],
  "Oil Refinery 2": [83, 62],
  "Mercenary Factory": [48, 77],
  "Field Hospital 3": [28, 89],
  "Science Hub": [69, 89]
};

const assignment = (objective, action, priority, instruction, secondaryObjective = "") => ({
  objective,
  secondaryObjective,
  action,
  priority,
  instruction
});

export const strategyPlans = {
  A: {
    name: "Aggressive Center Control",
    phases: {
      "0-5": {
        "Unit A": assignment("Oil Refinery 1", "Capture and hold", "Critical", "Secure the western refinery and establish the opening anchor."),
        "Unit B": assignment("Info Center", "Capture", "High", "Take the information structure and report center movement."),
        "Unit C": assignment("Field Hospital 1", "Capture and defend", "Medium", "Secure the western hospital and protect the approach."),
        "Unit D": assignment("Science Hub", "Pressure", "Secondary", "Apply pressure if the eastern route is open."),
        "Strike Team": assignment("Arsenal", "Rapid reinforcement", "Conditional", "Reinforce the most contested opening objective."),
        "Scout + Support": assignment("Nuclear Silo", "Scout routes", "Support", "Monitor center rotations without committing early."),
        "Reserve": assignment("", "Standby", "Standby", "Replace missing players or reinforce the priority target.")
      },
      "5-10": {
        "Unit A": assignment("Arsenal", "Rotate and contest", "High", "Leave a holder at the refinery and rotate into Arsenal."),
        "Unit B": assignment("Info Center", "Hold", "High", "Maintain vision and deny the northwest route."),
        "Unit C": assignment("Mercenary Factory", "Pressure", "Medium", "Advance through the southern center lane."),
        "Unit D": assignment("Science Hub", "Hold", "Medium", "Maintain the eastern rotation point."),
        "Strike Team": assignment("Arsenal", "Attack", "Critical", "Join Unit A and force center control."),
        "Scout + Support": assignment("Nuclear Silo", "Scout and screen", "Support", "Track enemy movement before the center unlock."),
        "Reserve": assignment("Oil Refinery 1", "Backfill", "Standby", "Cover the refinery if Unit A fully rotates.")
      },
      "10-15": {
        "Unit A": assignment("Arsenal", "Attack", "Primary", "Contest Arsenal and hold the northern center lane."),
        "Unit B": assignment("Nuclear Silo", "Capture", "Critical", "Move at center unlock and establish control."),
        "Unit C": assignment("Mercenary Factory", "Contest", "High", "Deny the southern rotation route."),
        "Unit D": assignment("Oil Refinery 1", "Hold", "High", "Protect the western scoring anchor."),
        "Strike Team": assignment("Nuclear Silo", "Capture support", "Critical", "Combine with Unit B for the center unlock."),
        "Scout + Support": assignment("Info Center", "Reinforce", "Secondary", "Hold vision and prepare a Silo rotation."),
        "Reserve": assignment("", "Flexible reinforcement", "Standby", "Stand by for Nuclear Silo or Oil Refinery 1.")
      },
      "15-20": {
        "Unit A": assignment("Arsenal", "Hold", "High", "Fortify Arsenal and intercept northern rotations."),
        "Unit B": assignment("Nuclear Silo", "Defend", "Critical", "Maintain center control through the scoring window."),
        "Unit C": assignment("Mercenary Factory", "Hold", "Medium", "Keep the southern center lane open."),
        "Unit D": assignment("Oil Refinery 1", "Defend", "High", "Preserve the western point advantage."),
        "Strike Team": assignment("Nuclear Silo", "Counterattack", "Critical", "Respond immediately to pressure on the Silo."),
        "Scout + Support": assignment("Info Center", "Watch rotations", "Support", "Report enemy massing and reinforce center."),
        "Reserve": assignment("Field Hospital 1", "Cover", "Standby", "Protect the west if the refinery group rotates.")
      },
      "20-25": {
        "Unit A": assignment("Nuclear Silo", "Reinforce", "Critical", "Collapse from Arsenal when center pressure rises."),
        "Unit B": assignment("Nuclear Silo", "Hold", "Critical", "Remain the primary Silo defense."),
        "Unit C": assignment("Arsenal", "Support", "High", "Rotate north and protect the center flank."),
        "Unit D": assignment("Oil Refinery 1", "Hold", "High", "Do not abandon the stable scoring objective."),
        "Strike Team": assignment("Arsenal", "Rapid attack", "High", "Clear Arsenal then return to Silo."),
        "Scout + Support": assignment("Info Center", "Reinforce", "Secondary", "Maintain information control and flexible support."),
        "Reserve": assignment("", "Replace losses", "Standby", "Fill the highest-priority center opening.")
      },
      "25-30": {
        "Unit A": assignment("Nuclear Silo", "Final defense", "Critical", "Hold the highest-value center objective."),
        "Unit B": assignment("Nuclear Silo", "Final defense", "Critical", "Remain committed through battle end."),
        "Unit C": assignment("Arsenal", "Defend", "High", "Secure the second center objective."),
        "Unit D": assignment("Oil Refinery 1", "Defend", "High", "Preserve western scoring until time expires."),
        "Strike Team": assignment("Nuclear Silo", "Counterattack", "Critical", "Break any final enemy center push."),
        "Scout + Support": assignment("Arsenal", "Support", "Secondary", "Cover rotations between Arsenal and Silo."),
        "Reserve": assignment("", "Emergency reinforcement", "Standby", "Deploy only to the highest-priority threatened objective.")
      }
    }
  },
  B: {
    name: "Balanced East Control",
    phases: {
      "0-5": {
        "Unit A": assignment("Oil Refinery 2", "Capture and hold", "Critical", "Secure the eastern refinery as the opening anchor."),
        "Unit B": assignment("Science Hub", "Capture", "High", "Take the southeast rotation point."),
        "Unit C": assignment("Field Hospital 2", "Capture and defend", "Medium", "Secure the inner eastern hospital."),
        "Unit D": assignment("Field Hospital 4", "Capture", "Medium", "Control the outer northeast approach."),
        "Strike Team": assignment("Arsenal", "Eastern pressure", "Conditional", "Pressure center from the east and reinforce contests."),
        "Scout + Support": assignment("Nuclear Silo", "Rotation support", "Support", "Monitor center and eastern approach routes."),
        "Reserve": assignment("", "Standby", "Standby", "Replace missing players or reinforce the priority target.")
      },
      "5-10": {
        "Unit A": assignment("Oil Refinery 2", "Hold", "Critical", "Maintain the primary eastern scoring anchor."),
        "Unit B": assignment("Mercenary Factory", "Rotate and pressure", "High", "Move from Science Hub into southern center."),
        "Unit C": assignment("Field Hospital 2", "Hold", "Medium", "Protect the inside eastern lane."),
        "Unit D": assignment("Arsenal", "Rotate", "High", "Move from the outer hospital toward Arsenal."),
        "Strike Team": assignment("Arsenal", "Attack", "Critical", "Establish pressure before center unlock."),
        "Scout + Support": assignment("Science Hub", "Watch rotations", "Support", "Cover the eastern rear and report movement."),
        "Reserve": assignment("Field Hospital 4", "Backfill", "Standby", "Protect the outer route during Unit D's rotation.")
      },
      "10-15": {
        "Unit A": assignment("Oil Refinery 2", "Hold", "High", "Preserve the eastern anchor."),
        "Unit B": assignment("Nuclear Silo", "Capture", "Critical", "Rotate from the south at center unlock."),
        "Unit C": assignment("Mercenary Factory", "Contest", "High", "Pressure the southern center route."),
        "Unit D": assignment("Arsenal", "Attack", "Primary", "Control the northern center flank."),
        "Strike Team": assignment("Nuclear Silo", "Capture support", "Critical", "Combine with Unit B for center control."),
        "Scout + Support": assignment("Science Hub", "Reinforce", "Secondary", "Keep the east secure and prepare to rotate."),
        "Reserve": assignment("", "Flexible reinforcement", "Standby", "Stand by for Nuclear Silo or Oil Refinery 2.")
      },
      "15-20": {
        "Unit A": assignment("Oil Refinery 2", "Defend", "High", "Maintain uninterrupted eastern scoring."),
        "Unit B": assignment("Nuclear Silo", "Defend", "Critical", "Hold center through the scoring window."),
        "Unit C": assignment("Mercenary Factory", "Hold", "Medium", "Keep the south lane controlled."),
        "Unit D": assignment("Arsenal", "Hold", "High", "Protect the northern center approach."),
        "Strike Team": assignment("Nuclear Silo", "Counterattack", "Critical", "Answer any concentrated Silo push."),
        "Scout + Support": assignment("Science Hub", "Watch rotations", "Support", "Maintain eastern awareness and support."),
        "Reserve": assignment("Field Hospital 2", "Cover", "Standby", "Backfill the inside eastern route.")
      },
      "20-25": {
        "Unit A": assignment("Oil Refinery 2", "Hold", "High", "Preserve the stable scoring objective."),
        "Unit B": assignment("Nuclear Silo", "Hold", "Critical", "Remain the primary center defense."),
        "Unit C": assignment("Arsenal", "Rotate and support", "High", "Move north to strengthen center control."),
        "Unit D": assignment("Arsenal", "Defend", "High", "Maintain the northern flank."),
        "Strike Team": assignment("Nuclear Silo", "Rapid reinforcement", "Critical", "Move wherever center pressure peaks."),
        "Scout + Support": assignment("Science Hub", "Reinforce", "Secondary", "Keep the eastern rotation route open."),
        "Reserve": assignment("", "Replace losses", "Standby", "Fill the highest-priority opening.")
      },
      "25-30": {
        "Unit A": assignment("Oil Refinery 2", "Final defense", "High", "Hold the eastern anchor through battle end."),
        "Unit B": assignment("Nuclear Silo", "Final defense", "Critical", "Remain committed to the highest-value objective."),
        "Unit C": assignment("Arsenal", "Defend", "High", "Secure the second center objective."),
        "Unit D": assignment("Arsenal", "Defend", "High", "Block final northern rotations."),
        "Strike Team": assignment("Nuclear Silo", "Counterattack", "Critical", "Break the final enemy center push."),
        "Scout + Support": assignment("Science Hub", "Support", "Secondary", "Protect the eastern route and report threats."),
        "Reserve": assignment("", "Emergency reinforcement", "Standby", "Deploy to the highest-priority threatened objective.")
      }
    }
  }
};
