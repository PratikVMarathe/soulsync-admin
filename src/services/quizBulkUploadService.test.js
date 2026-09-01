import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockBatch,
  mockCollection,
  mockDoc,
  mockGetDocs,
  mockWriteBatch,
} = vi.hoisted(() => {
  const batch = {
    commit: vi.fn(async () => {}),
    set: vi.fn(),
    update: vi.fn(),
  };

  return {
    mockBatch: batch,
    mockCollection: vi.fn((_db, col) => ({ path: col })),
    mockDoc: vi.fn((_db, col, id) => ({
      id: id || `mock_id_${Math.random().toString(36).slice(2, 7)}`,
      path: `${col}/${id ?? 'new'}`,
    })),
    mockGetDocs: vi.fn(),
    mockWriteBatch: vi.fn(() => batch),
  };
});

vi.mock('firebase/firestore', () => ({
  Timestamp: {
    fromDate: vi.fn((date) => ({ _date: date, toDate: () => date })),
  },
  collection: mockCollection,
  doc: mockDoc,
  getDocs: mockGetDocs,
  query: vi.fn((...args) => ({ args, type: 'query' })),
  serverTimestamp: vi.fn(() => ({ _isTimestamp: true })),
  where: vi.fn((f, op, v) => ({ f, op, type: 'where', v })),
  writeBatch: mockWriteBatch,
}));

vi.mock('../config/firebase', () => ({ auth: {}, db: 'MOCK_DB' }));

import { QUIZ_ACTIONS } from '../constants/quizManagement';
import {
  checkExistingQuizSlugs,
  importQuizBatch,
} from './quizBulkUploadService';

const ADMIN_VIEWER = { role: 'ADMIN', uid: 'admin_uid_123' };
const USER_VIEWER = { role: 'USER', uid: 'user_uid_123' };

describe('quizBulkUploadService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkExistingQuizSlugs', () => {
    it('throws error for unauthorized viewer', async () => {
      await expect(
        checkExistingQuizSlugs(['focus'], USER_VIEWER),
      ).rejects.toThrow(/only admin/i);
    });

    it('returns empty set if slugs array is empty', async () => {
      const result = await checkExistingQuizSlugs([], ADMIN_VIEWER);
      expect(result.size).toBe(0);
    });

    it('queries Firestore and returns detected existing slugs', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { data: () => ({ slug: 'focus' }) },
        ],
      });

      const result = await checkExistingQuizSlugs(['focus', 'jnana'], ADMIN_VIEWER);
      expect(result.has('focus')).toBe(true);
      expect(result.has('jnana')).toBe(false);
    });
  });

  describe('importQuizBatch', () => {
    it('throws error for unauthorized viewer', async () => {
      await expect(
        importQuizBatch({ quizzes: [{ slug: 'test' }], viewer: USER_VIEWER }),
      ).rejects.toThrow(/only admin/i);
    });

    it('throws error for empty quizzes input', async () => {
      await expect(
        importQuizBatch({ quizzes: [], viewer: ADMIN_VIEWER }),
      ).rejects.toThrow(/no quizzes provided/i);
    });

    it('writes quizzes and audit logs in batch with system fields', async () => {
      const sampleQuiz = {
        allowRetake: true,
        category: 'focus',
        description: 'Focus description',
        estimatedTime: 60,
        expireAt: null,
        imageAlt: 'Alt',
        imageUrl: '',
        level: 'BEGINNER',
        publishAt: null,
        questions: [
          {
            correctIndex: 0,
            id: 'q1',
            options: ['A', 'B', 'C', 'D'],
            references: [{ chapter: 6, source: 'Gita', text: 'Ref', verse: 35 }],
            text: 'Question text',
            time: 30,
          },
        ],
        slug: 'focus',
        status: 'ACTIVE',
        title: 'Focus Quiz',
        visualKey: 'focus-lake',
      };

      const progressCallback = vi.fn();

      const result = await importQuizBatch({
        onProgress: progressCallback,
        quizzes: [sampleQuiz],
        viewer: ADMIN_VIEWER,
      });

      expect(mockWriteBatch).toHaveBeenCalled();
      expect(mockBatch.set).toHaveBeenCalledTimes(2); // 1 for quiz doc + 1 for audit log
      expect(mockBatch.commit).toHaveBeenCalled();

      // Verify quiz document payload
      const quizDocCall = mockBatch.set.mock.calls[0];
      const quizData = quizDocCall[1];
      expect(quizData.title).toBe('Focus Quiz');
      expect(quizData.slug).toBe('focus');
      expect(quizData.createdBy).toBe(ADMIN_VIEWER.uid);
      expect(quizData.updatedBy).toBe(ADMIN_VIEWER.uid);
      expect(quizData.totalQuestions).toBe(1);

      // Verify audit log payload
      const auditDocCall = mockBatch.set.mock.calls[1];
      const auditData = auditDocCall[1];
      expect(auditData.action).toBe(QUIZ_ACTIONS.BULK_CREATE);
      expect(auditData.performedBy).toBe(ADMIN_VIEWER.uid);
      expect(auditData.targetTitle).toBe('Focus Quiz');

      expect(progressCallback).toHaveBeenCalledWith({
        percentage: 100,
        processedCount: 1,
        totalCount: 1,
      });

      expect(result.successCount).toBe(1);
      expect(result.createdQuizIds).toHaveLength(1);
    });
  });
});
