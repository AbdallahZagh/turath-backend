/** Identifies one signed-in device of one user. */
export type SessionRef = { userId: string; sessionId: string };

/** A signed-in device, as listed to its owner. */
export type SessionView = {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
};
