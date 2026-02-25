import { Injectable, inject } from '@angular/core';
import { Firestore, doc, updateDoc, serverTimestamp, deleteDoc } from '@angular/fire/firestore';
import { Router, ActivatedRoute } from '@angular/router';
import { Vm } from '../../../interfaces/allInterfaces.interface';
import { AuthReadyService } from '../../../services/auth-ready.service';
import { ThreadService } from '../../../services/thread.service';
import { makeConvId } from './conversation.utils';
import { isOwnMessage } from './message.utils';

/**
 * Service for editing messages
 */
@Injectable()
export class MessageEditHelper {
    private fs = inject(Firestore);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private authReady = inject(AuthReadyService);
    private thread = inject(ThreadService);

    /**
     * Starts editing a message
     * @param message - Message to edit
     * @param currentUserId - Current user ID
     * @returns Message text for editing or null
     */
    startEdit(message: any, currentUserId: string | null): string | null {
        if (!isOwnMessage(message, currentUserId)) return null;
        return (message.text ?? '').toString();
    }

    /**
     * Saves edited message
     * @param message - Message to save
     * @param editDraft - Edited text
     * @param vm - View model with context
     * @param currentUserId - Current user ID
     */
    async saveEdit(
        message: any,
        editDraft: string,
        vm: Vm,
        currentUserId: string | null
    ): Promise<boolean> {
        if (!isOwnMessage(message, currentUserId)) return false;

        const next = (editDraft || '').trim();
        if (!next || next === (message.text ?? '').trim()) {
            return false;
        }

        const id = this.route.snapshot.paramMap.get('id')!;
        const authUser = await this.authReady.requireUser();

        try {
            if (vm.kind === 'dm') {
                await this.updateDMMessage(id, message.id, authUser.uid, next);
            } else {
                await this.updateChannelMessage(id, message.id, next);
            }

            this.thread.close();
            return true;
        } catch (err) {
            console.error('[Chat] Fehler beim Editieren der Message:', err);
            return false;
        }
    }

    /**
     * Deletes a message
     * @param message - Message to delete
     * @param vm - View model with context
     * @param currentUserId - Current user ID
     */
    async deleteMessage(
        message: any,
        vm: Vm,
        currentUserId: string | null
    ): Promise<boolean> {
        if (!isOwnMessage(message, currentUserId)) return false;

        const id = this.route.snapshot.paramMap.get('id')!;
        const authUser = await this.authReady.requireUser();

        try {
            if (vm.kind === 'dm') {
                await this.deleteDMMessage(id, message.id, authUser.uid);
            } else {
                await this.deleteChannelMessage(id, message.id);
            }

            this.thread.close();
            return true;
        } catch (err) {
            console.error('[Chat] Fehler beim Loeschen der Message:', err);
            return false;
        }
    }

    /**
     * Updates a channel message
     * @param channelId - Channel ID
     * @param messageId - Message ID
     * @param text - New text
     */
    private async updateChannelMessage(
        channelId: string,
        messageId: string,
        text: string
    ): Promise<void> {
        const ref = doc(this.fs, `channels/${channelId}/messages/${messageId}`);
        await updateDoc(ref, {
            text,
            editedAt: serverTimestamp(),
        });
    }

    /**
     * Updates a DM message
     * @param otherUserId - Other user ID
     * @param messageId - Message ID
     * @param meUid - Current user ID
     * @param text - New text
     */
    private async updateDMMessage(
        otherUserId: string,
        messageId: string,
        meUid: string,
        text: string
    ): Promise<void> {
        const convId = makeConvId(meUid, otherUserId);
        const ref = doc(this.fs, `conversations/${convId}/messages/${messageId}`);
        await updateDoc(ref, {
            text,
            editedAt: serverTimestamp(),
        });
    }

    /**
     * Deletes a channel message
     * @param channelId - Channel ID
     * @param messageId - Message ID
     */
    private async deleteChannelMessage(channelId: string, messageId: string): Promise<void> {
        const ref = doc(this.fs, `channels/${channelId}/messages/${messageId}`);
        await deleteDoc(ref);
    }

    /**
     * Deletes a DM message
     * @param otherUserId - Other user ID
     * @param messageId - Message ID
     * @param meUid - Current user ID
     */
    private async deleteDMMessage(otherUserId: string, messageId: string, meUid: string): Promise<void> {
        const convId = makeConvId(meUid, otherUserId);
        const ref = doc(this.fs, `conversations/${convId}/messages/${messageId}`);
        await deleteDoc(ref);
    }
}
