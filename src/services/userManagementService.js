import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  where,
} from 'firebase/firestore';
import {
  IDENTITY_LOCK_REASONS,
  IDENTITY_LOCK_STATUSES,
  IDENTITY_TYPES,
  USER_ROLES,
  USER_STATUSES,
} from '../constants/auth';
import { db } from '../config/firebase';
import {
  buildIdentityDocumentId,
  isValidPhoneNumber,
  normalizePhoneNumber,
} from '../utils/identity';
import { toTitleCase } from '../utils/text';

const USERS_COLLECTION = 'users';
const IDENTITY_LOCKS_COLLECTION = 'identityLocks';
const AUDIT_LOGS_COLLECTION = 'auditLogs';

const PAGE_SIZE = 10;

const PHONE_IN_USE_MESSAGE = 'This phone number is already registered to another account.';

// ─── Error Class ──────────────────────────────────────────────────────────────

export class UserManagementError extends Error {
  constructor(code, publicMessage) {
    super(publicMessage);
    this.name = 'UserManagementError';
    this.code = code;
    this.publicMessage = publicMessage;
  }
}

// ─── Guards ───────────────────────────────────────────────────────────────────

function requireAdminOrSuperAdmin(viewer) {
  if (![USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN].includes(viewer?.role)) {
    throw new UserManagementError(
      'user-management/forbidden',
      'Only Admin and Super Admin accounts can access user management.',
    );
  }
}

// ─── Ref Helpers ──────────────────────────────────────────────────────────────

function getUserRef(uid) {
  return doc(db, USERS_COLLECTION, uid);
}

function getIdentityLockRef(documentId) {
  return doc(db, IDENTITY_LOCKS_COLLECTION, documentId);
}

function getAuditLogRef() {
  return doc(collection(db, AUDIT_LOGS_COLLECTION));
}

// ─── Payload Builders ─────────────────────────────────────────────────────────

function buildUserAuditLogPayload({ action, performedBy, performedByRole, targetId, targetEmail, targetPhoneNumber }) {
  return {
    action,
    createdAt: serverTimestamp(),
    performedBy,
    performedByRole,
    status: 'SUCCESS',
    targetId,
    targetEmail,
    targetPhoneNumber: targetPhoneNumber || null,
    targetRole: USER_ROLES.USER,
  };
}

