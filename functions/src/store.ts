import { getFirestore } from "firebase-admin/firestore";
import type { Database, Store } from "../../shared/service.js";
export const firestoreDatabase: Database = {
  async atomic<T>(work: (store: Store) => Promise<T>): Promise<T> {
    const db = getFirestore();
    return db.runTransaction(async (tx) => {
      // Buffer writes so every authorization and domain read happens before Firestore writes.
      const writes = new Map<string, unknown>();
      const store: Store = {
        get: async <V>(path: string) => {
          if (writes.has(path)) return writes.get(path) as V;
          const snap = await tx.get(db.doc(path));
          return snap.exists ? (snap.data() as V) : null;
        },
        list: async <V>(path: string) => {
          const snap = await tx.get(db.collection(path.replace(/\/$/, "")));
          return snap.docs.map((doc) => doc.data() as V);
        },
        set: (path, value) => {
          writes.set(path, value);
        },
        delete: (path) => {
          writes.set(path, null);
        },
      };
      const result = await work(store);
      for (const [path, value] of writes) {
        if (value === null) tx.delete(db.doc(path));
        else tx.set(db.doc(path), value as Record<string, unknown>);
      }
      return result;
    });
  },
};
