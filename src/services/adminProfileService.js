import { updateProfile } from 'firebase/auth';
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { USER_STATUSES } from '../constants/auth';
import { auth, db } from '../config/firebase';
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
  PHONE_LOCKED: 'Phone number can only be set once. Ask a Super Admin if it needs to be changed.',
  UNAUTHENTICATED: 'Your admin session expired. Please sign in again.',
};

function normalizeStatus(status) {
  return status?.toUpperCase() || USER_STATUSES.ACTIVE;
}

function normalizePhoneNumber(phoneNumber) {
  if (!phoneNumber) return '';

  const digits = String(phoneNumber).replace(/\D/g, '');
  if (!digits) return '';

  return String(phoneNumber).trim().startsWith('+')
    ? `+${digits}`
    : digits;
}

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

  const trimmedName = name?.trim() || existingProfile.name || authUser.displayName || authUser.email || 'Admin User';
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const currentPhone = existingProfile.phoneNumber || '';

  if (currentPhone && normalizedPhone && normalizedPhone !== currentPhone) {
    throw new AdminProfileError('PHONE_LOCKED', PROFILE_MESSAGES.PHONE_LOCKED);
  }

  if (currentPhone && !normalizedPhone) {
    throw new AdminProfileError('PHONE_LOCKED', PROFILE_MESSAGES.PHONE_LOCKED);
  }

  const nextPhone = currentPhone || normalizedPhone || null;

  await runTransaction(db, async (transaction) => {
    const currentSnapshot = await transaction.get(userReference);

    if (!currentSnapshot.exists()) {
      throw new AdminProfileError('NOT_FOUND', PROFILE_MESSAGES.NOT_FOUND);
    }

    validateUpdatableProfile(currentSnapshot.data());

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
