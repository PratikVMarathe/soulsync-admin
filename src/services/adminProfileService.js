import { updateProfile } from 'firebase/auth';
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import {
  IDENTITY_LOCK_STATUSES,
  IDENTITY_TYPES,
  USER_STATUSES,
} from '../constants/auth';
import { auth, db } from '../config/firebase';
import {
  buildPhoneIdentityDocumentId,
  isValidPhoneNumber,
  normalizePhoneNumber,
} from '../utils/identity';
import { toTitleCase } from '../utils/text';
import { resolveAdminSession } from './adminSession';

class AdminProfileError extends Error {
  constructor(code, publicMessage) {
    super(publicMessage);
    this.name = 'AdminProfileError';
    this.code = code;
    this.publicMessage = publicMessage;
  }
}

const PROFILE_MESSAGES = {
  BLOCKED: 'This admin account is blocked and cannot be updated right now.',
  DELETED: 'This admin account was removed and cannot be updated right now.',
  NOT_FOUND: 'We could not find your admin profile in Firestore.',
  PHONE_IN_USE: 'This phone number is already locked for another SoulSync account or admin invite.',
  PHONE_INVALID: 'Phone number must be exactly 10 digits.',
  PHONE_LOCKED: 'Phone number can only be set once. Ask a Super Admin if it needs to be changed.',
  UNAUTHENTICATED: 'Your admin session expired. Please sign in again.',
};

function normalizeStatus(status) {
  return status?.toUpperCase() || USER_STATUSES.ACTIVE;
}

const getIdentityLockReference = (documentId) => doc(db, 'identityLocks', documentId);

const buildPhoneIdentityLockPayload = ({ existingLock, phoneNumber, role, uid }) => ({
  type: IDENTITY_TYPES.PHONE,
  value: phoneNumber,
  valueNormalized: phoneNumber,
  uid,
  role,
  status: IDENTITY_LOCK_STATUSES.LOCKED,
  reason: 'ACTIVE_ACCOUNT',
  lockedBy: existingLock?.lockedBy || 'system',
  lockedAt: existingLock?.lockedAt || serverTimestamp(),
  releasedAt: null,
  releasedBy: null,
  updatedAt: serverTimestamp(),
});

function validateUpdatableProfile(profile) {
  if (!profile) {
    throw new AdminProfileError('NOT_FOUND', PROFILE_MESSAGES.NOT_FOUND);
  }

  const status = normalizeStatus(profile.status);

  if (status === USER_STATUSES.BLOCKED) {
    throw new AdminProfileError('BLOCKED', PROFILE_MESSAGES.BLOCKED);
  }

  if (status === USER_STATUSES.SOFT_DELETED || profile.isDeleted) {
    throw new AdminProfileError('DELETED', PROFILE_MESSAGES.DELETED);
  }

  return profile;
}

export async function updateCurrentAdminProfile({ name, phoneNumber }) {
  const authUser = auth.currentUser;

  if (!authUser) {
    throw new AdminProfileError('UNAUTHENTICATED', PROFILE_MESSAGES.UNAUTHENTICATED);
  }

  const userReference = doc(db, 'users', authUser.uid);
  const snapshot = await getDoc(userReference);
  const existingProfile = validateUpdatableProfile(snapshot.exists() ? snapshot.data() : null);

  const trimmedName = toTitleCase(name)
    || toTitleCase(existingProfile.name)
    || toTitleCase(authUser.displayName)
    || authUser.email
    || 'Admin User';
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const currentPhone = existingProfile.phoneNumber || '';
  const wantsToSetPhone = !currentPhone && Boolean(phoneNumber?.trim());

  if (wantsToSetPhone && !isValidPhoneNumber(phoneNumber)) {
    throw new AdminProfileError('PHONE_INVALID', PROFILE_MESSAGES.PHONE_INVALID);
  }

  if (currentPhone && normalizedPhone && normalizedPhone !== currentPhone) {
    throw new AdminProfileError('PHONE_LOCKED', PROFILE_MESSAGES.PHONE_LOCKED);
  }

  if (currentPhone && !normalizedPhone) {
    throw new AdminProfileError('PHONE_LOCKED', PROFILE_MESSAGES.PHONE_LOCKED);
  }

  const nextPhone = currentPhone || normalizedPhone || null;
  const phoneLockDocumentId = nextPhone ? buildPhoneIdentityDocumentId(nextPhone) : null;

  await runTransaction(db, async (transaction) => {
    const currentSnapshot = await transaction.get(userReference);

    if (!currentSnapshot.exists()) {
      throw new AdminProfileError('NOT_FOUND', PROFILE_MESSAGES.NOT_FOUND);
    }

    validateUpdatableProfile(currentSnapshot.data());

    if (phoneLockDocumentId) {
      const phoneLockReference = getIdentityLockReference(phoneLockDocumentId);
      const phoneLockSnapshot = await transaction.get(phoneLockReference);
      const existingLock = phoneLockSnapshot.exists() ? phoneLockSnapshot.data() : null;

      if (existingLock && existingLock.uid && existingLock.uid !== authUser.uid) {
        throw new AdminProfileError('PHONE_IN_USE', PROFILE_MESSAGES.PHONE_IN_USE);
      }

      if (existingLock && !existingLock.uid) {
        throw new AdminProfileError('PHONE_IN_USE', PROFILE_MESSAGES.PHONE_IN_USE);
      }

      transaction.set(
        phoneLockReference,
        buildPhoneIdentityLockPayload({
          existingLock,
          phoneNumber: nextPhone,
          role: existingProfile.role,
          uid: authUser.uid,
        }),
        { merge: true },
      );
    }

    transaction.update(userReference, {
      name: trimmedName,
      phoneNumber: nextPhone,
      updatedAt: serverTimestamp(),
    });
  });

  if (trimmedName && authUser.displayName !== trimmedName) {
    await updateProfile(authUser, { displayName: trimmedName });
  }

  return resolveAdminSession(authUser);
}
