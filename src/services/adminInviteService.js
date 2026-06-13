import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import {
  ADMIN_INVITE_STATUSES,
  IDENTITY_LOCK_REASONS,
  IDENTITY_LOCK_STATUSES,
  IDENTITY_TYPES,
  USER_ROLES,
} from '../constants/auth';
import { db } from '../config/firebase';
import {
  buildIdentityDocumentId,
  isValidEmailAddress,
  isValidPhoneNumber,
  normalizeEmail,
  normalizePhoneNumber,
} from '../utils/identity';
import { toTitleCase } from '../utils/text';
import { attachUserDisplayNames, resolveUserDisplayNameById } from './userLookupService';

const USERS_COLLECTION = 'users';
const ADMIN_INVITES_COLLECTION = 'adminInvites';
const IDENTITY_LOCKS_COLLECTION = 'identityLocks';
const AUDIT_LOGS_COLLECTION = 'auditLogs';

const RESERVED_INVITE_STATUSES = [
  ADMIN_INVITE_STATUSES.PENDING,
  ADMIN_INVITE_STATUSES.ACCEPTED,
  ADMIN_INVITE_STATUSES.EXPIRED,
];

const EMAIL_IN_USE_MESSAGE = 'This email is already registered or reserved inside SoulSync.';
const PHONE_IN_USE_MESSAGE = 'This phone number is already registered or reserved inside SoulSync.';

export class AdminInviteError extends Error {
  constructor(code, publicMessage) {
    super(publicMessage);
    this.name = 'AdminInviteError';
    this.code = code;
    this.publicMessage = publicMessage;
  }
}

function requireAdminOrSuperAdmin(viewer) {
  if (![USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN].includes(viewer?.role)) {
    throw new AdminInviteError(
      'admin-invite/forbidden',
      'Only Admin and Super Admin accounts can access admin management.',
    );
  }
}

function requireSuperAdmin(viewer) {
  if (viewer?.role !== USER_ROLES.SUPER_ADMIN) {
    throw new AdminInviteError(
      'admin-invite/forbidden',
      'Only the Super Admin can manage admin invites or edit admin identities.',
    );
  }
}

function getUserReference(uid) {
  return doc(db, USERS_COLLECTION, uid);
}

function getIdentityLockReference(documentId) {
  return doc(db, IDENTITY_LOCKS_COLLECTION, documentId);
}

function getInviteReference(inviteId) {
  return doc(db, ADMIN_INVITES_COLLECTION, inviteId);
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function buildExpiryTimestamp() {
  return Timestamp.fromDate(new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)));
}

export function getDerivedInviteStatus(invite) {
  const baseStatus = String(invite?.status || '').toUpperCase();

  if (!invite) return ADMIN_INVITE_STATUSES.PENDING;

  if (baseStatus === ADMIN_INVITE_STATUSES.CANCELLED || baseStatus === ADMIN_INVITE_STATUSES.ACCEPTED) {
    return baseStatus;
  }

  if (invite?.expiresAt && toMillis(invite.expiresAt) <= Date.now()) {
    return ADMIN_INVITE_STATUSES.EXPIRED;
  }

  return baseStatus || ADMIN_INVITE_STATUSES.PENDING;
}

function buildInvitePayload({ emailLower, invitedByName, name, phoneNumber, viewer }) {
  return {
    acceptedAt: null,
    acceptedByUid: null,
    cancelledAt: null,
    cancelledBy: null,
    createdAt: serverTimestamp(),
    email: emailLower,
    emailLower,
    expiresAt: buildExpiryTimestamp(),
    invitedBy: viewer.uid,
    invitedByName,
    name: name || null,
    phoneNumber,
    role: USER_ROLES.ADMIN,
    status: ADMIN_INVITE_STATUSES.PENDING,
    updatedAt: serverTimestamp(),
  };
}

function buildInviteLockPayload({
  inviteId,
  lockedAt,
  lockedBy,
  role,
  type,
  value,
}) {
  return {
    inviteId,
    lockedAt: lockedAt || serverTimestamp(),
    lockedBy,
    reason: IDENTITY_LOCK_REASONS.ADMIN_INVITE,
    releasedAt: null,
    releasedBy: null,
    role,
    status: IDENTITY_LOCK_STATUSES.LOCKED,
    type,
    uid: null,
    updatedAt: serverTimestamp(),
    value,
    valueNormalized: value,
  };
}

