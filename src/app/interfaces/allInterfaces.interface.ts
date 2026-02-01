/**
 * View model for representing a channel or direct message in the UI
 */
export interface Vm {
  /** Type of conversation: 'channel' or 'dm' (direct message) */
  kind: 'channel' | 'dm';
  /** Display title of the conversation */
  title: string;
  /** Optional avatar URL for direct messages */
  avatarUrl?: string;
  /** Optional online status for direct messages */
  online?: boolean;
}

/**
 * Firestore document structure for a channel
 */
export interface ChannelDoc {
  /** Firestore document ID */
  id?: string;
  /** Display name of the channel */
  name?: string;
  /** User ID of the channel creator */
  createdBy?: string;
  /** Timestamp when the channel was created */
  createdAt?: any;
  /** Number of members in the channel */
  memberCount?: number;
  /** Total number of messages in the channel */
  messageCount?: number;
  /** Timestamp of the last message */
  lastMessageAt?: any;
  /** User ID of the last message author */
  lastMessageBy?: string | null;
  /** Timestamp of the last reply in any thread */
  lastReplyAt?: any;
  /** Optional channel topic/description */
  topic?: string;
}

/**
 * Firestore document structure for a user
 */
export interface UserDoc {
  /** Firestore document ID (user UID) */
  id?: string;
  /** Display name of the user */
  name: string;
  /** Email address of the user */
  email: string;
  /** User status: 'active' or 'away' */
  status: 'active' | 'away';
  /** URL to the user's avatar image */
  avatarUrl: string;
  /** Whether the user is currently online */
  online?: boolean;
  /** Timestamp of the user's last activity */
  lastSeen?: any;
  /** User role: 'member' or 'guest' */
  role?: 'member' | 'guest';
}

/**
 * Minimal user representation for UI display
 */
export interface UserMini {
  /** User ID */
  id: string;
  /** User display name */
  name: string;
  /** Optional avatar URL */
  avatarUrl?: string;
  /** Optional online status */
  online?: boolean;
  /** Optional user status */
  status?: 'active' | 'away';
}

/**
 * View model for a chat message
 */
export interface MessageVm {
  /** Message ID */
  id: string;
  /** Message text content */
  text: string;
  /** Author user ID */
  authorId: string;
  /** Author display name */
  authorName: string;
  /** Author avatar URL */
  authorAvatar: string;
  /** Message creation timestamp */
  createdAt: Date | null;
  /** Number of replies in thread */
  replyCount: number;
  /** Timestamp of last reply */
  lastReplyAt: Date | null;
  /** Map of emoji reactions to counts */
  reactions?: Record<string, number>;
  /** Map of emoji -> userId -> boolean indicating who reacted */
  reactionBy?: Record<string, Record<string, boolean>>;
}

/**
 * Groups messages by day for display
 */
export interface DayGroup {
  /** Display label for the day (e.g., 'Today', 'Monday, Jan 15') */
  label: string;
  /** Whether this group represents today */
  isToday: boolean;
  /** Messages in this day group */
  items: MessageVm[];
};

/**
 * Denormalized member data stored in channel
 */
export interface MemberDenorm {
  /** User ID */
  uid: string;
  /** Optional display name */
  displayName?: string;
  /** Optional avatar URL */
  avatarUrl?: string;
  /** Optional join timestamp */
  joinedAt?: Date | null;
  /** Optional member role */
  role?: 'member' | 'admin';
};

/**
 * View model for a channel member
 */
export interface MemberVM {
  /** User ID */
  uid: string;
  /** User display name */
  name: string;
  /** Optional avatar URL */
  avatarUrl?: string;
  /** Optional online status */
  online?: boolean;
};

/**
 * Type of search target: channel, user, or email
 */
export type TargetKind = 'channel' | 'user' | 'email';

/**
 * Suggestion item for autocomplete/search
 */
export interface SuggestItem {
  /** Type of suggestion */
  kind: TargetKind;
  /** Optional ID for channels/users */
  id?: string;
  /** Display label */
  label: string;
  /** Value to use when selected */
  value: string;
  /** Optional avatar URL */
  avatarUrl?: string;
}

/**
 * Minimal user metadata
 */
export interface UserMeta {
  /** User ID */
  id: string;
  /** User display name */
  name: string;
  /** Optional avatar URL */
  avatarUrl?: string;
}

/**
 * Simple reaction representation
 */
export interface Reaction {
  /** Emoji character or string */
  emoji: string;
  /** Number of users who reacted with this emoji */
  count: number;
}

/**
 * View model for a reaction with user interaction state
 */
export type ReactionVm = {
  /** Emoji character or string */
  emoji: string;
  /** Number of users who reacted */
  count: number;
  /** Whether the current user reacted with this emoji */
  reactedByMe: boolean
};

/**
 * Map of emoji strings to reaction counts
 */
export type ReactionsMap = Record<string, number>;

/**
 * Array item for reaction data
 */
export type ReactionArrayItem = { emoji: string; count: number };

/**
 * Message representation for thread display
 */
export interface Message {
  /** Message ID */
  id: string;
  /** Author metadata */
  author: UserMeta;
  /** Message text content */
  text: string;
  /** Creation timestamp */
  createdAt: Date | string;
  /** Optional reactions map */
  reactions?: Record<string, number> | any;
  /** Optional map tracking which users reacted with which emojis */
  reactionBy?: Record<string, Record<string, boolean>>;
}

/**
 * Thread view model for managing thread state
 */
export interface ThreadVM {
  /** Whether the thread panel is open */
  open: boolean;
  /** Optional header information */
  header?: { title: string; channel?: string };
  /** Optional root message that started the thread */
  root?: Message;
  /** Array of reply messages */
  replies: Message[];
  /** Optional channel or conversation ID */
  channelId?: string;
  /** Whether this is a direct message thread */
  isDM?: boolean;
}

/**
 * Firestore document structure for a reply
 */
export type ReplyDoc = {
  /** Reply text content */
  text: string;
  /** Author user ID */
  authorId: string;
  /** Author display name */
  authorName: string;
  /** Optional author avatar URL */
  authorAvatar?: string;
  /** Optional creation timestamp */
  createdAt?: any;
  /** Optional reactions map */
  reactions?: Record<string, number> | any;
};

/**
 * Workspace search result (deprecated, use SearchResult)
 */
export type WsSearchResult =
  | { kind: 'channel'; id: string; name: string }
  | { kind: 'user'; id: string; name: string; avatarUrl?: string }
  | { kind: 'message'; channelId: string; text: string };

/**
 * Search result union type
 */
export type SearchResult =
  | { kind: 'channel'; id: string; name: string }
  | { kind: 'user'; id: string; name: string; avatarUrl?: string }
  | { kind: 'message'; channelId: string; text: string };

/**
 * User data for header display
 */
export type HeaderUser = {
  /** User ID */
  id: string;
  /** User display name */
  name: string;
  /** User email */
  email: string;
  /** User status */
  status: 'active' | 'away';
  /** Avatar URL */
  avatarUrl: string;
  /** Online status */
  online: boolean;
};

/**
 * Profile view mode: viewing or editing
 */
export type ProfileView = 'view' | 'edit' | 'avatar';

/**
 * User representation for mentions in messages
 */
export type MentionUser = { id: string; name: string; avatarUrl?: string };

/**
 * Extracts only channel results from WsSearchResult union type
 */
export type WsChannelResult = Extract<WsSearchResult, { kind: 'channel' }>;
