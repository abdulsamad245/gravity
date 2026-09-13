import { describe, expect, it } from 'vitest';
import { deriveCanEdit, type RoomAccessState } from './room-access';

const base: RoomAccessState = {
  ownerId: 'owner-1',
  linkAccess: 'view',
  editors: ['ed-1'],
  pendingEditRequests: [],
};

describe('deriveCanEdit', () => {
  it('allows everyone when link is edit', () => {
    expect(deriveCanEdit({ ...base, linkAccess: 'edit' }, 'stranger')).toBe(true);
  });

  it('allows owner and editors when link is view', () => {
    expect(deriveCanEdit(base, 'owner-1')).toBe(true);
    expect(deriveCanEdit(base, 'ed-1')).toBe(true);
    expect(deriveCanEdit(base, 'viewer')).toBe(false);
  });

  it('allows all before owner is seeded', () => {
    expect(deriveCanEdit({ ...base, ownerId: '' }, 'anyone')).toBe(true);
  });
});
