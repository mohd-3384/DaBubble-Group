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