function buildLockedPhonePayload({ existingLock, phoneNumber, reason, uid }) {
  return {
    inviteId: existingLock?.inviteId || null,
    lockedAt: existingLock?.lockedAt || serverTimestamp(),
    lockedBy: existingLock?.lockedBy || 'system',
    reason,
    releasedAt: null,
    releasedBy: null,
    role: USER_ROLES.USER,
    status: IDENTITY_LOCK_STATUSES.LOCKED,
    type: IDENTITY_TYPES.PHONE,
    uid,
    updatedAt: serverTimestamp(),
    value: phoneNumber,
    valueNormalized: phoneNumber,
  };
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function assertUserRole(profile, uid) {
  if (!profile) {
    throw new UserManagementError('user-management/not-found', 'This user profile does not exist.');
  }

  if (profile.role !== USER_ROLES.USER) {
    throw new UserManagementError(
      'user-management/invalid-role',
      'This profile does not belong to a regular user. Use Admin Management for admin accounts.',
    );
  }

  return profile;
}

async function checkPhoneLockAvailability({ uid, phoneNumber, transaction }) {
  if (!phoneNumber) return null;

  const lockRef = getIdentityLockRef(buildIdentityDocumentId(IDENTITY_TYPES.PHONE, phoneNumber));
  const lockSnap = transaction
    ? await transaction.get(lockRef)
    : await getDoc(lockRef);

  const lock = lockSnap.exists() ? lockSnap.data() : null;

  if (
    lock
    && lock.status !== IDENTITY_LOCK_STATUSES.RELEASED
    && lock.uid !== uid
  ) {
    throw new UserManagementError('user-management/phone-conflict', PHONE_IN_USE_MESSAGE);
  }

  return { lock, lockRef };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * List users with role == "USER".
 * Supports optional status filter, search by email prefix or phone exact match,
 * and cursor-based pagination.
 *
 * Search strategy:
 *   - email: prefix query on emailLower (Firestore range query)
 *   - phone: exact match on phoneNumber
 *   - name: prefix query on name (case-sensitive, Firestore limitation documented)
 *
 * When a search term is active, cursor-pagination is disabled to avoid
 * compound index conflicts with range queries.
 */
export async function listUsers({ status = 'ALL', cursor = null, searchField = null, searchTerm = '' } = {}, viewer) {
  requireAdminOrSuperAdmin(viewer);

  const constraints = [where('role', '==', USER_ROLES.USER)];

  if (status && status !== 'ALL') {
    constraints.push(where('status', '==', status));
  }

  const normalizedTerm = searchTerm.trim();

  if (normalizedTerm && searchField) {
    if (searchField === 'email') {
      const lower = normalizedTerm.toLowerCase();
      constraints.push(where('emailLower', '>=', lower));
      constraints.push(where('emailLower', '<=', lower + '\uf8ff'));
      constraints.push(orderBy('emailLower'));
    } else if (searchField === 'phoneNumber') {
      const digits = normalizePhoneNumber(normalizedTerm);
      if (digits) {
        constraints.push(where('phoneNumber', '==', digits));
      }
    } else if (searchField === 'name') {
      constraints.push(where('name', '>=', normalizedTerm));
      constraints.push(where('name', '<=', normalizedTerm + '\uf8ff'));
      constraints.push(orderBy('name'));
    }

    // When searching, fetch a larger bounded set; pagination resets on new search
    constraints.push(limit(PAGE_SIZE));
  } else {
    // Normal paginated listing — order by createdAt descending
    constraints.push(orderBy('createdAt', 'desc'));

    if (cursor) {
      constraints.push(startAfter(cursor));
    }

    constraints.push(limit(PAGE_SIZE + 1)); // +1 to detect hasNextPage
  }

  const snapshot = await getDocs(query(collection(db, USERS_COLLECTION), ...constraints));

  const docs = snapshot.docs;
  const hasMore = !normalizedTerm && docs.length > PAGE_SIZE;
  const resultDocs = hasMore ? docs.slice(0, PAGE_SIZE) : docs;

  const users = resultDocs.map((d) => ({ id: d.id, ...d.data() }));
  const lastVisible = resultDocs.length > 0 ? resultDocs[resultDocs.length - 1] : null;

  return { users, hasMore, lastVisible };
}

/**
 * Fetch a single user by UID. Validates role == "USER".
 */
export async function getUserByUid(uid, viewer) {
  requireAdminOrSuperAdmin(viewer);

  const snapshot = await getDoc(getUserRef(uid));
  const profile = snapshot.exists() ? snapshot.data() : null;
  assertUserRole(profile, uid);

  return { id: snapshot.id, ...profile };
}

/**
 * Fetch a compact quiz attempt summary for a user.
 * Uses collectionGroup query (same pattern as adminAnalyticsService.js).
 */
export async function getUserQuizSummary(uid, viewer) {
  requireAdminOrSuperAdmin(viewer);

  const q = query(
    collectionGroup(db, 'quizAttempts'),
    where('userId', '==', uid),
    orderBy('startedAt', 'desc'),
    limit(50),
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return {
      totalAttempts: 0,
      completedAttempts: 0,
      bestScore: null,
      latestScore: null,
      lastAttemptAt: null,
    };
  }

  const attempts = snapshot.docs.map((d) => d.data());
  const completed = attempts.filter((a) => a.status === 'COMPLETED');

  return {
    totalAttempts: attempts.length,
    completedAttempts: completed.length,
    bestScore: completed.length > 0
      ? Math.max(...completed.map((a) => a.percentage || 0))
      : null,
    latestScore: completed.length > 0 ? (completed[0].percentage ?? null) : null,
    lastAttemptAt: attempts[0]?.startedAt || null,
  };
}

/**
 * Update a user's name. Uses transaction to atomically write user doc + audit log.
 */
export async function updateUserName({ uid, name, viewer }) {
  requireAdminOrSuperAdmin(viewer);

  const userRef = getUserRef(uid);
  const auditRef = getAuditLogRef();

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userRef);
    const profile = assertUserRole(snap.exists() ? snap.data() : null, uid);

    const trimmedName = toTitleCase(name) || toTitleCase(profile.name) || profile.email || 'User';

    transaction.update(userRef, {
      name: trimmedName,
      updatedAt: serverTimestamp(),
    });

    transaction.set(auditRef, buildUserAuditLogPayload({
      action: 'USER_UPDATED',
      performedBy: viewer.uid,
      performedByRole: viewer.role,
      targetId: uid,
      targetEmail: profile.email || profile.emailLower || '',
      targetPhoneNumber: profile.phoneNumber || null,
    }));
  });
}