function buildActiveIdentityLockPayload({
  existingLock,
  lockedBy = 'system',
  role,
  type,
  uid,
  value,
}) {
  return {
    inviteId: existingLock?.inviteId || null,
    lockedAt: existingLock?.lockedAt || serverTimestamp(),
    lockedBy: existingLock?.lockedBy || lockedBy,
    reason: IDENTITY_LOCK_REASONS.ACTIVE_ACCOUNT,
    releasedAt: null,
    releasedBy: null,
    role,
    status: IDENTITY_LOCK_STATUSES.LOCKED,
    type,
    uid,
    updatedAt: serverTimestamp(),
    value,
    valueNormalized: value,
  };
}

function buildReleasedIdentityLockPayload({
  existingLock,
  reason = IDENTITY_LOCK_REASONS.ADMIN_INVITE_CANCELLED,
  releasedBy,
}) {
  return {
    inviteId: existingLock?.inviteId || null,
    lockedAt: existingLock?.lockedAt || serverTimestamp(),
    lockedBy: existingLock?.lockedBy || 'system',
    reason,
    releasedAt: serverTimestamp(),
    releasedBy,
    role: existingLock?.role || USER_ROLES.ADMIN,
    status: IDENTITY_LOCK_STATUSES.RELEASED,
    type: existingLock?.type,
    uid: existingLock?.uid || null,
    updatedAt: serverTimestamp(),
    value: existingLock?.value,
    valueNormalized: existingLock?.valueNormalized || existingLock?.value,
  };
}

function buildAuditLogPayload({
  action,
  performedBy,
  performedByRole,
  targetEmail,
  targetPhoneNumber = null,
  targetRole = USER_ROLES.ADMIN,
}) {
  return {
    action,
    createdAt: serverTimestamp(),
    performedBy,
    performedByRole,
    status: 'SUCCESS',
    targetEmail,
    targetPhoneNumber,
    targetRole,
  };
}

async function queryDocuments(collectionName, filters, pageLimit = 20) {
  const constraints = filters.map(([field, operator, value]) => where(field, operator, value));
  const snapshot = await getDocs(query(collection(db, collectionName), ...constraints, limit(pageLimit)));
  return snapshot.docs.map((documentSnapshot) => ({
    id: documentSnapshot.id,
    ...documentSnapshot.data(),
  }));
}

async function checkUserConflicts({ emailLower, excludeUserId = null, phoneNumber }) {
  const [emailUsers, phoneUsers] = await Promise.all([
    emailLower ? queryDocuments(USERS_COLLECTION, [['emailLower', '==', emailLower]]) : Promise.resolve([]),
    phoneNumber ? queryDocuments(USERS_COLLECTION, [['phoneNumber', '==', phoneNumber]]) : Promise.resolve([]),
  ]);

  if (emailUsers.some((user) => user.id !== excludeUserId)) {
    throw new AdminInviteError('admin-invite/email-conflict', EMAIL_IN_USE_MESSAGE);
  }

  if (phoneUsers.some((user) => user.id !== excludeUserId)) {
    throw new AdminInviteError('admin-invite/phone-conflict', PHONE_IN_USE_MESSAGE);
  }
}

async function checkInviteConflicts({
  emailLower,
  excludeInviteId = null,
  excludeUserId = null,
  phoneNumber,
}) {
  const [emailInvites, phoneInvites] = await Promise.all([
    emailLower ? queryDocuments(ADMIN_INVITES_COLLECTION, [['emailLower', '==', emailLower]]) : Promise.resolve([]),
    phoneNumber ? queryDocuments(ADMIN_INVITES_COLLECTION, [['phoneNumber', '==', phoneNumber]]) : Promise.resolve([]),
  ]);

  if (emailInvites.some((invite) => (
    invite.id !== excludeInviteId
    && invite.acceptedByUid !== excludeUserId
    && RESERVED_INVITE_STATUSES.includes(getDerivedInviteStatus(invite))
  ))) {
    throw new AdminInviteError('admin-invite/email-reserved', 'This email already has an admin invite.');
  }

  if (phoneInvites.some((invite) => (
    invite.id !== excludeInviteId
    && invite.acceptedByUid !== excludeUserId
    && RESERVED_INVITE_STATUSES.includes(getDerivedInviteStatus(invite))
  ))) {
    throw new AdminInviteError('admin-invite/phone-reserved', 'This phone number already has an admin invite.');
  }
}

