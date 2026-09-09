export interface SessionUser {
  id: string;
  username: string;
}

export type AccountStatusValue =
  | "ACTIVE"
  | "DELETION_PENDING"
  | "PERMANENTLY_DELETED";
