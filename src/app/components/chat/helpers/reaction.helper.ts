import { Injectable, inject } from '@angular/core';
import { Firestore, doc, runTransaction, deleteField, increment } from '@angular/fire/firestore';
import { Router, ActivatedRoute } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { MessageVm, UserDoc } from '../../../interfaces/allInterfaces.interface';
import { AuthReadyService } from '../../../services/auth-ready.service';
import { makeConvId } from './conversation.utils';

/**
 * Service for managing message reactions
 */
@Injectable()
export class ReactionHelper {
    private fs = inject(Firestore);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private auth = inject(Auth);
    private authReady = inject(AuthReadyService);

    /**
     * Adds or removes a reaction to/from a message
     * @param msg - Message to react to
     * @param emoji - Emoji string
     * @param currentUser - Current user data
     */
    async addReaction(
        msg: MessageVm,
        emoji: string,
        currentUser: (UserDoc & { id: string }) | null
    ): Promise<void> {
        try {
            const id = this.route.snapshot.paramMap.get('id')!;
            const isDM = this.isDM();
            const authUser = await this.authReady.requireUser();

            const uid = authUser.uid;
            const key = String(emoji);

            const ref = this.getMessageRef(id, msg.id, uid, isDM);

            await this.toggleReaction(ref, key, uid, authUser, currentUser);
        } catch (e) {
            console.error('[Chat] Reaction update failed:', e);
        }
    }

    /**
     * Gets list of reactions for a message
     * @param msg - Message
     * @returns Array of emoji/count pairs
     */
    reactionList(msg: MessageVm): Array<{ emoji: string; count: number }> {
        const r = ((msg as any)?.reactions || {}) as Record<string, number>;
        return Object.entries(r)
            .map(([emoji, count]) => ({ emoji, count: Number(count || 0) }))
            .filter(x => x.count > 0)
            .sort((a, b) => b.count - a.count);
    }

    /**
     * Checks if message has any reactions
     * @param msg - Message
     * @returns True if has reactions
     */
    hasReactions(msg: MessageVm): boolean {
        const r = (msg as any)?.reactions || {};
        return Object.keys(r).length > 0;
    }

    /**
     * Gets names of users who reacted with specific emoji
     * @param msg - Message
     * @param emoji - Emoji string
     * @param userNameMap - Map of user IDs to names
     * @param currentUserId - Current user ID
     * @returns Array of names
     */
    reactionNames(
        msg: MessageVm,
        emoji: string,
        userNameMap: Map<string, string>,
        currentUserId: string | null
    ): string[] {
        const by = ((msg as any)?.reactionBy?.[emoji] || {}) as Record<string, any>;

        const names = Object.keys(by)
            .filter(uid => !!by[uid])
            .map(uid => {
                if (currentUserId && uid === currentUserId) return 'Du';
                return userNameMap.get(uid) ?? 'Unbekannt';
            });

        return names.length ? names : ['Unbekannt'];
    }

    /**
     * Gets reaction verb (singular or plural)
     * @param msg - Message
     * @param emoji - Emoji string
     * @param userNameMap - Map of user IDs to names
     * @param currentUserId - Current user ID
     * @returns Verb string
     */
    reactionVerb(
        msg: MessageVm,
        emoji: string,
        userNameMap: Map<string, string>,
        currentUserId: string | null
    ): string {
        const names = this.reactionNames(msg, emoji, userNameMap, currentUserId);
        const includesYou = names.includes('Du');

        if (includesYou && names.length === 1) return 'hast reagiert';
        return names.length === 1 ? 'hat reagiert' : 'haben reagiert';
    }

    /**
     * Checks if current user reacted with specific emoji
     * @param msg - Message
     * @param emoji - Emoji string
     * @param uid - User ID
     * @returns True if user reacted
     */
    hasUserReacted(msg: MessageVm, emoji: string, uid: string): boolean {
        const by = (msg as any)?.reactionBy || {};
        return !!by?.[emoji]?.[uid];
    }

    /**
     * Gets message reference (channel or DM)
     * @param id - Channel/User ID
     * @param messageId - Message ID
     * @param uid - Current user ID
     * @param isDM - Is DM conversation
     * @returns Firestore document reference
     */
    private getMessageRef(id: string, messageId: string, uid: string, isDM: boolean): any {
        if (!isDM) {
            return doc(this.fs, `channels/${id}/messages/${messageId}`);
        }
        return doc(this.fs, `conversations/${makeConvId(uid, id)}/messages/${messageId}`);
    }

    /**
     * Toggles reaction in transaction
     * @param ref - Document reference
     * @param key - Emoji key
     * @param uid - User ID
     * @param authUser - Auth user
     * @param currentUser - Current user data
     */
    private async toggleReaction(
        ref: any,
        key: string,
        uid: string,
        authUser: any,
        currentUser: (UserDoc & { id: string }) | null
    ): Promise<void> {
        await runTransaction(this.fs, async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists()) return;

            const data = snap.data() as any;
            const already = !!data?.reactionBy?.[key]?.[uid];

            if (already) {
                await this.removeReaction(tx, ref, key, uid, data);
            } else {
                await this.addReactionTx(tx, ref, key, uid);
            }
        });
    }

    /**
     * Removes reaction in transaction
     * @param tx - Transaction
     * @param ref - Document reference
     * @param key - Emoji key
     * @param uid - User ID
     * @param data - Current data
     */
    private async removeReaction(
        tx: any,
        ref: any,
        key: string,
        uid: string,
        data: any
    ): Promise<void> {
        const currentCount = Number(data?.reactions?.[key] ?? 0);

        const updatePayload: any = {
            [`reactionBy.${key}.${uid}`]: deleteField(),
        };

        if (currentCount <= 1) {
            updatePayload[`reactions.${key}`] = deleteField();
        } else {
            updatePayload[`reactions.${key}`] = increment(-1);
        }

        tx.update(ref, updatePayload);
    }

    /**
     * Adds reaction in transaction
     * @param tx - Transaction
     * @param ref - Document reference
     * @param key - Emoji key
     * @param uid - User ID
     */
    private async addReactionTx(tx: any, ref: any, key: string, uid: string): Promise<void> {
        tx.update(ref, {
            [`reactionBy.${key}.${uid}`]: true,
            [`reactions.${key}`]: increment(1),
        });
    }

    /**
     * Checks if current route is DM
     * @returns True if DM
     */
    private isDM(): boolean {
        return this.router.url.includes('/dm/');
    }
}