async function checkIdentityLockConflicts({
  allowInviteId = null,
  allowUid = null,
  emailLower,
  phoneNumber,
}) {
  const [emailLockSnapshot, phoneLockSnapshot] = await Promise.all([
    emailLower ? getDoc(getIdentityLockReference(buildIdentityDocumentId(IDENTITY_TYPES.EMAIL, emailLower))) : Promise.resolve(null),
    phoneNumber ? getDoc(getIdentityLockReference(buildIdentityDocumentId(IDENTITY_TYPES.PHONE, phoneNumber))) : Promise.resolve(null),
  ]);

  const emailLock = emailLockSnapshot?.exists() ? emailLockSnapshot.data() : null;
  const phoneLock = phoneLockSnapshot?.exists() ? phoneLockSnapshot.data() : null;

  if (
    emailLock
    && emailLock.status !== IDENTITY_LOCK_STATUSES.RELEASED
    && emailLock.uid !== allowUid
    && emailLock.inviteId !== allowInviteId
  ) {
    throw new AdminInviteError('admin-invite/email-lock', EMAIL_IN_USE_MESSAGE);
  }

  if (
    phoneLock
    && phoneLock.status !== IDENTITY_LOCK_STATUSES.RELEASED
    && phoneLock.uid !== allowUid
    && phoneLock.inviteId !== allowInviteId
  ) {
    throw new AdminInviteError('admin-invite/phone-lock', PHONE_IN_USE_MESSAGE);
  }
}

async function ensureIdentityAvailability({
  emailLower,
  excludeInviteId = null,
  excludeUserId = null,
  phoneNumber,
}) {
  await checkUserConflicts({ emailLower, excludeUserId, phoneNumber });
  await checkInviteConflicts({
    emailLower,
    excludeInviteId,
    excludeUserId,
    phoneNumber,
  });
  await checkIdentityLockConflicts({
    allowInviteId: excludeInviteId,
    allowUid: excludeUserId,
    emailLower,
    phoneNumber,
  });
}

export async function verifyAdminIdentityFieldAvailability({
  excludeInviteId = null,
  excludeUserId = null,
  field,
  value,
  viewer,
}) {
  requireSuperAdmin(viewer);

  if (field === 'email') {
    const emailLower = normalizeEmail(value);

    if (!isValidEmailAddress(emailLower)) {
      throw new AdminInviteError(
        'admin-invite/email-invalid',
        'Enter a valid email address before verifying it.',
      );
    }

    await ensureIdentityAvailability({
      emailLower,
      excludeInviteId,
      excludeUserId,
    });

    return {
      field,
      normalizedValue: emailLower,
      successMessage: 'Email is available for this admin record.',
    };
  }

  if (field === 'phoneNumber') {
    const phoneNumber = normalizePhoneNumber(value);

    if (!isValidPhoneNumber(value)) {
      throw new AdminInviteError(
        'admin-invite/phone-invalid',
        'Phone number must be exactly 10 digits before verification.',
      );
    }

    await ensureIdentityAvailability({
      excludeInviteId,
      excludeUserId,
      phoneNumber,
    });

    return {
      field,
      normalizedValue: phoneNumber,
      successMessage: 'Phone number is available for this admin record.',
    };
  }

  throw new AdminInviteError(
    'admin-invite/unknown-field',
    'This field cannot be verified yet.',
  );
}

export async function verifyAdminInviteFieldAvailability({ field, value, viewer }) {
  return verifyAdminIdentityFieldAvailability({ field, value, viewer });
}

