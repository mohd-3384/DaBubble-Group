export interface Vm {
  kind: 'channel' | 'dm';
  title: string;
  avatarUrl?: string;
  online?: boolean;
}

export interface ChannelDoc {
  messageCount?: number;
  createdAt?: any;
  createdBy?: string;
};

export interface MessageVm {
  id: string;
  text: string;
  authorName: string;
  authorAvatar?: string;
  createdAt?: Date | null;
  replyCount?: number;
  lastReplyAt?: Date | null;
};

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
  avatarUrl?: string
};

export type TargetKind = 'channel' | 'user' | 'email';

export interface SuggestItem {
  kind: TargetKind;
  id?: string;
  label: string;
  value: string;
  avatarUrl?: string;
}
