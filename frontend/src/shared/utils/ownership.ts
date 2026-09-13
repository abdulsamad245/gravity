import type { CanvasComment, CanvasObject, Identity } from '../types';

/** True if `createdBy` is this user (id preferred; legacy boards used display name). */
export function isCreatedByUser(
  createdBy: string | undefined,
  identity: Pick<Identity, 'id' | 'name'>,
): boolean {
  if (!createdBy) return false;
  return createdBy === identity.id || createdBy === identity.name;
}

/**
 * Who may delete a canvas object on a collaborative board.
 * - Any editor may delete shared board objects (stickies, images, shapes, …).
 * - Unrevealed private brainstorm ideas stay personal (author or room owner).
 * - Viewers cannot delete. Lock is enforced separately by callers.
 */
export function canDeleteObject(
  obj:
    | Pick<CanvasObject, 'createdBy' | 'privateAuthorId' | 'privateRevealed'>
    | undefined,
  identity: Pick<Identity, 'id' | 'name'>,
  opts: { isRoomOwner: boolean; canEdit: boolean },
): boolean {
  if (!opts.canEdit || !obj) return false;

  const privatePersonal = !!obj.privateAuthorId && !obj.privateRevealed;
  if (privatePersonal) {
    if (opts.isRoomOwner) return true;
    return (
      isCreatedByUser(obj.privateAuthorId, identity) || isCreatedByUser(obj.createdBy, identity)
    );
  }

  return true;
}

/**
 * Comment threads are board facilitation content: any editor may remove them.
 * Room owner always can; viewers cannot.
 */
export function canDeleteComment(
  comment: Pick<CanvasComment, 'messages'> | undefined,
  identity: Pick<Identity, 'id' | 'name'>,
  opts: { isRoomOwner: boolean; canEdit: boolean },
): boolean {
  if (!opts.canEdit || !comment) return false;
  void identity;
  void opts.isRoomOwner;
  return true;
}
