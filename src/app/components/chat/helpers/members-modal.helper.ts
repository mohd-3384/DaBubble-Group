import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc, serverTimestamp } from '@angular/fire/firestore';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { UserMini } from '../../../interfaces/allInterfaces.interface';

/**
 * Service for members modal management
 */
@Injectable()
export class MembersModalHelper {
    private fs = inject(Firestore);
    private route = inject(ActivatedRoute);

    /**
     * Submits add member operation
     * @param selected - Selected user
     * @returns Promise that resolves when complete
     */
    async submitAddMember(selected: UserMini | null): Promise<boolean> {
        if (!selected) return false;

        const channelId = this.route.snapshot.paramMap.get('id');
        if (!channelId) return false;

        try {
            const mref = doc(this.fs, `channels/${channelId}/members/${selected.id}`);

            await setDoc(
                mref,
                {
                    uid: selected.id,
                    displayName: selected.name,
                    avatarUrl: selected.avatarUrl,
                    joinedAt: serverTimestamp(),
                    role: 'member',
                },
                { merge: true }
            );

            return true;
        } catch (err) {
            console.error('Fehler beim Hinzufügen des Members:', err);
            return false;
        }
    }

    /**
     * Handles add member input change
     * @param value - Input value
     * @param addMemberInput$ - Input subject
     * @returns New state
     */
    onAddMemberInput(
        value: string,
        addMemberInput$: BehaviorSubject<string>
    ): {
        addMemberInput: string;
        showAddMemberSuggest: boolean;
        addMemberSelected: UserMini | null;
    } {
        addMemberInput$.next(value);

        return {
            addMemberInput: value,
            showAddMemberSuggest: !!value.trim(),
            addMemberSelected: null,
        };
    }

    /**
     * Selects a member from suggestions
     * @param user - Selected user
     * @param addMemberInput$ - Input subject
     * @returns New state
     */
    selectAddMember(
        user: UserMini,
        addMemberInput$: BehaviorSubject<string>
    ): {
        addMemberSelected: UserMini;
        addMemberInput: string;
        showAddMemberSuggest: boolean;
    } {
        addMemberInput$.next(user.name);

        return {
            addMemberSelected: user,
            addMemberInput: user.name,
            showAddMemberSuggest: false,
        };
    }

    /**
     * Resets add member modal state
     * @param addMemberInput$ - Input subject
     * @returns Reset state
     */
    resetAddMemberState(
        addMemberInput$: BehaviorSubject<string>
    ): {
        addMemberInput: string;
        addMemberSelected: UserMini | null;
    } {
        addMemberInput$.next('');

        return {
            addMemberInput: '',
            addMemberSelected: null,
        };
    }
}
