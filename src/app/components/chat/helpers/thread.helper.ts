import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { Firestore, doc, docData } from '@angular/fire/firestore';
import { Router, ActivatedRoute } from '@angular/router';
import { ThreadService } from '../../../services/thread.service';
import { AuthReadyService } from '../../../services/auth-ready.service';
import { Vm } from '../../../interfaces/allInterfaces.interface';
import { toDateMaybe } from './date.utils';
import { makeConvId } from './conversation.utils';

/**
 * Service for thread functionality
 */
@Injectable()
export class ThreadHelper {
    private fs = inject(Firestore);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private env = inject(EnvironmentInjector);
    private thread = inject(ThreadService);
    private authReady = inject(AuthReadyService);

    /**
     * Opens thread for a message
     * @param message - Message to open thread for
     * @param vm - View model with context
     */
    async openThread(message: any, vm: Vm): Promise<void> {
        const routeId = this.route.snapshot.paramMap.get('id');
        if (!routeId) return;

        const isDM = this.isDM();
        const threadChannelId = await this.getThreadChannelId(routeId, isDM);

        const threadData = this.buildThreadData(message, vm, threadChannelId, isDM);

        this.thread.openThread(threadData);

        this.handleMobileNavigation(routeId, message.id, isDM);
    }

    /**
     * Handles thread from route parameters (mobile)
     * @param paramMap - Route params
     * @param vm - View model
     * @param authUser - Auth user
     */
    async handleThreadFromRoute(
        threadId: string,
        id: string,
        vm: Vm,
        authUser: any
    ): Promise<any> {
        const isDM = this.isDM();
        let msgRef;

        if (isDM && authUser) {
            const convId = makeConvId(authUser.uid, id);
            msgRef = doc(this.fs, `conversations/${convId}/messages/${threadId}`);
        } else {
            msgRef = doc(this.fs, `channels/${id}/messages/${threadId}`);
        }

        return new Promise((resolve) => {
            runInInjectionContext(this.env, () => docData(msgRef)).subscribe((raw: any) => {
                if (!raw) {
                    resolve(null);
                    return;
                }

                resolve({
                    vm,
                    msg: {
                        id: threadId,
                        text: raw?.text ?? '',
                        authorId: raw?.authorId ?? '',
                        authorName: raw?.authorName ?? 'Unbekannt',
                        authorAvatar: raw?.authorAvatar ?? '/public/images/avatars/avatar-default.svg',
                        createdAt: toDateMaybe(raw?.createdAt) ?? new Date(),
                    },
                    channelId: isDM && authUser ? makeConvId(authUser.uid, id) : id,
                    isDM,
                });
            });
        });
    }

    /**
     * Gets thread channel ID (convId for DM, channelId for channel)
     * @param routeId - Route ID
     * @param isDM - Is DM
     * @returns Channel/conversation ID
     */
    private async getThreadChannelId(routeId: string, isDM: boolean): Promise<string> {
        if (!isDM) return routeId;

        const me = await this.authReady.requireUser();
        return makeConvId(me.uid, routeId);
    }

    /**
     * Builds thread data object
     * @param message - Message
     * @param vm - View model
     * @param threadChannelId - Channel/conversation ID
     * @param isDM - Is DM
     * @returns Thread data
     */
    private buildThreadData(message: any, vm: Vm, threadChannelId: string, isDM: boolean): any {
        return {
            channelId: threadChannelId,
            header: {
                title: 'Thread',
                channel: vm.title,
            },
            root: {
                id: message.id,
                author: {
                    id: message.authorId ?? '',
                    name: message.authorName,
                    avatarUrl: message.authorAvatar,
                },
                text: message.text,
                createdAt: message.createdAt ?? new Date(),
            },
            isDM,
        };
    }

    /**
     * Handles mobile navigation for threads
     * @param routeId - Route ID
     * @param messageId - Message ID
     * @param isDM - Is DM
     */
    private handleMobileNavigation(routeId: string, messageId: string, isDM: boolean): void {
        if (window.innerWidth <= 1024) {
            if (isDM) {
                this.router.navigate(['/dm', routeId, 'thread', messageId]);
            } else {
                this.router.navigate(['/channel', routeId, 'thread', messageId]);
            }
        }
    }

    /**
     * Checks if current route is DM
     * @returns True if DM
     */
    private isDM(): boolean {
        return this.router.url.includes('/dm/');
    }
}
