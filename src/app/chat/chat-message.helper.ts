import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { Firestore, doc, docData, updateDoc, setDoc, serverTimestamp, collection, addDoc } from '@angular/fire/firestore';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthReadyService } from '../services/auth-ready.service';
import { MessageVm, Vm } from '../interfaces/allInterfaces.interface';
import { Observable, take, filter } from 'rxjs';

/**
 * Helper class for managing message operations in the chat component.
 * Handles message editing, sending, and deletion.
 */
@Injectable()
export class ChatMessageHelper {
  private fs = inject(Firestore);
  private authReady = inject(AuthReadyService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  /**
   * Saves an edited message to Firestore.
   * @param m - The message to edit
   * @param vm - The current view model (channel or DM)
   * @param editDraft - The new text content
   * @param makeConvId - Function to create conversation ID for DMs
   * @returns Promise that resolves when the edit is complete
   */
  async saveEdit(
    m: any,
    vm: Vm,
    editDraft: string,
    makeConvId: (uid1: string, uid2: string) => string
  ): Promise<void> {
    const next = (editDraft || '').trim();
    if (!next || next === (m.text ?? '').trim()) {
      return;
    }

    const id = this.route.snapshot.paramMap.get('id')!;
    const authUser = await this.authReady.requireUser();

    try {
      if (vm.kind === 'dm') {
        const otherUserId = id;
        const convId = makeConvId(authUser.uid, otherUserId);
        const ref = doc(this.fs, `conversations/${convId}/messages/${m.id}`);
        await updateDoc(ref, { text: next, editedAt: serverTimestamp() });
      } else {
        const ref = doc(this.fs, `channels/${id}/messages/${m.id}`);
        await updateDoc(ref, { text: next, editedAt: serverTimestamp() });
      }
    } catch (err) {
      console.error('[Chat] Fehler beim Editieren der Message:', err);
      throw err;
    }
  }

  /**
   * Sends a new message in the current chat.
   * @param vm - The current view model
   * @param draft - The message text to send
   * @param currentUser - The current user
   * @param makeConvId - Function to create conversation ID for DMs
   * @param ensureConversation - Function to ensure conversation exists
   * @returns Promise that resolves when the message is sent
   */
  async sendMessage(
    vm: Vm,
    draft: string,
    currentUser: any,
    makeConvId: (uid1: string, uid2: string) => string,
    ensureConversation: (convId: string, meUid: string, otherUid: string) => Promise<void>
  ): Promise<void> {
    const trimmed = (draft || '').trim();
    if (!trimmed) return;

    const id = this.route.snapshot.paramMap.get('id')!;
    const authUser = await this.authReady.requireUser();

    if (!currentUser?.id) {
      console.warn('[Chat] Kein Current User -> send abgebrochen');
      return;
    }

    try {
      if (vm.kind === 'dm') {
        const otherUserId = id;
        const convId = makeConvId(authUser.uid, otherUserId);
        await ensureConversation(convId, authUser.uid, otherUserId);

        const collRef = collection(this.fs, `conversations/${convId}/messages`);
        await addDoc(collRef, {
          text: trimmed,
          authorId: currentUser.id,
          authorName: currentUser.name ?? 'Unbekannt',
          authorAvatar: currentUser.avatarUrl ?? '/public/images/avatars/avatar-default.svg',
          createdAt: serverTimestamp(),
        });
      } else {
        const collRef = collection(this.fs, `channels/${id}/messages`);
        await addDoc(collRef, {
          text: trimmed,
          authorId: currentUser.id,
          authorName: currentUser.name ?? 'Unbekannt',
          authorAvatar: currentUser.avatarUrl ?? '/public/images/avatars/avatar-default.svg',
          createdAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.error('[Chat] Fehler beim Senden der Nachricht:', err);
      throw err;
    }
  }

  /**
   * Sends a message from the compose mode.
   * @param composeTarget - The target channel or user
   * @param draft - The message text
   * @param currentUser - The current user
   * @param makeConvId - Function to create conversation ID
   * @param ensureConversation - Function to ensure conversation exists
   * @param router - Router for navigation
   * @returns Promise that resolves when the message is sent
   */
  async sendFromCompose(
    composeTarget: any,
    draft: string,
    currentUser: any,
    makeConvId: (uid1: string, uid2: string) => string,
    ensureConversation: (convId: string, meUid: string, otherUid: string) => Promise<void>,
    router: Router
  ): Promise<void> {
    if (!composeTarget) return;

    const trimmed = (draft || '').trim();
    if (!trimmed) return;

    const authUser = await this.authReady.requireUser();

    if (!currentUser?.id) {
      console.warn('[Chat] Kein Current User -> compose send abgebrochen');
      return;
    }

    try {
      if (composeTarget.kind === 'channel') {
        const channelId = composeTarget.id;
        const collRef = collection(this.fs, `channels/${channelId}/messages`);
        await addDoc(collRef, {
          text: trimmed,
          authorId: currentUser.id,
          authorName: currentUser.name ?? 'Unbekannt',
          authorAvatar: currentUser.avatarUrl ?? '/public/images/avatars/avatar-default.svg',
          createdAt: serverTimestamp(),
        });

        await router.navigate(['/new', channelId]);
      } else {
        const otherUserId = composeTarget.id;
        const convId = makeConvId(authUser.uid, otherUserId);
        await ensureConversation(convId, authUser.uid, otherUserId);

        const collRef = collection(this.fs, `conversations/${convId}/messages`);
        await addDoc(collRef, {
          text: trimmed,
          authorId: currentUser.id,
          authorName: currentUser.name ?? 'Unbekannt',
          authorAvatar: currentUser.avatarUrl ?? '/public/images/avatars/avatar-default.svg',
          createdAt: serverTimestamp(),
        });

        await router.navigate(['/new', 'dm', otherUserId]);
      }
    } catch (err) {
      console.error('[Chat] Fehler beim Senden der Compose-Nachricht:', err);
      throw err;
    }
  }

  /**
   * Gets the placeholder text for the composer.
   * @param vm - The current view model
   * @returns The placeholder text
   */
  composePlaceholder(vm: Vm): string {
    if (vm.kind === 'dm') {
      return `Nachricht an ${vm.title}`;
    }
    return `Nachricht an ${vm.title}`;
  }
}
