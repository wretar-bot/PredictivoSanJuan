import { collection, getDocs, query, where, writeBatch, doc, addDoc, serverTimestamp, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';

export const generateBackupData = async () => {
  if (!auth.currentUser) return null;
  const uid = auth.currentUser.uid;

  const equipmentSnap = await getDocs(query(collection(db, 'equipment')));
  const recordsSnap = await getDocs(query(collection(db, 'maintenance_records')));
  
  const data = {
    equipment: equipmentSnap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) })),
    records: recordsSnap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }))
  };

  return JSON.stringify(data);
};

export const createFirestoreBackup = async (type: 'manual' | 'auto-equipment' | 'auto-monthly') => {
  if (!auth.currentUser) return;
  try {
    const dataStr = await generateBackupData();
    if (!dataStr) return;

    await addDoc(collection(db, 'backups'), {
      data: dataStr,
      type,
      authorUid: auth.currentUser.uid,
      createdAt: serverTimestamp()
    });
  } catch (e) {
    console.error("Backup failed", e);
  }
};

export const checkAndCreateMonthlyBackup = async () => {
  if (!auth.currentUser) return;
  try {
    const q = query(
      collection(db, 'backups'),
      where('type', '==', 'auto-monthly'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    const snap = await getDocs(q);
    let needsBackup = false;
    
    if (snap.empty) {
      needsBackup = true;
    } else {
      const lastBackup = snap.docs[0].data({ serverTimestamps: 'estimate' });
      const lastDate = lastBackup.createdAt?.toDate();
      if (lastDate) {
        const daysSince = (new Date().getTime() - lastDate.getTime()) / (1000 * 3600 * 24);
        if (daysSince > 30) needsBackup = true;
      } else {
        needsBackup = true;
      }
    }

    if (needsBackup) {
      await createFirestoreBackup('auto-monthly');
    }
  } catch (e) {
    console.error("Monthly backup check failed", e);
  }
};

export const clearDatabase = async () => {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  
  const equipmentSnap = await getDocs(query(collection(db, 'equipment')));
  const recordsSnap = await getDocs(query(collection(db, 'maintenance_records')));
  
  let batch = writeBatch(db);
  let count = 0;

  const commit = async () => {
    if (count > 0) {
      await batch.commit();
      batch = writeBatch(db);
      count = 0;
    }
  };

  for (const d of equipmentSnap.docs) {
    batch.delete(d.ref);
    count++;
    if (count >= 400) await commit();
  }
  for (const d of recordsSnap.docs) {
    batch.delete(d.ref);
    count++;
    if (count >= 400) await commit();
  }
  await commit();
};

export const restoreBackup = async (jsonData: string) => {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  const parsed = JSON.parse(jsonData);

  await clearDatabase();

  let batch = writeBatch(db);
  let count = 0;

  const commit = async () => {
    if (count > 0) {
      await batch.commit();
      batch = writeBatch(db);
      count = 0;
    }
  };

  const parseTimestamp = (ts: any) => {
    if (ts && ts.seconds) return new Timestamp(ts.seconds, ts.nanoseconds);
    return serverTimestamp();
  };

  for (const eq of parsed.equipment || []) {
    const { id, ...data } = eq;
    data.authorUid = uid;
    data.createdAt = parseTimestamp(data.createdAt);
    batch.set(doc(db, 'equipment', id || doc(collection(db, 'equipment')).id), data);
    count++;
    if (count >= 400) await commit();
  }

  for (const rec of parsed.records || []) {
    const { id, ...data } = rec;
    data.authorUid = uid;
    data.createdAt = parseTimestamp(data.createdAt);
    batch.set(doc(db, 'maintenance_records', id || doc(collection(db, 'maintenance_records')).id), data);
    count++;
    if (count >= 400) await commit();
  }

  await commit();
};
