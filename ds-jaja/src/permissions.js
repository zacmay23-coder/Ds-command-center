export const ROLES = Object.freeze({
  MEMBER: "member",
  OFFICER: "officer",
  ADMIN: "administrator"
});

const ROLE_WEIGHT = {
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
  const officer = hasRole(user, ROLES.OFFICER);
  const admin = hasRole(user, ROLES.ADMIN);
  return {
    canCreateEvents: officer,
    canEditEvents: officer,
    canPublishEvents: officer,
    canActivateEvents: officer,
    canCompleteEvents: officer,
    canArchiveEvents: officer,
    canCancelEvents: officer,
    canDeleteEvents: admin,
    canManageAccounts: admin
  };
}

export function canViewEvent(user, event) {
  return hasRole(user, ROLES.OFFICER) || event?.status !== "draft";
}

export function canEditOwnAvailability(user, playerId) {
  return Boolean(user?.active && user.playerId && user.playerId === playerId);
}

