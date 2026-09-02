import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MandalaAdminError,
  createSatsangOpportunity,
  fetchSatsangOpportunities,
  normalizeClassDetails,
  updateSatsangOpportunity,
} from './mandalaAdminService';
import { USER_ROLES } from '../constants/auth';
import { getDocs, runTransaction } from 'firebase/firestore';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_, col) => ({ _col: col })),
  doc: vi.fn((parent, pathOrId, id) => {
    const colName = parent?._col || pathOrId;
    return { _col: colName, id: id || 'mock-auto-id' };
  }),
  getDocs: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => 'MOCK_TIMESTAMP'),
  Timestamp: {
    fromDate: vi.fn((d) => ({ seconds: Math.floor(d.getTime() / 1000) })),
  },
}));

vi.mock('../config/firebase', () => ({
  db: {},
}));

const mockAdminViewer = {
  uid: 'admin-1',
  email: 'admin@soulsync.dev',
  role: USER_ROLES.ADMIN,
};

const mockUserViewer = {
  uid: 'user-1',
  email: 'user@soulsync.dev',
  role: USER_ROLES.USER,
};

describe('mandalaAdminService — Social Media Links & Class Details', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('normalizeClassDetails', () => {
    it('returns defaults for null or empty object', () => {
      expect(normalizeClassDetails(null)).toEqual({
        availableModes: ['ONLINE', 'OFFLINE'],
        availableLanguages: ['ENGLISH', 'HINDI'],
        availableDays: ['SATURDAY', 'SUNDAY'],
      });
    });

    it('preserves valid custom class details', () => {
      const custom = {
        availableModes: ['ONLINE'],
        availableLanguages: ['HINDI'],
        availableDays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
      };
      expect(normalizeClassDetails(custom)).toEqual(custom);
    });
  });

  describe('createSatsangOpportunity', () => {
    it('creates a class opportunity with normalized classDetails', async () => {
      let savedDoc = null;
      runTransaction.mockImplementation(async (_, callback) => {
        const mockTx = {
          set: vi.fn((ref, data) => {
            if (data.title) {
              savedDoc = data;
            }
          }),
        };
        await callback(mockTx);
        return mockTx;
      });

      const payload = {
        title: 'Gita Foundations',
        category: 'CLASS',
        classDetails: {
          availableModes: ['ONLINE'],
          availableLanguages: ['ENGLISH'],
          availableDays: ['SATURDAY'],
        },
      };

      const result = await createSatsangOpportunity(mockAdminViewer, payload);
      expect(result).toBe('mock-auto-id');
      expect(savedDoc).not.toBeNull();
      expect(savedDoc.classDetails).toEqual({
        availableModes: ['ONLINE'],
        availableLanguages: ['ENGLISH'],
        availableDays: ['SATURDAY'],
      });
    });

    it('creates an event opportunity without classDetails', async () => {
      let savedDoc = null;
      runTransaction.mockImplementation(async (_, callback) => {
        const mockTx = {
          set: vi.fn((ref, data) => {
            if (data.title) {
              savedDoc = data;
            }
          }),
        };
        await callback(mockTx);
        return mockTx;
      });

      const payload = {
        title: 'Sunday Feast',
        category: 'EVENT',
        classDetails: {
          availableModes: ['ONLINE'],
        },
      };

      const result = await createSatsangOpportunity(mockAdminViewer, payload);
      expect(result).toBe('mock-auto-id');
      expect(savedDoc).not.toBeNull();
      expect(savedDoc.classDetails).toBeUndefined();
    });

    it('creates an opportunity with valid social links', async () => {
      runTransaction.mockImplementation(async (_, callback) => {
        const mockTx = {
          set: vi.fn(),
        };
        await callback(mockTx);
        return mockTx;
      });

      const payload = {
        title: 'Sunday Feast',
        category: 'EVENT',
        socialLinks: {
          whatsapp: 'https://chat.whatsapp.com/testgroup123',
          instagram: 'https://instagram.com/soulsync',
          youtube: 'https://youtube.com/@soulsync',
          facebook: 'https://facebook.com/soulsync',
          telegram: 'https://t.me/soulsync',
        },
      };

      const result = await createSatsangOpportunity(mockAdminViewer, payload);
      expect(result).toBe('mock-auto-id');
      expect(runTransaction).toHaveBeenCalledTimes(1);
    });

    it('rejects invalid URL that does not use HTTPS', async () => {
      const payload = {
        title: 'Janmashtami',
        socialLinks: {
          whatsapp: 'http://chat.whatsapp.com/insecure',
        },
      };

      await expect(createSatsangOpportunity(mockAdminViewer, payload)).rejects.toThrow(
        /HTTPS WhatsApp link/i,
      );
    });

    it('rejects non-admin viewers', async () => {
      const payload = { title: 'Class' };
      await expect(createSatsangOpportunity(mockUserViewer, payload)).rejects.toThrow(
        MandalaAdminError,
      );
    });
  });

  describe('updateSatsangOpportunity', () => {
    it('updates opportunity with classDetails for class category', async () => {
      let updatedData = null;
      runTransaction.mockImplementation(async (_, callback) => {
        const mockTx = {
          get: vi.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({ title: 'Old Class', category: 'CLASS' }),
          }),
          update: vi.fn((ref, data) => {
            updatedData = data;
          }),
          set: vi.fn(),
        };
        await callback(mockTx);
      });

      const payload = {
        title: 'Updated Gita Class',
        category: 'CLASS',
        classDetails: {
          availableModes: ['ONLINE', 'OFFLINE'],
          availableLanguages: ['HINDI'],
          availableDays: ['SUNDAY'],
        },
      };

      await updateSatsangOpportunity(mockAdminViewer, 'opp-123', payload);
      expect(updatedData.classDetails).toEqual({
        availableModes: ['ONLINE', 'OFFLINE'],
        availableLanguages: ['HINDI'],
        availableDays: ['SUNDAY'],
      });
    });
  });

  describe('fetchSatsangOpportunities', () => {
    it('normalizes missing socialLinks on existing documents', async () => {
      getDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'legacy-opp',
            data: () => ({
              title: 'Legacy Class Without Social Links',
              category: 'CLASS',
              createdAt: { seconds: 100 },
            }),
          },
        ],
      });

      const list = await fetchSatsangOpportunities(mockAdminViewer);
      expect(list).toHaveLength(1);
      expect(list[0].socialLinks).toEqual({
        whatsapp: '',
        instagram: '',
        youtube: '',
        facebook: '',
        telegram: '',
      });
    });
  });
});
