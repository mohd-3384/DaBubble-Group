import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, addDoc, doc, updateDoc, serverTimestamp } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export interface UserDoc {
  id?: string;
  name: string;
  email: string;
  status: 'active' | 'away';
  avatarUrl: string;
  online?: boolean;
  lastSeen?: any;  // Firestore Timestamp
  role?: 'member' | 'guest';
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private db = inject(Firestore);

  users$(): Observable<UserDoc[]> {
    const ref = collection(this.db, 'users');
    return collectionData(ref, { idField: 'id' }) as Observable<UserDoc[]>;
  }

  async addUser(u: Omit<UserDoc, 'id' | 'lastSeen'>) {
    const ref = collection(this.db, 'users');
    await addDoc(ref, { ...u, lastSeen: serverTimestamp() });
  }

  async setOnline(userId: string, online: boolean) {
    const ref = doc(this.db, `users/${userId}`);
    await updateDoc(ref, { online, lastSeen: serverTimestamp() });
  }
}
