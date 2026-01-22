export interface Vm {
  kind: 'channel' | 'dm';
  title: string;
  avatarUrl?: string;
  online?: boolean;
}

export interface ChannelDoc {
  id?: string;
  createdBy?: string;
  createdAt?: any;
  memberCount?: number;
  messageCount?: number;
  lastMessageAt?: any;
  lastMessageBy?: string | null;
  lastReplyAt?: any;
  topic?: string;
}

export interface UserDoc {
  id?: string;
  name: string;
  email: string;
  status: 'active' | 'away';
  avatarUrl: string;
  online?: boolean;
  lastSeen?: any;
  role?: 'member' | 'guest';
}

export interface UserMini {
  id: string;
  name: string;
  avatarUrl?: string;
  online?: boolean;
  status?: 'active' | 'away';
}

export interface MessageVm {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  createdAt: Date | null;
  replyCount: number;
  lastReplyAt: Date | null;
  reactions?: Record<string, number>;
  reactionBy?: Record<string, Record<string, boolean>>;
}

export interface DayGroup {
  label: string;
  isToday: boolean;
  items: MessageVm[];
};

export interface MemberDenorm {
  uid: string;
  displayName?: string;
  avatarUrl?: string;
  joinedAt?: Date | null;
  role?: 'member' | 'admin';
};

export interface MemberVM {
  uid: string;
  name: string;
  avatarUrl?: string;
  online?: boolean;
};

export type TargetKind = 'channel' | 'user' | 'email';

export interface SuggestItem {
  kind: TargetKind;
  id?: string;
  label: string;
  value: string;
  avatarUrl?: string;
}

export interface UserMeta {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface Reaction {
  emoji: string;
  count: number;
}

export interface Message {
  id: string;
  author: UserMeta;
  text: string;
  createdAt: Date | string;
  reactions?: Reaction[];
}

export interface ThreadVM {
  open: boolean;
  header?: { title: string; channel?: string };
  root?: Message;
  replies: Message[];
  channelId?: string;
}

export type ReplyDoc = {
  text: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  createdAt?: any;
  reactions?: Record<string, number> | any;
};
