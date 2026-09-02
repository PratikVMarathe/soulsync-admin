import {
  Timestamp,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { USER_ROLES } from '../constants/auth';
import { QUIZ_ACTIONS } from '../constants/quizManagement';
import { QuizManagementError } from './quizManagementService';

const QUIZZES_COLLECTION = 'quizzes';
const AUDIT_LOGS_COLLECTION = 'auditLogs';
const MAX_QUIZZES_PER_BATCH = 200; // 200 quizzes + 200 audit logs = 400 writes (< 500 limit)

function requireQuizAdmin(viewer) {
  if (![USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN].includes(viewer?.role)) {
    throw new QuizManagementError(
      'quiz-management/forbidden',
      'Only Admin and Super Admin accounts can perform Quiz Bulk Upload.',
    );
  }
}

function getTimestamp(value) {
  if (!value) return null;
  if (value instanceof Timestamp) return value;
  if (value instanceof Date) return Timestamp.fromDate(value);
  if (typeof value?.toDate === 'function') return Timestamp.fromDate(value.toDate());
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : Timestamp.fromDate(parsed);
}

/**
 * Queries Firestore to check which slugs already exist.
 * Queries in chunks of 30 because Firestore 'in' filters support up to 30 items.
 */
export async function checkExistingQuizSlugs(slugs = [], viewer) {
  requireQuizAdmin(viewer);

  const uniqueSlugs = Array.from(new Set(slugs.filter(Boolean)));
  if (uniqueSlugs.length === 0) return new Set();

  const existingSlugs = new Set();
  const chunkSize = 30;

  for (let i = 0; i < uniqueSlugs.length; i += chunkSize) {
    const chunk = uniqueSlugs.slice(i, i + chunkSize);
    const q = query(
      collection(db, QUIZZES_COLLECTION),
      where('slug', 'in', chunk),
    );

    const snapshot = await getDocs(q);
    snapshot.docs.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      if (data?.slug) {
        existingSlugs.add(data.slug);
      }
    });
  }

  return existingSlugs;
}

/**
 * Imports an array of validated quizzes into Firestore using chunked batched writes.
 * Creates an audit log entry for each imported quiz.
 */
export async function importQuizBatch({ onProgress, quizzes = [], viewer }) {
  requireQuizAdmin(viewer);

  if (!quizzes || quizzes.length === 0) {
    throw new QuizManagementError(
      'quiz-management/empty-import',
      'No quizzes provided for import.',
    );
  }

  const createdQuizIds = [];
  const total = quizzes.length;
  let processedCount = 0;

  for (let i = 0; i < quizzes.length; i += MAX_QUIZZES_PER_BATCH) {
    const quizChunk = quizzes.slice(i, i + MAX_QUIZZES_PER_BATCH);
    const batch = writeBatch(db);

    quizChunk.forEach((quiz) => {
      const quizRef = doc(collection(db, QUIZZES_COLLECTION));
      const auditRef = doc(collection(db, AUDIT_LOGS_COLLECTION));
      createdQuizIds.push(quizRef.id);

      const firestoreQuizPayload = {
        allowRetake: quiz.allowRetake !== false,
        category: String(quiz.category || '').trim().toLowerCase(),
        createdAt: serverTimestamp(),
        createdBy: viewer.uid,
        description: String(quiz.description || '').trim(),
        estimatedTime: Number(quiz.estimatedTime) || 60,
        expireAt: getTimestamp(quiz.expireAt),
        imageAlt: String(quiz.imageAlt || '').trim(),
        imageUrl: String(quiz.imageUrl || '').trim(),
        level: quiz.level,
        publishAt: getTimestamp(quiz.publishAt),
        questions: (quiz.questions || []).map((q) => ({
          correctIndex: Number(q.correctIndex) || 0,
          id: q.id,
          options: q.options,
          references: (q.references || []).map((r) => ({
            chapter: r.chapter === '' || r.chapter === null ? null : Number(r.chapter),
            source: String(r.source || '').trim(),
            text: String(r.text || '').trim(),
            verse: r.verse === '' || r.verse === null ? null : Number(r.verse),
          })),
          text: String(q.text || '').trim(),
          time: Number(q.time) || 30,
        })),
        slug: String(quiz.slug || '').trim().toLowerCase(),
        status: quiz.status,
        title: String(quiz.title || '').trim(),
        totalQuestions: (quiz.questions || []).length,
        updatedAt: serverTimestamp(),
        updatedBy: viewer.uid,
        visualKey: String(quiz.visualKey || '').trim(),
      };

      const auditPayload = {
        action: QUIZ_ACTIONS.BULK_CREATE,
        createdAt: serverTimestamp(),
        performedBy: viewer.uid,
        performedByRole: viewer.role,
        status: 'SUCCESS',
        targetId: quizRef.id,
        targetTitle: quiz.title || 'Untitled Quiz',
      };

      batch.set(quizRef, firestoreQuizPayload);
      batch.set(auditRef, auditPayload);
    });

    await batch.commit();

    processedCount += quizChunk.length;
    if (typeof onProgress === 'function') {
      onProgress({
        percentage: Math.round((processedCount / total) * 100),
        processedCount,
        totalCount: total,
      });
    }
  }

  return {
    createdQuizIds,
    successCount: quizzes.length,
  };
}
