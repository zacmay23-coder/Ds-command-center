const protectedFieldPattern = /(?:^|_)(?:id|uid|token|url|uri|href|src|image|attachment|profileimage|createdat|updatedat|timestamp|date|time|version)$/i;

export function sanitizeDisplayText(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replace(/\u0001/g, "")
    .replace(/\^A/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function sanitizeTextFields(value, options = {}, path = []) {
  const { collectChanges = null } = options;
  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeTextFields(item, options, [...path, index]));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      sanitizeTextFields(item, options, [...path, key])
    ]));
  }
  if (typeof value !== "string") return value;

  const key = String(path.at(-1) ?? "");
  if (protectedFieldPattern.test(key)) return value;
  const sanitized = sanitizeDisplayText(value);
  if (sanitized !== value && collectChanges) {
    collectChanges.push({ path: path.join("."), before: value, after: sanitized });
  }
  return sanitized;
}

