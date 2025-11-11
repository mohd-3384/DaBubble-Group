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
