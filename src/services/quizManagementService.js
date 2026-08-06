import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { USER_ROLES } from '../constants/auth';
import {
  MAX_DRAFTS_PER_ADMIN,
  QUIZ_ACTIONS,
  QUIZ_STATUSES,
} from '../constants/quizManagement';
import { db } from '../config/firebase';
import {
  buildQuizPayloadFromForm,
  quizToFormState,
  validateQuizPayload,
} from '../utils/quizManagement';

const QUIZZES_COLLECTION = 'quizzes';
const AUDIT_LOGS_COLLECTION = 'auditLogs';

export class QuizManagementError extends Error {
  constructor(code, publicMessage, fieldErrors = {}) {
    super(publicMessage);
    this.name = 'QuizManagementError';
    this.code = code;
    this.publicMessage = publicMessage;
    this.fieldErrors = fieldErrors;
  }
}

function requireQuizAdmin(viewer) {
  if (![USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN].includes(viewer?.role)) {
    throw new QuizManagementError(
      'quiz-management/forbidden',
      'Only Admin and Super Admin accounts can access Quiz Management.',
    );
  }
}

function getQuizReference(quizId) {
  return doc(db, QUIZZES_COLLECTION, quizId);
}

function mapQuizDocument(documentSnapshot) {
  return {
    id: documentSnapshot.id,
    ...documentSnapshot.data(),
  };
}

function getTimestamp(value) {
  return value ? Timestamp.fromDate(value) : null;
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === 'function') return value.toDate();

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function getEndOfToday() {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return endOfToday;
}

function getActivationExpiryDate(expireAt) {
  const expiryDate = toDate(expireAt);

  if (expiryDate && expiryDate.getTime() > Date.now()) {
    return expiryDate;
  }

  return getEndOfToday();
}

function hasExpired(expireAt) {
  const expiryMillis = toMillis(expireAt);
  return Boolean(expiryMillis) && expiryMillis <= Date.now();
}

function sortByRecentUpdate(left, right) {
  return toMillis(right.updatedAt || right.createdAt) - toMillis(left.updatedAt || left.createdAt);
}

function buildAuditLogPayload({
  action,
  targetId,
  targetTitle,
  viewer,
}) {
  return {
    action,
    createdAt: serverTimestamp(),
    performedBy: viewer.uid,
    performedByRole: viewer.role,
    status: 'SUCCESS',
    targetId,
    targetTitle: targetTitle || 'Untitled Quiz',
  };
}

async function createQuizAuditLog({ action, targetId, targetTitle, viewer }) {
  await addDoc(collection(db, AUDIT_LOGS_COLLECTION), buildAuditLogPayload({
    action,
    targetId,
    targetTitle,
    viewer,
  }));
}

function toFirestoreQuizPayload(payload) {
  return {
    ...payload,
    expireAt: getTimestamp(payload.expireAt),
    publishAt: getTimestamp(payload.publishAt),
  };
}

function throwIfFieldErrors(fieldErrors, fallbackMessage) {
  if (Object.keys(fieldErrors).length) {
    throw new QuizManagementError(
      'quiz-management/validation-failed',
      fallbackMessage,
      fieldErrors,
    );
  }
}

async function assertUniqueSlug(slug, excludeQuizId = null) {
  if (!slug) return;

  const slugSnapshot = await getDocs(query(
    collection(db, QUIZZES_COLLECTION),
    where('slug', '==', slug),
    limit(10),
  ));

  const hasConflict = slugSnapshot.docs.some((documentSnapshot) => documentSnapshot.id !== excludeQuizId);

  if (hasConflict) {
    throw new QuizManagementError(
      'quiz-management/slug-conflict',
      'This slug is already used by another quiz.',
      { slug: 'This slug is already used by another quiz.' },
    );
  }
}

async function getOwnedDraftCount(viewer, excludeQuizId = null) {
  const draftsSnapshot = await getDocs(query(
    collection(db, QUIZZES_COLLECTION),
    where('createdBy', '==', viewer.uid),
  ));

  return draftsSnapshot.docs.filter((documentSnapshot) => (
    documentSnapshot.id !== excludeQuizId
    && documentSnapshot.data()?.status === QUIZ_STATUSES.DRAFT
  )).length;
}

