/** Link sharing mode: anyone with the link can view, or anyone can edit. */
export type LinkAccess = 'view' | 'edit';

/** Pending request from a viewer asking the owner for edit access. */
export interface EditAccessRequest {
  id: string;
  name: string;
  color: string;
  at: number;
}

/** Docs-style ACL stored in the shared room doc. */
export interface RoomAccessState {
  ownerId: string;
  linkAccess: LinkAccess;
  editors: string[];
  pendingEditRequests: EditAccessRequest[];
}

/**
 * Whether `userId` may edit the board.
 * Empty `ownerId` means access is not seeded yet — treat as open edit.
 */
export function deriveCanEdit(access: RoomAccessState, userId: string): boolean {
  if (!access.ownerId) return true;
  if (access.linkAccess === 'edit') return true;
  if (userId === access.ownerId) return true;
  return access.editors.includes(userId);
}
