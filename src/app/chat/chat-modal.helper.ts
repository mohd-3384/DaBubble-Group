import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { Firestore, doc, docData, setDoc, updateDoc, runTransaction, collection, query, where, getDocs } from '@angular/fire/firestore';
import { Observable, take, filter } from 'rxjs';
import { ChannelDoc, UserDoc } from '../interfaces/allInterfaces.interface';
import { AuthReadyService } from '../services/auth-ready.service';
import { ChannelService } from '../services/channel.service';
import { ActivatedRoute, Router } from '@angular/router';

/**
 * Helper class for managing modals in the chat component.
 * Handles channel info, user profile, members, and add members modals.
 */
@Injectable()
export class ChatModalHelper {
  private fs = inject(Firestore);
  private authReady = inject(AuthReadyService);
  private chanSvc = inject(ChannelService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private env = inject(EnvironmentInjector);

  /**
   * Updates the channel name in Firestore.
   * @param channelId - ID of the channel
   * @param newNameRaw - New name for the channel
   * @returns Promise that resolves when the name is updated
   */
  async updateChannelName(channelId: string, newNameRaw: string): Promise<void> {
    await this.authReady.requireUser();
    const newName = (newNameRaw || '').trim();
    if (!newName) return;

    await updateDoc(doc(this.fs, `channels/${channelId}`), {
      name: newName,
    });
  }

  /**
   * Updates the channel topic/description.
   * @param channelId - ID of the channel
   * @param newTopic - New topic text
   * @returns Promise that resolves when the topic is updated
   */
  async updateChannelTopic(channelId: string, newTopic: string): Promise<void> {
    await this.authReady.requireUser();

    await setDoc(
      doc(this.fs, `channels/${channelId}`),
      { topic: (newTopic || '').trim() },
      { merge: true }
    );
  }

  /**
   * Leaves the current channel.
   * @param channelId - ID of the channel to leave
   * @returns Promise that resolves when the user has left
   */
  async leaveChannel(channelId: string): Promise<void> {
    try {
      await this.chanSvc.leaveChannel(channelId);
    } catch (e) {
      console.error('Channel verlassen fehlgeschlagen:', e);
      throw e;
    }
  }

  /**
   * Loads user profile data.
   * @param userId - ID of the user
   * @returns Observable of user profile data
   */
  loadUserProfile(userId: string): Observable<any> {
    const uref = doc(this.fs, `users/${userId}`);
    return runInInjectionContext(this.env, () => docData(uref));
  }

  /**
   * Adds a member to the current channel.
   * @param addMemberName - Name of the member
   * @param fixAvatar - Function to fix avatar URL
   * @returns Promise that resolves when the member is added
   */
  async submitAddMember(
    addMemberName: string,
    fixAvatar: (url?: string) => string
  ): Promise<void> {
    const memberName = (addMemberName || '').trim();
    if (!memberName) return;

    const channelId = this.route.snapshot.paramMap.get('id');
    if (!channelId) return;

    await this.authReady.requireUser();

    const usersRef = collection(this.fs, 'users');
    const snapshot = await getDocs(usersRef);

    let foundUser: any = null;
    snapshot.forEach((docSnap: any) => {
      const data = docSnap.data();
      if ((data.name ?? '').toLowerCase() === memberName.toLowerCase()) {
        foundUser = { id: docSnap.id, ...data };
      }
    });

    if (!foundUser) {
      console.warn('User nicht gefunden:', memberName);
      return;
    }

    const memRef = doc(this.fs, `channels/${channelId}/members/${foundUser.id}`);
    await setDoc(memRef, {
      uid: foundUser.id,
      displayName: foundUser.name ?? memberName,
      avatarUrl: fixAvatar(foundUser.avatarUrl),
    });
  }

  /**
   * Handles channel name edit toggle.
   * @param channelDoc$ - Observable of channel document
   * @param channelNameEdit - Current edit state
   * @param editChannelName - Current edit value
   * @returns Promise with new edit state and value
   */
  async toggleChannelNameEdit(
    channelDoc$: Observable<ChannelDoc | null>,
    channelNameEdit: boolean,
    editChannelName: string
  ): Promise<{ edit: boolean; value: string }> {
    if (!channelNameEdit) {
      let value = editChannelName;
      if (!value) {
        await new Promise<void>((resolve) => {
          channelDoc$
            .pipe(
              filter((ch): ch is ChannelDoc => !!ch),
              take(1)
            )
            .subscribe((ch) => {
              value = String(ch.name ?? '').trim();
              resolve();
            });
        });
      }
      return { edit: true, value };
    }

    try {
      await this.authReady.requireUser();
      const channelId = this.route.snapshot.paramMap.get('id') ?? '';
      if (!channelId) return { edit: false, value: editChannelName };

      await this.updateChannelName(channelId, editChannelName);
      return { edit: false, value: editChannelName };
    } catch (e) {
      console.error('Channel-Name speichern fehlgeschlagen:', e);
      throw e;
    }
  }

  /**
   * Handles channel description edit toggle.
   * @param channelDoc$ - Observable of channel document
   * @param channelDescEdit - Current edit state
   * @param editChannelDesc - Current edit value
   * @returns Promise with new edit state and value
   */
  async toggleChannelDescEdit(
    channelDoc$: Observable<ChannelDoc | null>,
    channelDescEdit: boolean,
    editChannelDesc: string
  ): Promise<{ edit: boolean; value: string }> {
    if (!channelDescEdit) {
      let value = editChannelDesc;
      if (!value) {
        await new Promise<void>((resolve) => {
          channelDoc$
            .pipe(
              filter((ch): ch is ChannelDoc => !!ch),
              take(1)
            )
            .subscribe((ch) => {
              value = String(ch.topic ?? '').trim();
              resolve();
            });
        });
      }
      return { edit: true, value };
    }

    try {
      await this.authReady.requireUser();
      const channelId = this.route.snapshot.paramMap.get('id') ?? '';
      if (!channelId) return { edit: false, value: editChannelDesc };

      await this.updateChannelTopic(channelId, editChannelDesc);
      return { edit: false, value: editChannelDesc };
    } catch (e) {
      console.error('Topic speichern fehlgeschlagen:', e);
      throw e;
    }
  }
}
