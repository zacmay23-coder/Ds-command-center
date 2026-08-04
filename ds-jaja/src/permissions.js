export const ROLES = Object.freeze({
  GUEST: "guest",
  MEMBER: "member",
  OFFICER: "officer",
  ADMIN: "administrator"
});

const ROLE_WEIGHT = {
  [ROLES.GUEST]: 0,
  [ROLES.MEMBER]: 1,
  [ROLES.OFFICER]: 2,
  [ROLES.ADMIN]: 3
};

export function normalizeRole(role) {
  return Object.hasOwn(ROLE_WEIGHT, role) ? role : ROLES.MEMBER;
}

export function hasRole(user, minimumRole) {
  return Boolean(user?.active) &&
    ROLE_WEIGHT[normalizeRole(user.role)] >= ROLE_WEIGHT[minimumRole];
}

export function requireRole(user, minimumRole) {
  if (!hasRole(user, minimumRole)) {
    const error = new Error(`This action requires ${minimumRole} access`);
    error.statusCode = 403;
    throw error;
  }
}

export function permissionsFor(user) {
  const guest = user?.role === ROLES.GUEST;
  const officer = hasRole(user, ROLES.OFFICER);
  const admin = hasRole(user, ROLES.ADMIN);
  const capabilities = new Set(user?.officerPermissions || []);
  const hasCapability = (name) => admin || capabilities.has("*") || capabilities.has(name);
  return {
    viewGuestDashboard: guest,
    viewPublishedEvents: guest || hasRole(user, ROLES.MEMBER),
    viewPublishedStrategies: guest || hasRole(user, ROLES.MEMBER),
    viewInteractiveMap: guest || hasRole(user, ROLES.MEMBER),
    runMapSimulation: guest || hasRole(user, ROLES.MEMBER),
    switchMapTeams: guest || hasRole(user, ROLES.MEMBER),
    exploreNavigation: guest,
    viewPrivateBriefings: !guest && hasRole(user, ROLES.MEMBER),
    canCreateEvents: officer,
    canEditEvents: officer,
    canPublishEvents: officer,
    canActivateEvents: officer,
    canCompleteEvents: officer,
    canArchiveEvents: officer,
    canCancelEvents: officer,
    canDeleteEvents: admin,
    canManageAccounts: admin,
    viewRoster: !guest && hasRole(user, ROLES.MEMBER),
    viewPublishedBattlePlans: guest || hasRole(user, ROLES.MEMBER),
    manageDesertStormPlans: officer && (hasCapability("manageDesertStormPlans") || hasCapability("manageMap")),
    publishBattlePlans: officer && (hasCapability("publishBattlePlans") || hasCapability("manageEvents")),
    viewSeasonBattlePlans: !guest && hasRole(user, ROLES.MEMBER),
    manageSeasonBattlePlans: officer && hasCapability("manageSeasonBattlePlans"),
    publishSeasonBattlePlans: officer && hasCapability("publishSeasonBattlePlans"),
    archiveSeasonBattlePlans: officer && hasCapability("archiveSeasonBattlePlans"),
    deleteSeasonBattleDrafts: officer && hasCapability("deleteSeasonBattleDrafts")
  };
}

export function requireCapability(user, capability) {
  if (!permissionsFor(user)[capability]) {
    const error = new Error(`This action requires ${capability} permission`);
    error.statusCode = 403;
    throw error;
  }
}

export function canViewEvent(user, event) {
  return hasRole(user, ROLES.OFFICER) || event?.status !== "draft";
}

export function canEditOwnAvailability(user, playerId) {
  return Boolean(user?.active && user.playerId && user.playerId === playerId);
}