async function assertDraftLimit(viewer, excludeQuizId = null) {
  const draftCount = await getOwnedDraftCount(viewer, excludeQuizId);

  if (draftCount >= MAX_DRAFTS_PER_ADMIN) {
    throw new QuizManagementError(
      'quiz-management/draft-limit',
      'Maximum draft limit reached. Delete or complete an existing draft before creating another.',
      { draftLimit: 'Maximum draft limit reached.' },
    );
  }
}

async function loadQuizSnapshot(quizId) {
  const quizSnapshot = await getDoc(getQuizReference(quizId));

  if (!quizSnapshot.exists()) {
    throw new QuizManagementError(
      'quiz-management/not-found',
      'This quiz no longer exists.',
    );
  }

  return quizSnapshot;
}

async function deactivateExpiredQuizzes(quizzes, viewer) {
  const expiredQuizzes = quizzes.filter((quiz) => (
    quiz.status === QUIZ_STATUSES.ACTIVE && hasExpired(quiz.expireAt)
  ));

  if (!expiredQuizzes.length) return [];

  const batch = writeBatch(db);
  const reconciledAt = new Date();

  expiredQuizzes.slice(0, 200).forEach((quiz) => {
    batch.update(getQuizReference(quiz.id), {
      status: QUIZ_STATUSES.INACTIVE,
      updatedAt: serverTimestamp(),
      updatedBy: viewer.uid,
    });

    batch.set(doc(collection(db, AUDIT_LOGS_COLLECTION)), buildAuditLogPayload({
      action: QUIZ_ACTIONS.DEACTIVATE,
      targetId: quiz.id,
      targetTitle: quiz.title,
      viewer,
    }));
  });

  await batch.commit();

  return expiredQuizzes.map((quiz) => ({
    ...quiz,
    status: QUIZ_STATUSES.INACTIVE,
    updatedAt: reconciledAt,
    updatedBy: viewer.uid,
  }));
}

export async function loadQuizManagementSnapshot(viewer) {
  requireQuizAdmin(viewer);

  const quizSnapshot = await getDocs(query(
    collection(db, QUIZZES_COLLECTION),
    limit(500),
  ));

  const loadedQuizzes = quizSnapshot.docs.map(mapQuizDocument);
  const reconciledQuizzes = await deactivateExpiredQuizzes(loadedQuizzes, viewer);
  const reconciledById = new Map(reconciledQuizzes.map((quiz) => [quiz.id, quiz]));
  const quizzes = loadedQuizzes
    .map((quiz) => reconciledById.get(quiz.id) || quiz)
    .sort(sortByRecentUpdate);
  const drafts = quizzes
    .filter((quiz) => quiz.createdBy === viewer.uid && quiz.status === QUIZ_STATUSES.DRAFT)
    .sort(sortByRecentUpdate);

  return {
    draftCount: drafts.length,
    drafts,
    quizzes,
  };
}

export async function loadQuizForEditing({ recordResume = false, quizId, viewer }) {
  requireQuizAdmin(viewer);

  const quizSnapshot = await loadQuizSnapshot(quizId);
  const quiz = mapQuizDocument(quizSnapshot);

  if (recordResume && quiz.status === QUIZ_STATUSES.DRAFT) {
    await createQuizAuditLog({
      action: QUIZ_ACTIONS.RESUME_DRAFT,
      targetId: quiz.id,
      targetTitle: quiz.title,
      viewer,
    });
  }

  return {
    formState: quizToFormState(quiz),
    quiz,
  };
}

export async function getDraftLimitState({ excludeQuizId = null, viewer }) {
  requireQuizAdmin(viewer);

  const draftCount = await getOwnedDraftCount(viewer, excludeQuizId);

  return {
    draftCount,
    limit: MAX_DRAFTS_PER_ADMIN,
    reached: draftCount >= MAX_DRAFTS_PER_ADMIN,
  };
}

