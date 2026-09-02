import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDocs,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { USER_ROLES } from '../constants/auth';
import { normalizeSocialLinks, validateSocialLinks } from '../constants/socialMedia';
import { db } from '../config/firebase';

const SATSANG_COLLECTION = 'satsangCentral';
const INTEREST_REQUESTS_COLLECTION = 'interestRequests';
const AUDIT_LOGS_COLLECTION = 'auditLogs';

export const SATSANG_CATEGORIES = {
  CLASS: 'CLASS',
  EVENT: 'EVENT',
  FESTIVAL: 'FESTIVAL',
};

export const CATEGORY_LABELS = {
  CLASS: 'Class',
  EVENT: 'Event',
  FESTIVAL: 'Festival',
};

export const SATSANG_STATUSES = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
};

export const INTEREST_REQUEST_STATUSES = {
  NEW: 'NEW',
  CONTACTED: 'CONTACTED',
  FOLLOW_UP: 'FOLLOW_UP',
  CONNECTED: 'CONNECTED',
  CLOSED: 'CLOSED',
};

export class MandalaAdminError extends Error {
  constructor(code, publicMessage) {
    super(publicMessage);
    this.name = 'MandalaAdminError';
    this.code = code;
    this.publicMessage = publicMessage;
  }
}

function requireAdmin(viewer) {
  if (![USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN].includes(viewer?.role)) {
    throw new MandalaAdminError(
      'mandala-admin/forbidden',
      'Only Admin and Super Admin accounts can access Maṇḍala Updates.',
    );
  }
}

function toTimestamp(value) {
  if (!value) return null;
  if (value instanceof Timestamp) return value;
  if (typeof value?.seconds === 'number') return new Timestamp(value.seconds, value.nanoseconds || 0);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Timestamp.fromDate(date);
}

export async function fetchSatsangOpportunities(viewer) {
  requireAdmin(viewer);

  const querySnapshot = await getDocs(collection(db, SATSANG_COLLECTION));
  const opportunities = querySnapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      socialLinks: normalizeSocialLinks(data.socialLinks),
    };
  });

  return opportunities.sort((left, right) => {
    const leftTime = left.updatedAt?.seconds || left.createdAt?.seconds || 0;
    const rightTime = right.updatedAt?.seconds || right.createdAt?.seconds || 0;
    return rightTime - leftTime;
  });
}

export const DEFAULT_CLASS_DETAILS = {
  availableModes: ['ONLINE', 'OFFLINE'],
  availableLanguages: ['ENGLISH', 'HINDI'],
  availableDays: ['SATURDAY', 'SUNDAY'],
};

export function normalizeClassDetails(details) {
  if (!details || typeof details !== 'object') {
    return { ...DEFAULT_CLASS_DETAILS };
  }
  const availableModes = Array.isArray(details.availableModes) && details.availableModes.length > 0
    ? details.availableModes
    : ['ONLINE', 'OFFLINE'];
  const availableLanguages = Array.isArray(details.availableLanguages) && details.availableLanguages.length > 0
    ? details.availableLanguages
    : ['ENGLISH', 'HINDI'];
  const availableDays = Array.isArray(details.availableDays) && details.availableDays.length > 0
    ? details.availableDays
    : ['SATURDAY', 'SUNDAY'];

  return {
    availableModes,
    availableLanguages,
    availableDays,
  };
}

export async function createSatsangOpportunity(viewer, payload) {
  requireAdmin(viewer);

  const cleanTitle = (payload.title || '').trim();
  const category = (payload.category || SATSANG_CATEGORIES.CLASS).toUpperCase();
  const status = (payload.status || SATSANG_STATUSES.ACTIVE).toUpperCase();

  if (!cleanTitle) {
    throw new MandalaAdminError('invalid-title', 'Title is required.');
  }

  const socialLinks = normalizeSocialLinks(payload.socialLinks);
  const socialErrors = validateSocialLinks(socialLinks);
  if (Object.keys(socialErrors).length > 0) {
    const firstError = Object.values(socialErrors)[0];
    throw new MandalaAdminError('invalid-social-links', firstError);
  }

  const newRef = doc(collection(db, SATSANG_COLLECTION));
  const auditRef = doc(collection(db, AUDIT_LOGS_COLLECTION));

  const opportunityDoc = {
    title: cleanTitle,
    category,
    description: (payload.description || '').trim(),
    imageUrl: (payload.imageUrl || '').trim(),
    imageAlt: (payload.imageAlt || '').trim(),
    location: (payload.location || '').trim(),
    meetingLink: (payload.meetingLink || '').trim(),
    startAt: toTimestamp(payload.startAt),
    endAt: toTimestamp(payload.endAt),
    socialLinks,
    ...(category === SATSANG_CATEGORIES.CLASS
      ? { classDetails: normalizeClassDetails(payload.classDetails) }
      : {}),
    status,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: viewer.uid,
    updatedBy: viewer.uid,
  };

  await runTransaction(db, async (transaction) => {
    transaction.set(newRef, opportunityDoc);

    transaction.set(auditRef, {
      action: 'SATSANG_CENTRAL_CREATED',
      createdAt: serverTimestamp(),
      performedBy: viewer.uid,
      performedByRole: viewer.role,
      status: 'SUCCESS',
      targetEmail: viewer.email || '',
      targetId: newRef.id,
      targetPhoneNumber: viewer.phoneNumber || '',
      targetRole: viewer.role,
      targetTitle: cleanTitle,
    });
  });

  return newRef.id;
}

