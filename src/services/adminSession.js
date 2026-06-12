import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { ADMIN_ROLES, USER_STATUSES } from '../constants/auth';
import { auth, db, googleProvider } from '../config/firebase';

class AdminAccessError extends Error {
  constructor(code, publicMessage, statusCode = 403) {
    super(publicMessage);
    this.name = 'AdminAccessError';
    this.code = code;
    this.publicMessage = publicMessage;
    this.statusCode = statusCode;
  }
}

const normalizeRole = (role) => role?.toUpperCase() || '';
const normalizeStatus = (status) => status?.toUpperCase() || '';

function buildViewer(authUser, profile) {
  return {
    uid: authUser.uid,
    displayName: profile.name || authUser.displayName || authUser.email || 'Admin User',
    email: profile.email || authUser.email || '',
    photoURL: authUser.photoURL || '',
    profile,
    role: normalizeRole(profile.role),
    status: normalizeStatus(profile.status) || USER_STATUSES.ACTIVE,
  };
}

function validateAdminProfile(profile) {
  if (!profile) {
    throw new AdminAccessError(
      'admin/not-found',
      'No admin profile was found for this Google account. Ask a Super Admin to create your admin access first.',
      403,
    );
  }

  const role = normalizeRole(profile.role);
  const status = normalizeStatus(profile.status);

  if (!ADMIN_ROLES.includes(role)) {
    throw new AdminAccessError(
      'admin/forbidden',
      'This Google account is signed in, but it does not have Admin or Super Admin access.',
      403,
    );
  }

  if (status === USER_STATUSES.BLOCKED) {
    throw new AdminAccessError(
      'admin/blocked',
      'This admin account has been blocked. Contact the Super Admin for access.',
      403,
    );
  }

  if (status === USER_STATUSES.SOFT_DELETED || profile.isDeleted) {
    throw new AdminAccessError(
      'admin/deleted',
      'This admin account was removed and cannot be used right now.',
      403,
    );
  }

  return {
    ...profile,
    role,
    status: status || USER_STATUSES.ACTIVE,
  };
}

export async function resolveAdminSession(authUser) {
  if (!authUser) return null;

  const snapshot = await getDoc(doc(db, 'users', authUser.uid));
  const profile = validateAdminProfile(snapshot.exists() ? snapshot.data() : null);
  return buildViewer(authUser, profile);
}

export async function signInAsAdmin() {
  await signInWithPopup(auth, googleProvider);
}

export async function signOutAdmin() {
  await signOut(auth);
}

export function subscribeToAdminSession({ onError, onResolved }) {
  return onAuthStateChanged(auth, async (currentUser) => {
    if (!currentUser) {
      onResolved(null);
      return;
    }

    try {
      const viewer = await resolveAdminSession(currentUser);
      onResolved(viewer);
    } catch (error) {
      onError(error);
      try {
        await signOutAdmin();
      } catch (signOutError) {
        console.error('Failed to sign out invalid admin session:', signOutError);
      }
      onResolved(null);
    }
  });
}

export function getAdminAuthErrorState(error) {
  if (error instanceof AdminAccessError) {
    return {
      message: error.publicMessage,
      statusCode: error.statusCode,
      title: error.statusCode === 403 ? 'Admin Access Required' : 'Sign In Required',
    };
  }

  if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
    return {
      message: 'Google sign in was cancelled before it finished.',
      statusCode: 401,
      title: 'Sign In Cancelled',
    };
  }

  return {
    message: 'We could not complete your SoulSync Admin sign in. Please try again.',
    statusCode: 500,
    title: 'Sign In Failed',
  };
}
