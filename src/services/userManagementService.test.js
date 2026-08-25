import { describe, it, beforeEach, vi } from 'vitest';

// --- Mocks must come before imports of the module under test ---
const mockTransaction = {
  get: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
};

const mockRunTransaction = vi.fn(async (_db, fn) => fn(mockTransaction));
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockDoc = vi.fn((_db, col, id) => ({ path: `${col}/${id ?? 'new'}` }));
const mockCollection = vi.fn((db, col) => ({ path: col }));

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  collectionGroup: vi.fn((db, col) => ({ path: col })),
  doc: mockDoc,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  limit: vi.fn((n) => ({ type: 'limit', n })),
  orderBy: vi.fn((f, d) => ({ type: 'orderBy', f, d })),
  query: vi.fn((...args) => ({ type: 'query', args })),
  runTransaction: mockRunTransaction,
  serverTimestamp: vi.fn(() => ({ _isTimestamp: true })),
  startAfter: vi.fn((doc) => ({ type: 'startAfter', doc })),
  where: vi.fn((f, op, v) => ({ type: 'where', f, op, v })),
}));

vi.mock('../config/firebase', () => ({ db: 'MOCK_DB', auth: {} }));

const ADMIN_VIEWER = { uid: 'admin_uid', role: 'ADMIN' };
const SUPER_VIEWER = { uid: 'super_uid', role: 'SUPER_ADMIN' };

function makeUserSnap(data) {
  return { exists: () => true, id: data.uid || 'u1', data: () => data };
}

function makeMissingSnap() {
  return { exists: () => false, id: null, data: () => null };
}

function makeQuerySnap(docs = []) {
  return { docs, empty: docs.length === 0 };
}