export async function createAdminInvite({ email, name, phoneNumber, viewer }) {
  requireSuperAdmin(viewer);

  const emailLower = normalizeEmail(email);
  const normalizedPhone = normalizePhoneNumber(phoneNumber);

  if (!isValidEmailAddress(emailLower)) {
    throw new AdminInviteError('admin-invite/email-invalid', 'Enter a valid email address.');
  }

  if (!isValidPhoneNumber(phoneNumber)) {
    throw new AdminInviteError('admin-invite/phone-invalid', 'Phone number must be exactly 10 digits.');
  }

  await ensureIdentityAvailability({
    emailLower,
    phoneNumber: normalizedPhone,
  });

  const invitesCollection = collection(db, ADMIN_INVITES_COLLECTION);
  const auditLogsCollection = collection(db, AUDIT_LOGS_COLLECTION);
  const inviteReference = doc(invitesCollection);
  const auditReference = doc(auditLogsCollection);
  const emailLockReference = getIdentityLockReference(buildIdentityDocumentId(IDENTITY_TYPES.EMAIL, emailLower));
  const phoneLockReference = getIdentityLockReference(buildIdentityDocumentId(IDENTITY_TYPES.PHONE, normalizedPhone));
  const invitedByName = viewer.displayName || viewer.email || 'Super Admin';

  await runTransaction(db, async (transaction) => {
    const emailLockSnapshot = await transaction.get(emailLockReference);
    const phoneLockSnapshot = await transaction.get(phoneLockReference);

    if (emailLockSnapshot.exists() && emailLockSnapshot.data()?.status !== IDENTITY_LOCK_STATUSES.RELEASED) {
      throw new AdminInviteError('admin-invite/email-lock', EMAIL_IN_USE_MESSAGE);
    }

    if (phoneLockSnapshot.exists() && phoneLockSnapshot.data()?.status !== IDENTITY_LOCK_STATUSES.RELEASED) {
      throw new AdminInviteError('admin-invite/phone-lock', PHONE_IN_USE_MESSAGE);
    }

    transaction.set(inviteReference, buildInvitePayload({
      emailLower,
      invitedByName,
      name: toTitleCase(name) || '',
      phoneNumber: normalizedPhone,
      viewer,
    }));

    transaction.set(emailLockReference, buildInviteLockPayload({
      inviteId: inviteReference.id,
      lockedBy: viewer.uid,
      role: USER_ROLES.ADMIN,
      type: IDENTITY_TYPES.EMAIL,
      value: emailLower,
    }));

    transaction.set(phoneLockReference, buildInviteLockPayload({
      inviteId: inviteReference.id,
      lockedBy: viewer.uid,
      role: USER_ROLES.ADMIN,
      type: IDENTITY_TYPES.PHONE,
      value: normalizedPhone,
    }));

    transaction.set(auditReference, buildAuditLogPayload({
      action: 'ADMIN_INVITE_CREATED',
      performedBy: viewer.uid,
      performedByRole: viewer.role,
      targetEmail: emailLower,
      targetPhoneNumber: normalizedPhone,
      targetRole: USER_ROLES.ADMIN,
    }));
  });

  return {
    emailLower,
    inviteId: inviteReference.id,
    phoneNumber: normalizedPhone,
  };
}

export async function loadAdminManagementSnapshot(viewer) {
  requireAdminOrSuperAdmin(viewer);

  const [adminsSnapshot, invitesSnapshot] = await Promise.all([
    getDocs(query(
      collection(db, USERS_COLLECTION),
      where('role', 'in', [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN]),
      limit(100),
    )),
    getDocs(query(
      collection(db, ADMIN_INVITES_COLLECTION),
      limit(100),
    )),
  ]);

  const admins = adminsSnapshot.docs.map((documentSnapshot) => ({
    id: documentSnapshot.id,
    ...documentSnapshot.data(),
  }));

  const invites = invitesSnapshot.docs.map((documentSnapshot) => ({
    id: documentSnapshot.id,
    ...documentSnapshot.data(),
    derivedStatus: getDerivedInviteStatus(documentSnapshot.data()),
  }));

  const adminsWithCreatorNames = await attachUserDisplayNames(admins, {
    idField: 'createdBy',
    targetField: 'createdByName',
  });

  return {
    admins: adminsWithCreatorNames,
    invites,
  };
}

