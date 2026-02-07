import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, doc, setDoc, serverTimestamp } from '@angular/fire/firestore';
import { Router, ActivatedRoute } from '@angular/router';
import { Vm, SuggestItem, UserDoc } from '../../../interfaces/allInterfaces.interface';
import { AuthReadyService } from '../../../services/auth-ready.service';
import { makeConvId, ensureConversation } from './conversation.utils';

/**
 * Service for sending messages
 */
@Injectable()
export class MessageSendHelper {
    private fs = inject(Firestore);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private authReady = inject(AuthReadyService);

    /**
     * Sends a message in current context (channel or DM)
     * @param vm - View model with context
     * @param draft - Message text
     * @param currentUser - Current user data
     * @returns Promise that resolves when sent
     */
    async send(vm: Vm, draft: string, currentUser: (UserDoc & { id: string }) | null): Promise<void> {
        const msg = draft.trim();
        if (!msg) return;

        const id = this.route.snapshot.paramMap.get('id')!;
        const isDM = vm.kind === 'dm';
        const authUser = await this.authReady.requireUser();

        const msgData = this.prepareMessageData(authUser, currentUser);

        if (!isDM) {
            await this.sendToChannel(id, msg, msgData);
        } else {
            await this.sendToDM(id, authUser.uid, msg, msgData);
        }
    }

    /**
     * Sends a message from compose mode
     * @param target - Target (channel or user)
     * @param draft - Message text
     * @param currentUser - Current user data
     * @returns Promise that resolves when sent
     */
    async sendFromCompose(
        target: SuggestItem | null,
        draft: string,
        currentUser: (UserDoc & { id: string }) | null
    ): Promise<void> {
        if (!target) return;

        const text = draft.trim();
        const authUser = await this.authReady.requireUser();
        const msgData = this.prepareMessageData(authUser, currentUser);

        if (target.kind === 'channel' && target.id) {
            await this.handleChannelTarget(target.id, text, msgData);
            return;
        }

        if (target.kind === 'user' && target.id) {
            await this.handleUserTarget(target.id, authUser.uid, text, msgData);
            return;
        }

        if (target.kind === 'email') {
            this.handleEmailTarget(target.value, text);
        }
    }

    /**
     * Prepares message data with author info
     * @param authUser - Auth user
     * @param currentUser - Current user doc
     * @returns Message data object
     */
    private prepareMessageData(authUser: any, currentUser: (UserDoc & { id: string }) | null): any {
        const guestEmail = 'guest@dabubble.de';
        const isGuest = currentUser?.role === 'guest' || authUser.email === guestEmail;

        return {
            authorId: authUser.uid,
            authorName: this.getAuthorName(isGuest, currentUser, authUser),
            authorAvatar: currentUser?.avatarUrl ?? '/public/images/avatars/avatar-default.svg',
        };
    }

    /**
     * Gets author name with fallbacks
     * @param isGuest - Is guest user
     * @param currentUser - Current user doc
     * @param authUser - Auth user
     * @returns Author name
     */
    private getAuthorName(
        isGuest: boolean,
        currentUser: (UserDoc & { id: string }) | null,
        authUser: any
    ): string {
        if (isGuest) return 'Guest';
        return currentUser?.name ??
            (currentUser as any)?.displayName ??
            authUser.displayName ??
            authUser.email ??
            'Unbekannt';
    }

    /**
     * Sends message to channel
     * @param channelId - Channel ID
     * @param text - Message text
     * @param msgData - Message data
     */
    private async sendToChannel(channelId: string, text: string, msgData: any): Promise<void> {
        const coll = collection(this.fs, `channels/${channelId}/messages`);
        await addDoc(coll, {
            text,
            ...msgData,
            createdAt: serverTimestamp(),
            replyCount: 0,
            reactions: {},
        });
    }

    /**
     * Sends message to DM conversation
     * @param otherUserId - Other user ID
     * @param meUid - Current user ID
     * @param text - Message text
     * @param msgData - Message data
     */
    private async sendToDM(
        otherUserId: string,
        meUid: string,
        text: string,
        msgData: any
    ): Promise<void> {
        const convId = makeConvId(meUid, otherUserId);

        const convRef = doc(this.fs, `conversations/${convId}`);
        await setDoc(
            convRef,
            {
                createdAt: serverTimestamp(),
                participants: {
                    [meUid]: otherUserId,
                    [otherUserId]: meUid,
                },
            },
            { merge: true }
        );

        const coll = collection(this.fs, `conversations/${convId}/messages`);
        await addDoc(coll, {
            text,
            ...msgData,
            createdAt: serverTimestamp(),
        });
    }

    /**
     * Handles sending to channel target
     * @param channelId - Channel ID
     * @param text - Message text
     * @param msgData - Message data
     */
    private async handleChannelTarget(
        channelId: string,
        text: string,
        msgData: any
    ): Promise<void> {
        if (text) {
            await this.sendToChannel(channelId, text, msgData);
        }
        this.router.navigate(['/channel', channelId]);
    }

    /**
     * Handles sending to user target (DM)
     * @param otherUserId - Other user ID
     * @param meUid - Current user ID
     * @param text - Message text
     * @param msgData - Message data
     */
    private async handleUserTarget(
        otherUserId: string,
        meUid: string,
        text: string,
        msgData: any
    ): Promise<void> {
        const convId = makeConvId(meUid, otherUserId);
        await ensureConversation(this.fs, convId, meUid, otherUserId);

        if (text) {
            const coll = collection(this.fs, `conversations/${convId}/messages`);
            await addDoc(coll, {
                text,
                ...msgData,
                createdAt: serverTimestamp(),
            });
        }

        this.router.navigate(['/dm', otherUserId]);
    }

    /**
     * Handles email target (opens mailto)
     * @param email - Email address
     * @param text - Message text
     */
    private handleEmailTarget(email: string, text: string): void {
        if (typeof window !== 'undefined') {
            const body = text ? `?body=${encodeURIComponent(text)}` : '';
            window.location.href = `mailto:${email}${body}`;
        }
    }
}