describe('userManagementService', () => {
  let service;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockTransaction.get.mockReset();
    mockTransaction.set.mockReset();
    mockTransaction.update.mockReset();
    service = await import('./userManagementService');
  });

  // ─── listUsers ─────────────────────────────────────────────────────────────

  describe('listUsers', () => {
    it('queries only role == "USER" documents', async () => {
      const { query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
      getDocs.mockResolvedValue(makeQuerySnap([]));

      await service.listUsers({}, ADMIN_VIEWER);

      expect(where).toHaveBeenCalledWith('role', '==', 'USER');
    });

    it('throws when viewer is not ADMIN or SUPER_ADMIN', async () => {
      await expect(
        service.listUsers({}, { uid: 'u', role: 'USER' })
      ).rejects.toThrow();
    });

    it('returns hasMore=true when +1 doc is returned', async () => {
      const docs = Array.from({ length: 11 }, (_, i) => ({
        id: `u${i}`,
        exists: () => true,
        data: () => ({ role: 'USER', status: 'ACTIVE' }),
      }));
      mockGetDocs.mockResolvedValue(makeQuerySnap(docs));

      const result = await service.listUsers({}, ADMIN_VIEWER);

      expect(result.hasMore).toBe(true);
      expect(result.users).toHaveLength(10); // trimmed to 10
    });
  });

  // ─── getUserByUid ──────────────────────────────────────────────────────────

  describe('getUserByUid', () => {
    it('returns user for role == "USER" doc', async () => {
      mockGetDoc.mockResolvedValue(makeUserSnap({ uid: 'u1', role: 'USER', status: 'ACTIVE' }));

      const user = await service.getUserByUid('u1', ADMIN_VIEWER);

      expect(user.role).toBe('USER');
    });

    it('throws invalid-role for ADMIN doc', async () => {
      mockGetDoc.mockResolvedValue(makeUserSnap({ uid: 'a1', role: 'ADMIN' }));

      await expect(service.getUserByUid('a1', ADMIN_VIEWER)).rejects.toMatchObject({
        code: 'user-management/invalid-role',
      });
    });

    it('throws not-found for missing doc', async () => {
      mockGetDoc.mockResolvedValue(makeMissingSnap());

      await expect(service.getUserByUid('ghost', ADMIN_VIEWER)).rejects.toMatchObject({
        code: 'user-management/not-found',
      });
    });
  });

  // ─── updateUserName ─────────────────────────────────────────────────────────

  describe('updateUserName', () => {
    it('calls transaction.update with normalised name', async () => {
      mockTransaction.get.mockResolvedValue(
        makeUserSnap({ uid: 'u1', role: 'USER', status: 'ACTIVE', email: 'a@b.com' })
      );

      await service.updateUserName({ uid: 'u1', name: 'priya sharma', viewer: ADMIN_VIEWER });

      expect(mockTransaction.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ name: 'Priya Sharma' })
      );
    });

    it('writes USER_UPDATED audit log', async () => {
      mockTransaction.get.mockResolvedValue(
        makeUserSnap({ uid: 'u1', role: 'USER', status: 'ACTIVE', email: 'a@b.com' })
      );

      await service.updateUserName({ uid: 'u1', name: 'Test', viewer: ADMIN_VIEWER });

      expect(mockTransaction.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'USER_UPDATED', targetRole: 'USER' })
      );
    });

    it('throws forbidden when viewer is USER', async () => {
      await expect(
        service.updateUserName({ uid: 'u1', name: 'x', viewer: { uid: 'x', role: 'USER' } })
      ).rejects.toMatchObject({ code: 'user-management/forbidden' });
    });
  });

  // ─── blockUser ─────────────────────────────────────────────────────────────

  describe('blockUser', () => {
    it('updates status to BLOCKED and writes audit log', async () => {
      mockTransaction.get.mockResolvedValueOnce(
        makeUserSnap({ uid: 'u1', role: 'USER', status: 'ACTIVE', email: 'a@b.com' })
      );

      await service.blockUser({ uid: 'u1', viewer: ADMIN_VIEWER });

      expect(mockTransaction.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'BLOCKED' })
      );
      expect(mockTransaction.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'USER_BLOCKED' })
      );
    });

    it('throws already-blocked when status is BLOCKED', async () => {
      mockTransaction.get.mockResolvedValue(
        makeUserSnap({ uid: 'u1', role: 'USER', status: 'BLOCKED', email: 'a@b.com' })
      );

      await expect(service.blockUser({ uid: 'u1', viewer: ADMIN_VIEWER })).rejects.toMatchObject({
        code: 'user-management/already-blocked',
      });
    });

    it('throws invalid-role when trying to block an ADMIN', async () => {
      mockTransaction.get.mockResolvedValue(
        makeUserSnap({ uid: 'a1', role: 'ADMIN', status: 'ACTIVE', email: 'a@b.com' })
      );

      await expect(service.blockUser({ uid: 'a1', viewer: SUPER_VIEWER })).rejects.toMatchObject({
        code: 'user-management/invalid-role',
      });
    });
  });

  // ─── unblockUser ───────────────────────────────────────────────────────────

  describe('unblockUser', () => {
    it('restores status to ACTIVE and writes audit log', async () => {
      mockTransaction.get.mockResolvedValueOnce(
        makeUserSnap({ uid: 'u1', role: 'USER', status: 'BLOCKED', email: 'a@b.com' })
      );

      await service.unblockUser({ uid: 'u1', viewer: ADMIN_VIEWER });

      expect(mockTransaction.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'ACTIVE' })
      );
      expect(mockTransaction.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'USER_UNBLOCKED' })
      );
    });

    it('throws not-blocked when user is ACTIVE', async () => {
      mockTransaction.get.mockResolvedValue(
        makeUserSnap({ uid: 'u1', role: 'USER', status: 'ACTIVE', email: 'a@b.com' })
      );

      await expect(service.unblockUser({ uid: 'u1', viewer: ADMIN_VIEWER })).rejects.toMatchObject({
        code: 'user-management/not-blocked',
      });
    });
  });

  // ─── updateUserPhone ────────────────────────────────────────────────────────

  describe('updateUserPhone', () => {
    it('throws phone-invalid for bad input', async () => {
      await expect(
        service.updateUserPhone({ uid: 'u1', phoneNumber: '123', viewer: ADMIN_VIEWER })
      ).rejects.toMatchObject({ code: 'user-management/phone-invalid' });
    });

    it('throws phone-conflict when lock belongs to another uid', async () => {
      mockTransaction.get
        .mockResolvedValueOnce(makeUserSnap({ uid: 'u1', role: 'USER', status: 'ACTIVE', email: 'a@b.com' }))
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ uid: 'other_uid', status: 'LOCKED' }),
        });

      await expect(
        service.updateUserPhone({ uid: 'u1', phoneNumber: '9876543210', viewer: ADMIN_VIEWER })
      ).rejects.toMatchObject({ code: 'user-management/phone-conflict' });
    });

    it('allows setting phone when lock is released', async () => {
      mockTransaction.get
        .mockResolvedValueOnce(makeUserSnap({ uid: 'u1', role: 'USER', status: 'ACTIVE', email: 'a@b.com' }))
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ uid: 'u1', status: 'RELEASED' }),
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ uid: 'u1', status: 'RELEASED' }),
        });

      await service.updateUserPhone({ uid: 'u1', phoneNumber: '9876543210', viewer: ADMIN_VIEWER });

      expect(mockTransaction.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ phoneNumber: '9876543210' })
      );
    });
  });
});
