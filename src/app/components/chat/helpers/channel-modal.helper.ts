import { Injectable, inject } from '@angular/core';
import { Firestore, doc, updateDoc, setDoc } from '@angular/fire/firestore';
import { ActivatedRoute } from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { ChannelDoc } from '../../../interfaces/allInterfaces.interface';
import { AuthReadyService } from '../../../services/auth-ready.service';
import { ChannelService } from '../../../services/channel.service';

/**
 * Service for channel info modal management
 */
@Injectable()
export class ChannelModalHelper {
  private fs = inject(Firestore);
  private route = inject(ActivatedRoute);
  private authReady = inject(AuthReadyService);
  private chanSvc = inject(ChannelService);

  /**
   * Opens channel info modal
   * @param channelDoc$ - Channel document observable
   * @returns Initial channel data
   */
  async openChannelInfo(channelDoc$: Observable<ChannelDoc | null>): Promise<{
    editChannelName: string;
    editChannelDesc: string;
    channelTopic: string;
  }> {
    const ch = await this.getChannelDocSnapshot(channelDoc$);
    return {
      editChannelName: String(ch?.name ?? '').trim(),
      editChannelDesc: String(ch?.topic ?? '').trim(),
      channelTopic: String(ch?.topic ?? ''),
    };
  }

  /**
   * Toggles channel name edit mode or saves
   * @param channelNameEdit - Current edit state
   * @param editChannelName - Current name value
   * @param channelDoc$ - Channel document observable
   * @returns New state or null if saved
   */
  async toggleChannelNameEdit(
    channelNameEdit: boolean,
    editChannelName: string,
    channelDoc$: Observable<ChannelDoc | null>
  ): Promise<{ channelNameEdit: boolean; editChannelName: string; channelNameError?: string } | null> {
    if (!channelNameEdit) {
      const ch = await this.getChannelDocSnapshot(channelDoc$);
      return {
        channelNameEdit: true,
        editChannelName: String(ch?.name ?? '').trim(),
        channelNameError: '',
      };
    }
    const result = await this.saveChannelName(editChannelName);
    if (!result.saved) {
      return {
        channelNameEdit: true,
        editChannelName,
        channelNameError: result.error ?? '',
      };
    }
    return null;
  }

  /**
   * Toggles channel description edit mode or saves
   * @param channelDescEdit - Current edit state
   * @param editChannelDesc - Current description value
   * @param channelDoc$ - Channel document observable
   * @returns New state or null if saved
   */
  async toggleChannelDescEdit(
    channelDescEdit: boolean,
    editChannelDesc: string,
    channelDoc$: Observable<ChannelDoc | null>
  ): Promise<{ channelDescEdit: boolean; editChannelDesc: string } | null> {
    if (!channelDescEdit) {
      const ch = await this.getChannelDocSnapshot(channelDoc$);
      return {
        channelDescEdit: true,
        editChannelDesc: String(ch?.topic ?? '').trim(),
      };
    }
    await this.saveChannelDesc(editChannelDesc);
    return null;
  }

  /**
   * Saves channel name
   * @param newNameRaw - New channel name
   */
  async saveChannelName(newNameRaw: string): Promise<{ saved: boolean; error?: string }> {
    try {
      await this.authReady.requireUser();
      const channelId = this.route.snapshot.paramMap.get('id') ?? '';
      if (!channelId) return { saved: false };
      const duplicate = await this.chanSvc.isChannelNameTaken(newNameRaw, channelId);
      if (duplicate) {
        return { saved: false, error: 'Channel-Name existiert bereits.' };
      }
      await this.updateChannelName(channelId, newNameRaw);
      return { saved: true };
    } catch (e) {
      console.error('Channel-Name speichern fehlgeschlagen:', e);
      return { saved: false };
    }
  }

  /**
   * Saves channel description
   * @param editChannelDesc - New description
   */
  async saveChannelDesc(editChannelDesc: string): Promise<void> {
    try {
      await this.authReady.requireUser();
      const channelId = this.route.snapshot.paramMap.get('id') ?? '';
      if (!channelId) return;
      await setDoc(
        doc(this.fs, `channels/${channelId}`),
        { topic: (editChannelDesc || '').trim() },
        { merge: true }
      );
    } catch (e) {
      console.error('Topic speichern fehlgeschlagen:', e);
    }
  }

  /**
   * Gets the latest channel document snapshot
   * @param channelDoc$ - Channel document observable
   * @returns Channel document or null
   */
  private async getChannelDocSnapshot(
    channelDoc$: Observable<ChannelDoc | null>
  ): Promise<ChannelDoc | null> {
    try {
      return await firstValueFrom(
        channelDoc$.pipe(
          filter((ch): ch is ChannelDoc => !!ch),
          take(1)
        )
      );
    } catch {
      return null;
    }
  }

  /**
   * Updates channel name in Firestore
   * @param channelId - Channel ID
   * @param newNameRaw - New name
   */
  private async updateChannelName(channelId: string, newNameRaw: string): Promise<void> {
    const newName = (newNameRaw || '').trim();
    if (!newName) return;
    await updateDoc(doc(this.fs, `channels/${channelId}`), {
      name: newName,
    });
  }
}