export async function loadManagedAdminProfile({ adminId, viewer }) {
  requireSuperAdmin(viewer);

  const snapshot = await getDoc(getUserReference(adminId));

  if (!snapshot.exists()) {
    throw new AdminInviteError('admin-profile/not-found', 'This admin profile no longer exists.');
  }

  const profile = snapshot.data();

  if (![USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN].includes(profile.role)) {
    throw new AdminInviteError('admin-profile/invalid-role', 'Only admin records can be edited here.');
  }

  return {
    id: snapshot.id,
    createdByName: await resolveUserDisplayNameById(profile.createdBy),
    ...profile,
  };
}

export async function updateManagedAdminProfile({
  adminId,
  email,
  name,
  phoneNumber,
  viewer,
}) {
  requireSuperAdmin(viewer);

  const existingProfile = await loadManagedAdminProfile({ adminId, viewer });
  const emailLower = normalizeEmail(email);
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const currentEmailLower = normalizeEmail(existingProfile.emailLower || existingProfile.email);
  const currentPhone = normalizePhoneNumber(existingProfile.phoneNumber);
  const nextPhone = normalizedPhone || currentPhone || null;
  const emailChanged = emailLower !== currentEmailLower;
  const phoneChanged = nextPhone !== currentPhone;

  if (!isValidEmailAddress(emailLower)) {
    throw new AdminInviteError('admin-profile/email-invalid', 'Enter a valid email address.');
  }

  if (phoneNumber?.trim() && !isValidPhoneNumber(phoneNumber)) {
    throw new AdminInviteError('admin-profile/phone-invalid', 'Phone number must be exactly 10 digits.');
  }

  if (emailChanged || phoneChanged) {
    await ensureIdentityAvailability({
      emailLower: emailChanged ? emailLower : null,
      excludeUserId: adminId,
      phoneNumber: phoneChanged ? nextPhone : null,
    });
  }

  const userReference = getUserReference(adminId);
  const emailLockReference = getIdentityLockReference(buildIdentityDocumentId(IDENTITY_TYPES.EMAIL, emailLower));
  const phoneLockReference = nextPhone
    ? getIdentityLockReference(buildIdentityDocumentId(IDENTITY_TYPES.PHONE, nextPhone))
    : null;
  const auditReference = doc(collection(db, AUDIT_LOGS_COLLECTION));

  await runTransaction(db, async (transaction) => {
    const userSnapshot = await transaction.get(userReference);
    if (!userSnapshot.exists()) {
      throw new AdminInviteError('admin-profile/not-found', 'This admin profile no longer exists.');
    }

    const existingProfile = userSnapshot.data();

    if (![USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN].includes(existingProfile.role)) {
      throw new AdminInviteError('admin-profile/invalid-role', 'Only admin records can be edited here.');
    }

    const currentEmailLower = normalizeEmail(existingProfile.emailLower || existingProfile.email);
    const currentPhone = normalizePhoneNumber(existingProfile.phoneNumber);
    const trimmedName = toTitleCase(name)
      || toTitleCase(existingProfile.name)
      || existingProfile.email
      || 'Admin User';

    const [nextEmailLockSnapshot, nextPhoneLockSnapshot] = await Promise.all([
      transaction.get(emailLockReference),
      phoneLockReference ? transaction.get(phoneLockReference) : Promise.resolve(null),
    ]);

    const nextEmailLock = nextEmailLockSnapshot.exists() ? nextEmailLockSnapshot.data() : null;
    const nextPhoneLock = nextPhoneLockSnapshot?.exists() ? nextPhoneLockSnapshot.data() : null;

    if (
      nextEmailLock
      && nextEmailLock.status !== IDENTITY_LOCK_STATUSES.RELEASED
      && nextEmailLock.uid !== adminId
    ) {
      throw new AdminInviteError('admin-profile/email-lock', EMAIL_IN_USE_MESSAGE);
    }

    if (
      nextPhoneLock
      && nextPhoneLock.status !== IDENTITY_LOCK_STATUSES.RELEASED
      && nextPhoneLock.uid !== adminId
    ) {
      throw new AdminInviteError('admin-profile/phone-lock', PHONE_IN_USE_MESSAGE);
    }

    transaction.set(emailLockReference, buildActiveIdentityLockPayload({
      existingLock: nextEmailLock,
      role: existingProfile.role,
      type: IDENTITY_TYPES.EMAIL,
      uid: adminId,
      value: emailLower,
    }), { merge: true });

    if (phoneLockReference && nextPhone) {
      transaction.set(phoneLockReference, buildActiveIdentityLockPayload({
        existingLock: nextPhoneLock,
        role: existingProfile.role,
        type: IDENTITY_TYPES.PHONE,
        uid: adminId,
        value: nextPhone,
      }), { merge: true });
    }

    if (currentEmailLower && currentEmailLower !== emailLower) {
      const currentEmailLockReference = getIdentityLockReference(
        buildIdentityDocumentId(IDENTITY_TYPES.EMAIL, currentEmailLower),
      );
      const currentEmailLockSnapshot = await transaction.get(currentEmailLockReference);
      const currentEmailLock = currentEmailLockSnapshot.exists() ? currentEmailLockSnapshot.data() : null;

      if (currentEmailLock) {
        transaction.set(currentEmailLockReference, buildReleasedIdentityLockPayload({
          existingLock: currentEmailLock,
          reason: IDENTITY_LOCK_REASONS.MANUALLY_RELEASED,
          releasedBy: viewer.uid,
        }), { merge: true });
      }
    }

    if (currentPhone && currentPhone !== nextPhone) {
      const currentPhoneLockReference = getIdentityLockReference(
        buildIdentityDocumentId(IDENTITY_TYPES.PHONE, currentPhone),
      );
      const currentPhoneLockSnapshot = await transaction.get(currentPhoneLockReference);
      const currentPhoneLock = currentPhoneLockSnapshot.exists() ? currentPhoneLockSnapshot.data() : null;

      if (currentPhoneLock) {
        transaction.set(currentPhoneLockReference, buildReleasedIdentityLockPayload({
          existingLock: currentPhoneLock,
          reason: IDENTITY_LOCK_REASONS.MANUALLY_RELEASED,
          releasedBy: viewer.uid,
        }), { merge: true });
      }
    }

    transaction.update(userReference, {
      email: emailLower,
      emailLower,
      name: trimmedName,
      phoneNumber: nextPhone,
      updatedAt: serverTimestamp(),
    });

    transaction.set(auditReference, buildAuditLogPayload({
      action: 'ADMIN_PROFILE_UPDATED',
      performedBy: viewer.uid,
      performedByRole: viewer.role,
      targetEmail: emailLower,
      targetPhoneNumber: nextPhone,
      targetRole: existingProfile.role,
    }));
  });

  return loadManagedAdminProfile({ adminId, viewer });
}