export async function updateSatsangOpportunity(viewer, opportunityId, payload) {
  requireAdmin(viewer);

  const cleanTitle = (payload.title || '').trim();
  const category = (payload.category || SATSANG_CATEGORIES.CLASS).toUpperCase();
  const status = (payload.status || SATSANG_STATUSES.ACTIVE).toUpperCase();

  if (!cleanTitle) {
    throw new MandalaAdminError('invalid-title', 'Title is required.');
  }

  const socialLinks = normalizeSocialLinks(payload.socialLinks);
  const socialErrors = validateSocialLinks(socialLinks);
  if (Object.keys(socialErrors).length > 0) {
    const firstError = Object.values(socialErrors)[0];
    throw new MandalaAdminError('invalid-social-links', firstError);
  }

  const oppRef = doc(db, SATSANG_COLLECTION, opportunityId);
  const auditRef = doc(collection(db, AUDIT_LOGS_COLLECTION));

  await runTransaction(db, async (transaction) => {
    const oppSnap = await transaction.get(oppRef);
    if (!oppSnap.exists()) {
      throw new MandalaAdminError('not-found', 'Opportunity not found.');
    }

    const updateData = {
      title: cleanTitle,
      category,
      description: (payload.description || '').trim(),
      imageUrl: (payload.imageUrl || '').trim(),
      imageAlt: (payload.imageAlt || '').trim(),
      location: (payload.location || '').trim(),
      meetingLink: (payload.meetingLink || '').trim(),
      startAt: toTimestamp(payload.startAt),
      endAt: toTimestamp(payload.endAt),
      socialLinks,
      status,
      updatedAt: serverTimestamp(),
      updatedBy: viewer.uid,
    };

    if (category === SATSANG_CATEGORIES.CLASS) {
      updateData.classDetails = normalizeClassDetails(payload.classDetails);
    }

    transaction.update(oppRef, updateData);

    transaction.set(auditRef, {
      action: 'SATSANG_CENTRAL_UPDATED',
      createdAt: serverTimestamp(),
      performedBy: viewer.uid,
      performedByRole: viewer.role,
      status: 'SUCCESS',
      targetEmail: viewer.email || '',
      targetId: opportunityId,
      targetPhoneNumber: viewer.phoneNumber || '',
      targetRole: viewer.role,
      targetTitle: cleanTitle,
    });
  });
}

export async function deleteSatsangOpportunity(viewer, opportunityId, opportunityTitle) {
  requireAdmin(viewer);

  const oppRef = doc(db, SATSANG_COLLECTION, opportunityId);
  const auditRef = doc(collection(db, AUDIT_LOGS_COLLECTION));

  await runTransaction(db, async (transaction) => {
    transaction.delete(oppRef);

    transaction.set(auditRef, {
      action: 'SATSANG_CENTRAL_DELETED',
      createdAt: serverTimestamp(),
      performedBy: viewer.uid,
      performedByRole: viewer.role,
      status: 'SUCCESS',
      targetEmail: viewer.email || '',
      targetId: opportunityId,
      targetPhoneNumber: viewer.phoneNumber || '',
      targetRole: viewer.role,
      targetTitle: opportunityTitle || 'Opportunity',
    });
  });
}

export async function toggleSatsangOpportunityStatus(viewer, opportunity) {
  requireAdmin(viewer);

  const nextStatus = opportunity.status === SATSANG_STATUSES.ACTIVE
    ? SATSANG_STATUSES.INACTIVE
    : SATSANG_STATUSES.ACTIVE;

  return updateSatsangOpportunity(viewer, opportunity.id, {
    ...opportunity,
    status: nextStatus,
  });
}

export async function fetchInterestRequests(viewer) {
  requireAdmin(viewer);

  const querySnapshot = await getDocs(collection(db, INTEREST_REQUESTS_COLLECTION));
  const requests = querySnapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));

  return requests.sort((left, right) => {
    const leftTime = left.requestedAt?.seconds || 0;
    const rightTime = right.requestedAt?.seconds || 0;
    return rightTime - leftTime;
  });
}

export async function updateInterestRequestStatus(viewer, requestId, newStatus, requestDetails) {
  requireAdmin(viewer);

  const reqRef = doc(db, INTEREST_REQUESTS_COLLECTION, requestId);
  const auditRef = doc(collection(db, AUDIT_LOGS_COLLECTION));

  await runTransaction(db, async (transaction) => {
    transaction.update(reqRef, {
      status: newStatus,
      updatedAt: serverTimestamp(),
    });

    transaction.set(auditRef, {
      action: 'INTEREST_REQUEST_UPDATED',
      createdAt: serverTimestamp(),
      performedBy: viewer.uid,
      performedByRole: viewer.role,
      status: 'SUCCESS',
      targetEmail: requestDetails?.email || '',
      targetId: requestId,
      targetPhoneNumber: requestDetails?.phoneNumber || '',
      targetRole: 'USER',
      targetTitle: `${requestDetails?.name || 'User'} - ${newStatus}`,
    });
  });
}

export async function deleteInterestRequest(viewer, requestId, requestDetails) {
  requireAdmin(viewer);

  const reqRef = doc(db, INTEREST_REQUESTS_COLLECTION, requestId);
  const auditRef = doc(collection(db, AUDIT_LOGS_COLLECTION));

  await runTransaction(db, async (transaction) => {
    transaction.delete(reqRef);

    transaction.set(auditRef, {
      action: 'INTEREST_REQUEST_DELETED',
      createdAt: serverTimestamp(),
      performedBy: viewer.uid,
      performedByRole: viewer.role,
      status: 'SUCCESS',
      targetEmail: requestDetails?.email || '',
      targetId: requestId,
      targetPhoneNumber: requestDetails?.phoneNumber || '',
      targetRole: 'USER',
      targetTitle: requestDetails?.name || 'Interest Request',
    });
  });
}
