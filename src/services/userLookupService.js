import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const USERS_COLLECTION = 'users';
const MAX_IN_QUERY = 30;

function chunkValues(values, size) {
  const chunks = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function getDisplayNameFromProfile(profile, fallbackLabel = 'Unknown User') {
  return profile?.name || profile?.email || fallbackLabel;
}

export async function resolveUserDisplayNameById(
  userId,
  { systemLabel = 'System', unknownLabel = 'Unknown User' } = {},
) {
  if (!userId) return systemLabel;

  const snapshot = await getDoc(doc(db, USERS_COLLECTION, userId));
  if (!snapshot.exists()) return unknownLabel;

  return getDisplayNameFromProfile(snapshot.data(), unknownLabel);
}

export async function resolveUserDisplayNamesByIds(
  userIds,
  { unknownLabel = 'Unknown User' } = {},
) {
  const ids = [...new Set((userIds || []).filter(Boolean))];

  if (!ids.length) {
    return {};
  }

  const nameMap = {};
  const chunks = chunkValues(ids, MAX_IN_QUERY);

  await Promise.all(chunks.map(async (chunk) => {
    const snapshot = await getDocs(query(
      collection(db, USERS_COLLECTION),
      where(documentId(), 'in', chunk),
    ));

    snapshot.docs.forEach((documentSnapshot) => {
      nameMap[documentSnapshot.id] = getDisplayNameFromProfile(documentSnapshot.data(), unknownLabel);
    });
  }));

  ids.forEach((id) => {
    if (!nameMap[id]) {
      nameMap[id] = unknownLabel;
    }
  });

  return nameMap;
}

export async function attachUserDisplayNames(
  records,
  {
    idField = 'createdBy',
    targetField = 'createdByName',
    systemLabel = 'System',
    unknownLabel = 'Unknown User',
  } = {},
) {
  const items = Array.isArray(records) ? records : [];
  const userIds = items.map((record) => record?.[idField]).filter(Boolean);
  const nameMap = await resolveUserDisplayNamesByIds(userIds, { unknownLabel });

  return items.map((record) => ({
    ...record,
    [targetField]: record?.[idField]
      ? nameMap[record[idField]] || unknownLabel
      : systemLabel,
  }));
}
