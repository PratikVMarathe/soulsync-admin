import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MandalaAdminError,
  createSatsangOpportunity,
  fetchSatsangOpportunities,
  updateSatsangOpportunity,
} from './mandalaAdminService';
import { USER_ROLES } from '../constants/auth';
import { getDocs, runTransaction } from 'firebase/firestore';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_, col) => ({ _col: col })),
  doc: vi.fn((_, col, id) => ({ _col: col, id: id || 'mock-auto-id' })),
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

describe('mandalaAdminService — Social Media Links', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSatsangOpportunity', () => {
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

    it('creates an opportunity with partial or empty social links', async () => {
      runTransaction.mockImplementation(async (_, callback) => {
        const mockTx = {
          set: vi.fn(),
        };
        await callback(mockTx);
        return mockTx;
      });

      const payload = {
        title: 'Morning Gita Class',
        category: 'CLASS',
        socialLinks: {
          whatsapp: 'https://wa.me/1234567890',
        },
      };

      const result = await createSatsangOpportunity(mockAdminViewer, payload);
      expect(result).toBe('mock-auto-id');
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

    it('rejects URL with wrong domain for platform', async () => {
      const payload = {
        title: 'Festival',
        socialLinks: {
          whatsapp: 'https://evil.com/fake-whatsapp',
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
    it('updates opportunity with valid social links', async () => {
      runTransaction.mockImplementation(async (_, callback) => {
        const mockTx = {
          get: vi.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({ title: 'Old Title' }),
          }),
          update: vi.fn(),
          set: vi.fn(),
        };
        await callback(mockTx);
      });

      const payload = {
        title: 'Updated Feast',
        category: 'EVENT',
        socialLinks: {
          youtube: 'https://youtu.be/videoid123',
          telegram: 'https://t.me/joinchat/xyz',
        },
      };

      await updateSatsangOpportunity(mockAdminViewer, 'opp-123', payload);
      expect(runTransaction).toHaveBeenCalledTimes(1);
    });

    it('rejects invalid YouTube link', async () => {
      const payload = {
        title: 'Updated Feast',
        socialLinks: {
          youtube: 'https://vimeo.com/12345',
        },
      };

      await expect(
        updateSatsangOpportunity(mockAdminViewer, 'opp-123', payload),
      ).rejects.toThrow(/HTTPS YouTube link/i);
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
