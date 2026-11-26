export interface SessionUser {
  id: string;
  username: string;
  /** user_sessions.id of the session the access token belongs to. */
  sessionId: string;
}

export type AccountStatusValue =
  | "ACTIVE"
  | "DELETION_PENDING"
  | "PERMANENTLY_DELETED";
