import { doc, getDoc, setDoc, serverTimestamp, Firestore } from '@angular/fire/firestore';

/**
 * Creates a deterministic conversation ID from two user IDs
 * @param a - First user ID
 * @param b - Second user ID
 * @returns Conversation ID
 */
export function makeConvId(a: string, b: string): string {
    return a < b ? `${a}_${b}` : `${b}_${a}`;
}

/**
 * Ensures a conversation document exists in Firestore
 * @param fs - Firestore instance
 * @param convId - Conversation ID
 * @param meUid - Current user ID
 * @param otherUid - Other user ID
 */
export async function ensureConversation(
    fs: Firestore,
    convId: string,
    meUid: string,
    otherUid: string
): Promise<void> {
    const convRef = doc(fs, `conversations/${convId}`);
    const snap = await getDoc(convRef);

    if (snap.exists()) return;

    await setDoc(convRef, {
        createdAt: serverTimestamp(),
        participants: {
            [meUid]: otherUid,
            [otherUid]: meUid,
        },
    });
}