export async function saveQuizDraft({ formState, quizId = null, viewer }) {
  requireQuizAdmin(viewer);

  const payload = buildQuizPayloadFromForm(formState, QUIZ_STATUSES.DRAFT);
  const fieldErrors = validateQuizPayload(payload, { mode: 'draft' });

  throwIfFieldErrors(fieldErrors, 'Fix the highlighted fields before saving this draft.');

  if (!quizId) {
    await assertDraftLimit(viewer);
  }

  await assertUniqueSlug(payload.slug, quizId);

  const firestorePayload = toFirestoreQuizPayload(payload);
  const quizReference = quizId ? getQuizReference(quizId) : doc(collection(db, QUIZZES_COLLECTION));
  const auditReference = doc(collection(db, AUDIT_LOGS_COLLECTION));

  await runTransaction(db, async (transaction) => {
    if (quizId) {
      const quizSnapshot = await transaction.get(quizReference);

      if (!quizSnapshot.exists()) {
        throw new QuizManagementError('quiz-management/not-found', 'This quiz no longer exists.');
      }

      const currentQuiz = quizSnapshot.data();

      transaction.set(quizReference, {
        ...firestorePayload,
        createdAt: currentQuiz.createdAt,
        createdBy: currentQuiz.createdBy,
        totalQuestions: firestorePayload.questions.length,
        updatedAt: serverTimestamp(),
        updatedBy: viewer.uid,
      });
    } else {
      transaction.set(quizReference, {
        ...firestorePayload,
        createdAt: serverTimestamp(),
        createdBy: viewer.uid,
        totalQuestions: firestorePayload.questions.length,
        updatedAt: serverTimestamp(),
        updatedBy: viewer.uid,
      });
    }

    transaction.set(auditReference, buildAuditLogPayload({
      action: QUIZ_ACTIONS.SAVE_DRAFT,
      targetId: quizReference.id,
      targetTitle: payload.title,
      viewer,
    }));
  });

  return quizReference.id;
}

export async function saveQuizChanges({ formState, quizId, viewer }) {
  requireQuizAdmin(viewer);

  if (!quizId) {
    throw new QuizManagementError('quiz-management/missing-id', 'Open an existing quiz before saving changes.');
  }

  const status = formState.status === QUIZ_STATUSES.DRAFT ? QUIZ_STATUSES.DRAFT : formState.status;
  const payload = buildQuizPayloadFromForm(formState, status);
  const fieldErrors = validateQuizPayload(payload, {
    mode: payload.status === QUIZ_STATUSES.DRAFT ? 'draft' : 'publish',
  });

  throwIfFieldErrors(fieldErrors, 'Fix the highlighted fields before saving this quiz.');
  await assertUniqueSlug(payload.slug, quizId);

  const firestorePayload = toFirestoreQuizPayload(payload);
  const quizReference = getQuizReference(quizId);
  const auditReference = doc(collection(db, AUDIT_LOGS_COLLECTION));

  await runTransaction(db, async (transaction) => {
    const quizSnapshot = await transaction.get(quizReference);

    if (!quizSnapshot.exists()) {
      throw new QuizManagementError('quiz-management/not-found', 'This quiz no longer exists.');
    }

    const currentQuiz = quizSnapshot.data();

    transaction.set(quizReference, {
      ...firestorePayload,
      createdAt: currentQuiz.createdAt,
      createdBy: currentQuiz.createdBy,
      totalQuestions: firestorePayload.questions.length,
      updatedAt: serverTimestamp(),
      updatedBy: viewer.uid,
    });

    transaction.set(auditReference, buildAuditLogPayload({
      action: QUIZ_ACTIONS.UPDATE,
      targetId: quizId,
      targetTitle: payload.title,
      viewer,
    }));
  });

  return quizId;
}

