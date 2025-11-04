export interface ChannelDoc {
  id: string;
  name: string;
  memberCount: number;
  messageCount: number;
  lastMessageAt?: any;
  lastReplyAt?: any;
  createdBy: string;
  topic?: string;

}
