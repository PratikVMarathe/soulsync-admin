import { collectionGroup, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { resolveUserDisplayNamesByIds } from './userLookupService';

export async function loadQuizAnalytics(quizSlug) {
  if (!quizSlug) return [];

  try {
    const q = query(
      collectionGroup(db, 'quizAttempts'),
      where('quizSlug', '==', quizSlug)
    );
    
    const snapshot = await getDocs(q);
    if (snapshot.empty) return [];

    const attempts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })).sort((a, b) => {
      const aTime = a.startedAt?.toMillis ? a.startedAt.toMillis() : 0;
      const bTime = b.startedAt?.toMillis ? b.startedAt.toMillis() : 0;
      return bTime - aTime;
    });

    const userIds = [...new Set(attempts.map(a => a.userId).filter(Boolean))];
    const nameMap = await resolveUserDisplayNamesByIds(userIds);

    return attempts.map(attempt => ({
      ...attempt,
      userName: nameMap[attempt.userId] || 'Unknown User'
    }));

  } catch (err) {
    console.error('Failed to load quiz analytics', err);
    throw err;
  }
}