export async function updateAdminInviteStatus({
  action,
  inviteId,
  viewer,
}) {
  requireSuperAdmin(viewer);

  const inviteReference = getInviteReference(inviteId);
  const inviteSnapshot = await getDoc(inviteReference);

  if (!inviteSnapshot.exists()) {
    throw new AdminInviteError('admin-invite/not-found', 'This admin invite no longer exists.');
  }

  const invite = inviteSnapshot.data();
  const derivedStatus = getDerivedInviteStatus(invite);
  const emailLower = normalizeEmail(invite.emailLower || invite.email);
  const normalizedPhone = normalizePhoneNumber(invite.phoneNumber);

  if (action === 'cancel' && derivedStatus !== ADMIN_INVITE_STATUSES.PENDING) {
    throw new AdminInviteError('admin-invite/cancel-invalid', 'Only pending invites can be cancelled.');
  }

  if (
    action === 'resend'
    && ![ADMIN_INVITE_STATUSES.EXPIRED, ADMIN_INVITE_STATUSES.CANCELLED].includes(derivedStatus)
  ) {
    throw new AdminInviteError(
      'admin-invite/resend-invalid',
      'Only expired or cancelled invites can be resent.',
    );
  }

  if (action === 'resend') {
    await ensureIdentityAvailability({
      emailLower,
      excludeInviteId: inviteId,
      phoneNumber: normalizedPhone,
    });
  }

  const emailLockReference = getIdentityLockReference(buildIdentityDocumentId(IDENTITY_TYPES.EMAIL, emailLower));
  const phoneLockReference = getIdentityLockReference(buildIdentityDocumentId(IDENTITY_TYPES.PHONE, normalizedPhone));
  const auditReference = doc(collection(db, AUDIT_LOGS_COLLECTION));

  await runTransaction(db, async (transaction) => {
    const transactionInviteSnapshot = await transaction.get(inviteReference);
    if (!transactionInviteSnapshot.exists()) {
      throw new AdminInviteError('admin-invite/not-found', 'This admin invite no longer exists.');
    }

    const currentInvite = transactionInviteSnapshot.data();
    const currentDerivedStatus = getDerivedInviteStatus(currentInvite);
    const emailLockSnapshot = await transaction.get(emailLockReference);
    const phoneLockSnapshot = await transaction.get(phoneLockReference);
    const emailLock = emailLockSnapshot.exists() ? emailLockSnapshot.data() : null;
    const phoneLock = phoneLockSnapshot.exists() ? phoneLockSnapshot.data() : null;

    if (action === 'cancel') {
      if (currentDerivedStatus !== ADMIN_INVITE_STATUSES.PENDING) {
        throw new AdminInviteError('admin-invite/cancel-invalid', 'Only pending invites can be cancelled.');
      }

      transaction.update(inviteReference, {
        cancelledAt: serverTimestamp(),
        cancelledBy: viewer.uid,
        status: ADMIN_INVITE_STATUSES.CANCELLED,
        updatedAt: serverTimestamp(),
      });

      if (emailLock) {
        transaction.set(emailLockReference, buildReleasedIdentityLockPayload({
          existingLock: emailLock,
          releasedBy: viewer.uid,
        }), { merge: true });
      }

      if (phoneLock) {
        transaction.set(phoneLockReference, buildReleasedIdentityLockPayload({
          existingLock: phoneLock,
          releasedBy: viewer.uid,
        }), { merge: true });
      }

      transaction.set(auditReference, buildAuditLogPayload({
        action: 'ADMIN_INVITE_CANCELLED',
        performedBy: viewer.uid,
        performedByRole: viewer.role,
        targetEmail: emailLower,
        targetPhoneNumber: normalizedPhone,
        targetRole: USER_ROLES.ADMIN,
      }));

      return;
    }

    if (
      ![ADMIN_INVITE_STATUSES.EXPIRED, ADMIN_INVITE_STATUSES.CANCELLED].includes(currentDerivedStatus)
    ) {
      throw new AdminInviteError(
        'admin-invite/resend-invalid',
        'Only expired or cancelled invites can be resent.',
      );
    }

    if (
      emailLock
      && emailLock.status !== IDENTITY_LOCK_STATUSES.RELEASED
      && emailLock.inviteId !== inviteId
    ) {
      throw new AdminInviteError('admin-invite/email-lock', EMAIL_IN_USE_MESSAGE);
    }

    if (
      phoneLock
      && phoneLock.status !== IDENTITY_LOCK_STATUSES.RELEASED
      && phoneLock.inviteId !== inviteId
    ) {
      throw new AdminInviteError('admin-invite/phone-lock', PHONE_IN_USE_MESSAGE);
    }

    transaction.update(inviteReference, {
      cancelledAt: null,
      cancelledBy: null,
      expiresAt: buildExpiryTimestamp(),
      status: ADMIN_INVITE_STATUSES.PENDING,
      updatedAt: serverTimestamp(),
    });

    transaction.set(emailLockReference, buildInviteLockPayload({
      inviteId,
      lockedAt: emailLock?.lockedAt || serverTimestamp(),
      lockedBy: viewer.uid,
      role: USER_ROLES.ADMIN,
      type: IDENTITY_TYPES.EMAIL,
      value: emailLower,
    }), { merge: true });

    transaction.set(phoneLockReference, buildInviteLockPayload({
      inviteId,
      lockedAt: phoneLock?.lockedAt || serverTimestamp(),
      lockedBy: viewer.uid,
      role: USER_ROLES.ADMIN,
      type: IDENTITY_TYPES.PHONE,
      value: normalizedPhone,
    }), { merge: true });

    transaction.set(auditReference, buildAuditLogPayload({
      action: 'ADMIN_INVITE_RESENT',
      performedBy: viewer.uid,
      performedByRole: viewer.role,
      targetEmail: emailLower,
      targetPhoneNumber: normalizedPhone,
      targetRole: USER_ROLES.ADMIN,
    }));
  });

  return {
    inviteId,
  };
}
