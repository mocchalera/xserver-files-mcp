export class PathSafetyError extends Error {
  constructor(message) {
    super(message);
    this.name = "PathSafetyError";
  }
}

export function normalizeRemotePath(inputPath) {
  const raw = inputPath || ".";
  if (typeof raw !== "string") {
    throw new PathSafetyError("path must be a string.");
  }
  if (raw.includes("\0")) {
    throw new PathSafetyError("path must not contain null bytes.");
  }

  const parts = [];
  for (const part of raw.replaceAll("\\", "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (parts.length === 0) {
        throw new PathSafetyError("path must stay inside the configured domain root.");
      }
      parts.pop();
      continue;
    }
    parts.push(part);
  }

  return parts.join("/");
}

export function joinRemote(root, relativePath) {
  if (!root || !root.startsWith("/")) {
    throw new PathSafetyError("root must be an absolute remote path.");
  }
  const normalizedRoot = root.endsWith("/") && root !== "/" ? root.slice(0, -1) : root;
  const normalizedRelative = normalizeRemotePath(relativePath);
  return normalizedRelative ? `${normalizedRoot}/${normalizedRelative}` : normalizedRoot;
}

export function ensureRelativeFilePath(relativePath) {
  const normalized = normalizeRemotePath(relativePath);
  if (!normalized) {
    throw new PathSafetyError("path must point to a file under the domain root.");
  }
  if (normalized.endsWith("/")) {
    throw new PathSafetyError("path must not end with a slash.");
  }
  return normalized;
}
