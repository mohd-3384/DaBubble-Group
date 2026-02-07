import { ChatStateHelper } from './chat-state.helper';

/**
 * Creates proxy getters/setters for all state properties
 * Drastically reduces component size
 */
export function createStateProxies(state: ChatStateHelper, target: any): void {
    const props = [
        'composeMode', 'currentUser', 'showEmoji', 'emojiContext', 'emojiMessageTarget',
        'composerEmojiPos', 'messageEmojiForId', 'emojiPopoverPos', 'emojiOpenedFrom',
        'editMenuForId', 'editMenuPos', 'editingMessageId', 'editDraft', 'to',
        'suggestOpen', 'suggestIndex', 'draft', 'composeTarget', 'showMembers',
        'channelInfoOpen', 'channelNameEdit', 'channelDescEdit', 'editChannelName',
        'editChannelDesc', 'channelTopic', 'membersModalOpen', 'membersModalPos',
        'addMembersOpen', 'addMembersModalPos', 'addMemberInput', 'showAddMemberSuggest',
        'addMemberSelected', 'userProfileOpen', 'userProfile', 'hoveredReaction'
    ];

    props.forEach(prop => {
        Object.defineProperty(target, prop, {
            get() { return state[prop as keyof ChatStateHelper]; },
            set(v) { (state as any)[prop] = v; },
            enumerable: true,
            configurable: true
        });
    });
}