/**
 * Update a user's phone number.
 * Validates identity lock BEFORE writing. Uses transaction to atomically
 * write user doc + identity lock update + audit log.
 */
export async function updateUserPhone({ uid, phoneNumber, viewer }) {
  requireAdminOrSuperAdmin(viewer);

  const normalizedPhone = normalizePhoneNumber(phoneNumber);

  if (phoneNumber?.trim() && !isValidPhoneNumber(phoneNumber)) {
    throw new UserManagementError(
      'user-management/phone-invalid',
      'Phone number must be exactly 10 digits.',
    );
  }

  const userRef = getUserRef(uid);
  const auditRef = getAuditLogRef();

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userRef);
    const profile = assertUserRole(snap.exists() ? snap.data() : null, uid);

    const currentPhone = profile.phoneNumber || '';
    const nextPhone = normalizedPhone || currentPhone || '';

    // Check lock availability if phone is changing
    if (normalizedPhone && normalizedPhone !== currentPhone) {
      await checkPhoneLockAvailability({ uid, phoneNumber: normalizedPhone, transaction });
    }

    // Release old phone lock if phone changed
    if (currentPhone && normalizedPhone && currentPhone !== normalizedPhone) {
      const oldLockRef = getIdentityLockRef(buildIdentityDocumentId(IDENTITY_TYPES.PHONE, currentPhone));
      const oldLockSnap = await transaction.get(oldLockRef);

      if (oldLockSnap.exists()) {
        transaction.set(oldLockRef, {
          ...oldLockSnap.data(),
          reason: IDENTITY_LOCK_REASONS.MANUALLY_RELEASED,
          releasedAt: serverTimestamp(),
          releasedBy: viewer.uid,
          status: IDENTITY_LOCK_STATUSES.RELEASED,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
    }

    // Set / update new phone lock
    if (normalizedPhone) {
      const newLockRef = getIdentityLockRef(buildIdentityDocumentId(IDENTITY_TYPES.PHONE, normalizedPhone));
      const newLockSnap = await transaction.get(newLockRef);
      const existingLock = newLockSnap.exists() ? newLockSnap.data() : null;

      transaction.set(newLockRef, buildLockedPhonePayload({
        existingLock,
        phoneNumber: normalizedPhone,
        reason: IDENTITY_LOCK_REASONS.ACTIVE_ACCOUNT,
        uid,
      }), { merge: true });
    }

    transaction.update(userRef, {
      phoneNumber: nextPhone || null,
      updatedAt: serverTimestamp(),
    });

    transaction.set(auditRef, buildUserAuditLogPayload({
      action: 'USER_PHONE_UPDATED',
      performedBy: viewer.uid,
      performedByRole: viewer.role,
      targetId: uid,
      targetEmail: profile.email || profile.emailLower || '',
      targetPhoneNumber: nextPhone || null,
    }));
  });
}

