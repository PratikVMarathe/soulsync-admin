import { useEffect, useState } from 'react';
import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';
import {
  ACTIVE_QUIZ_STATUSES,
  INACTIVE_QUIZ_STATUSES,
  USER_ROLES,
  USER_STATUSES,
} from '../constants/auth';
import { db } from '../config/firebase';
import { formatDateTime, getQuizDisplayTitle } from '../utils/formatters';
import { resolveAppErrorState } from '../utils/resolveAppErrorState';

function mapDocuments(querySnapshot) {
  return querySnapshot.docs.map((snapshot) => ({
    id: snapshot.id,
    ...snapshot.data(),
  }));
}

function buildRecentActivity(admins, users, quizzes) {
  const performerOne = admins[0]?.name || 'Admin';
  const performerTwo = admins[1]?.name || performerOne;

  return [
    quizzes[0] && {
      action: quizzes[0].status === 'ACTIVE' ? 'Created quiz' : 'Updated quiz status',
      performedBy: performerOne,
      target: getQuizDisplayTitle(quizzes[0].title),
      date: formatDateTime(quizzes[0].updatedAt || quizzes[0].createdAt),
      status: 'Success',
      tone: 'forest',
    },
    users[0] && {
      action: users[0].status === USER_STATUSES.BLOCKED ? 'Blocked user' : 'Reviewed user account',
      performedBy: performerTwo,
      target: users[0].email || users[0].name || users[0].uid,
      date: formatDateTime(users[0].updatedAt || users[0].createdAt),
      status: 'Success',
      tone: 'rose',
    },
    quizzes[1] && {
      action: quizzes[1].status === 'ACTIVE' ? 'Activated quiz' : 'Prepared quiz draft',
      performedBy: performerOne,
      target: getQuizDisplayTitle(quizzes[1].title),
      date: formatDateTime(quizzes[1].updatedAt || quizzes[1].createdAt),
      status: 'Success',
      tone: 'lavender',
    },
    admins[0] && {
      action: 'Updated admin profile',
      performedBy: performerTwo,
      target: admins[0].name || admins[0].email || admins[0].uid,
      date: formatDateTime(admins[0].updatedAt || admins[0].createdAt),
      status: 'Success',
      tone: 'amber',
    },
  ].filter(Boolean);
}

export function useAdminDashboardData() {
  const [data, setData] = useState({
    activity: [],
    admins: [],
    quizzes: [],
    statistics: null,
    users: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const fetchOverview = async () => {
      setLoading(true);

      try {
        const usersCollection = collection(db, 'users');
        const quizzesCollection = collection(db, 'quizzes');

        const [
          totalUsersSnapshot,
          totalAdminsSnapshot,
          blockedUsersSnapshot,
          activeQuizzesSnapshot,
          inactiveQuizzesSnapshot,
          adminPreviewSnapshot,
          userPreviewSnapshot,
          quizPreviewSnapshot,
        ] = await Promise.all([
          getCountFromServer(query(usersCollection, where('role', '==', USER_ROLES.USER))),
          getCountFromServer(query(usersCollection, where('role', 'in', [USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN]))),
          getCountFromServer(query(usersCollection, where('status', '==', USER_STATUSES.BLOCKED))),
          getCountFromServer(query(quizzesCollection, where('status', 'in', ACTIVE_QUIZ_STATUSES))),
          getCountFromServer(query(quizzesCollection, where('status', 'in', INACTIVE_QUIZ_STATUSES))),
          getDocs(query(usersCollection, where('role', 'in', [USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN]), limit(2))),
          getDocs(query(usersCollection, where('role', '==', USER_ROLES.USER), limit(3))),
          getDocs(query(quizzesCollection, limit(3))),
        ]);

        const admins = mapDocuments(adminPreviewSnapshot);
        const users = mapDocuments(userPreviewSnapshot);
        const quizzes = mapDocuments(quizPreviewSnapshot);

        setData({
          activity: buildRecentActivity(admins, users, quizzes),
          admins,
          quizzes,
          statistics: {
            activeQuizzes: activeQuizzesSnapshot.data().count,
            blockedAccounts: blockedUsersSnapshot.data().count,
            inactiveQuizzes: inactiveQuizzesSnapshot.data().count,
            totalAdmins: totalAdminsSnapshot.data().count,
            totalUsers: totalUsersSnapshot.data().count,
          },
          users,
        });
        setError(null);
      } catch (fetchError) {
        console.error('Failed to load admin dashboard data:', fetchError);
        setError(resolveAppErrorState(fetchError, fetchError.code === 'permission-denied'
          ? {
              message: 'This admin account can sign in, but Firestore rules are blocking one or more dashboard queries.',
              statusCode: 403,
              title: 'Dashboard Access Restricted',
            }
          : {
              message: 'We could not load the admin dashboard data right now. Please try again.',
              title: 'Could Not Load Dashboard',
            }));
      } finally {
        setLoading(false);
      }
    };

    fetchOverview();
  }, [reloadToken]);

  return {
    data,
    error,
    loading,
    retry: () => setReloadToken((currentToken) => currentToken + 1),
  };
}
