import { describe, expect, it } from 'vitest';
import { canDeleteComment, canDeleteObject, isCreatedByUser } from './ownership';

const alice = { id: 'a1', name: 'Alice' };
const bob = { id: 'b2', name: 'Bob' };

describe('ownership', () => {
  it('matches id and legacy display name', () => {
    expect(isCreatedByUser('a1', alice)).toBe(true);
    expect(isCreatedByUser('Alice', alice)).toBe(true);
    expect(isCreatedByUser('b2', alice)).toBe(false);
  });

  it('lets any editor delete shared board objects', () => {
    expect(
      canDeleteObject({ createdBy: 'a1' }, alice, { canEdit: true, isRoomOwner: false }),
    ).toBe(true);
    expect(
      canDeleteObject({ createdBy: 'a1' }, bob, { canEdit: true, isRoomOwner: false }),
    ).toBe(true);
    expect(
      canDeleteObject({ createdBy: 'a1' }, bob, { canEdit: false, isRoomOwner: false }),
    ).toBe(false);
  });

  it('keeps unrevealed private ideas personal', () => {
    const privateIdea = {
      createdBy: 'a1',
      privateAuthorId: 'a1',
      privateRevealed: false,
    };
    expect(canDeleteObject(privateIdea, alice, { canEdit: true, isRoomOwner: false })).toBe(true);
    expect(canDeleteObject(privateIdea, bob, { canEdit: true, isRoomOwner: false })).toBe(false);
    expect(canDeleteObject(privateIdea, bob, { canEdit: true, isRoomOwner: true })).toBe(true);
    expect(
      canDeleteObject(
        { ...privateIdea, privateRevealed: true },
        bob,
        { canEdit: true, isRoomOwner: false },
      ),
    ).toBe(true);
  });

  it('lets editors delete comment threads', () => {
    const thread = { messages: [{ authorId: 'a1' }] } as Parameters<typeof canDeleteComment>[0];
    expect(canDeleteComment(thread, alice, { canEdit: true, isRoomOwner: false })).toBe(true);
    expect(canDeleteComment(thread, bob, { canEdit: true, isRoomOwner: false })).toBe(true);
    expect(canDeleteComment(thread, bob, { canEdit: false, isRoomOwner: false })).toBe(false);
  });
});