/**
 * Block a user. Updates status to BLOCKED.
 * Updates phone identity lock to BLOCKED_ACCOUNT reason if phone exists.
 * Uses transaction to atomically write all changes + audit log.
 */
export async function blockUser({ uid, viewer }) {
  requireAdminOrSuperAdmin(viewer);

  const userRef = getUserRef(uid);
  const auditRef = getAuditLogRef();

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userRef);
    const profile = assertUserRole(snap.exists() ? snap.data() : null, uid);

    if (profile.status === USER_STATUSES.BLOCKED) {
      throw new UserManagementError(
        'user-management/already-blocked',
        'This user is already blocked.',
      );
    }

    // Update phone lock to BLOCKED_ACCOUNT if phone exists
    if (profile.phoneNumber) {
      const phoneLockRef = getIdentityLockRef(
        buildIdentityDocumentId(IDENTITY_TYPES.PHONE, profile.phoneNumber),
      );
      const phoneLockSnap = await transaction.get(phoneLockRef);
      const existingLock = phoneLockSnap.exists() ? phoneLockSnap.data() : null;

      transaction.set(phoneLockRef, buildLockedPhonePayload({
        existingLock,
        phoneNumber: profile.phoneNumber,
        reason: IDENTITY_LOCK_REASONS.BLOCKED_ACCOUNT,
        uid,
      }), { merge: true });
    }

    transaction.update(userRef, {
      status: USER_STATUSES.BLOCKED,
      updatedAt: serverTimestamp(),
    });

    transaction.set(auditRef, buildUserAuditLogPayload({
      action: 'USER_BLOCKED',
      performedBy: viewer.uid,
      performedByRole: viewer.role,
      targetId: uid,
      targetEmail: profile.email || profile.emailLower || '',
      targetPhoneNumber: profile.phoneNumber || null,
    }));
  });
}

/**
 * Unblock a user. Updates status to ACTIVE.
 * Restores phone identity lock to ACTIVE_ACCOUNT reason.
 * Uses transaction to atomically write all changes + audit log.
 */
export async function unblockUser({ uid, viewer }) {
  requireAdminOrSuperAdmin(viewer);

  const userRef = getUserRef(uid);
  const auditRef = getAuditLogRef();

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userRef);
    const profile = assertUserRole(snap.exists() ? snap.data() : null, uid);

    if (profile.status !== USER_STATUSES.BLOCKED) {
      throw new UserManagementError(
        'user-management/not-blocked',
        'This user is not currently blocked.',
      );
    }

    // Restore phone lock to ACTIVE_ACCOUNT if phone exists
    if (profile.phoneNumber) {
      const phoneLockRef = getIdentityLockRef(
        buildIdentityDocumentId(IDENTITY_TYPES.PHONE, profile.phoneNumber),
      );
      const phoneLockSnap = await transaction.get(phoneLockRef);
      const existingLock = phoneLockSnap.exists() ? phoneLockSnap.data() : null;

      transaction.set(phoneLockRef, buildLockedPhonePayload({
        existingLock,
        phoneNumber: profile.phoneNumber,
        reason: IDENTITY_LOCK_REASONS.ACTIVE_ACCOUNT,
        uid,
      }), { merge: true });
    }

    transaction.update(userRef, {
      status: USER_STATUSES.ACTIVE,
      updatedAt: serverTimestamp(),
    });

    transaction.set(auditRef, buildUserAuditLogPayload({
      action: 'USER_UNBLOCKED',
      performedBy: viewer.uid,
      performedByRole: viewer.role,
      targetId: uid,
      targetEmail: profile.email || profile.emailLower || '',
      targetPhoneNumber: profile.phoneNumber || null,
    }));
  });
}
