export interface ChannelDoc {
  id: string;
  createdBy?: string;
  createdAt?: any;
  memberCount?: number;
  messageCount?: number;
  lastMessageAt?: any;
  lastMessageBy?: string | null;
  lastReplyAt?: any;
  topic?: string;
}