export async function publishQuiz({ formState = null, quizId = null, viewer }) {
  requireQuizAdmin(viewer);

  const sourceFormState = formState || (await loadQuizForEditing({ quizId, viewer })).formState;
  const payload = {
    ...buildQuizPayloadFromForm(sourceFormState, QUIZ_STATUSES.ACTIVE),
    expireAt: getActivationExpiryDate(sourceFormState.expireAt),
    publishAt: new Date(),
    status: QUIZ_STATUSES.ACTIVE,
  };
  const fieldErrors = validateQuizPayload(payload, { mode: 'publish' });

  throwIfFieldErrors(fieldErrors, 'Complete the required quiz fields before publishing.');
  await assertUniqueSlug(payload.slug, quizId);

  const firestorePayload = toFirestoreQuizPayload(payload);
  const quizReference = quizId ? getQuizReference(quizId) : doc(collection(db, QUIZZES_COLLECTION));
  const auditReference = doc(collection(db, AUDIT_LOGS_COLLECTION));
  const createAuditReference = quizId ? null : doc(collection(db, AUDIT_LOGS_COLLECTION));

  await runTransaction(db, async (transaction) => {
    if (quizId) {
      const quizSnapshot = await transaction.get(quizReference);

      if (!quizSnapshot.exists()) {
        throw new QuizManagementError('quiz-management/not-found', 'This quiz no longer exists.');
      }

      const currentQuiz = quizSnapshot.data();

      transaction.set(quizReference, {
        ...firestorePayload,
        createdAt: currentQuiz.createdAt,
        createdBy: currentQuiz.createdBy,
        totalQuestions: firestorePayload.questions.length,
        updatedAt: serverTimestamp(),
        updatedBy: viewer.uid,
      });
    } else {
      transaction.set(quizReference, {
        ...firestorePayload,
        createdAt: serverTimestamp(),
        createdBy: viewer.uid,
        totalQuestions: firestorePayload.questions.length,
        updatedAt: serverTimestamp(),
        updatedBy: viewer.uid,
      });
    }

    if (createAuditReference) {
      transaction.set(createAuditReference, buildAuditLogPayload({
        action: QUIZ_ACTIONS.CREATE,
        targetId: quizReference.id,
        targetTitle: payload.title,
        viewer,
      }));
    }

    transaction.set(auditReference, buildAuditLogPayload({
      action: QUIZ_ACTIONS.PUBLISH,
      targetId: quizReference.id,
      targetTitle: payload.title,
      viewer,
    }));
  });

  return quizReference.id;
}

export async function setQuizActiveState({ active, quizId, viewer }) {
  requireQuizAdmin(viewer);

  const nextStatus = active ? QUIZ_STATUSES.ACTIVE : QUIZ_STATUSES.INACTIVE;
  const action = active ? QUIZ_ACTIONS.ACTIVATE : QUIZ_ACTIONS.DEACTIVATE;
  const quizSnapshot = await loadQuizSnapshot(quizId);
  const quiz = mapQuizDocument(quizSnapshot);
  const lifecyclePayload = {
    status: nextStatus,
    updatedAt: serverTimestamp(),
    updatedBy: viewer.uid,
  };

  if (active) {
    const expiryDate = getActivationExpiryDate(quiz.expireAt);
    const payload = {
      ...buildQuizPayloadFromForm({
        ...quizToFormState(quiz),
        expireAt: expiryDate,
        publishAt: new Date(),
      }, QUIZ_STATUSES.ACTIVE),
      expireAt: expiryDate,
      publishAt: new Date(),
    };
    const fieldErrors = validateQuizPayload(payload, { mode: 'publish' });
    throwIfFieldErrors(fieldErrors, 'Complete the required quiz fields before activating.');
    lifecyclePayload.expireAt = Timestamp.fromDate(expiryDate);
    lifecyclePayload.publishAt = serverTimestamp();
  }

  const quizReference = getQuizReference(quizId);
  const auditReference = doc(collection(db, AUDIT_LOGS_COLLECTION));

  await runTransaction(db, async (transaction) => {
    transaction.update(quizReference, lifecyclePayload);

    transaction.set(auditReference, buildAuditLogPayload({
      action,
      targetId: quizId,
      targetTitle: quiz.title,
      viewer,
    }));
  });
}

export async function softDeleteQuiz({ quizId, viewer }) {
  requireQuizAdmin(viewer);

  const quizSnapshot = await loadQuizSnapshot(quizId);
  const quiz = mapQuizDocument(quizSnapshot);
  const quizReference = getQuizReference(quizId);
  const auditReference = doc(collection(db, AUDIT_LOGS_COLLECTION));

  await runTransaction(db, async (transaction) => {
    transaction.update(quizReference, {
      status: QUIZ_STATUSES.INACTIVE,
      updatedAt: serverTimestamp(),
      updatedBy: viewer.uid,
    });

    transaction.set(auditReference, buildAuditLogPayload({
      action: QUIZ_ACTIONS.DELETE,
      targetId: quizId,
      targetTitle: quiz.title,
      viewer,
    }));
  });
}
