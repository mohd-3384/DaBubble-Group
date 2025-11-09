export interface Vm {
  kind: 'channel' | 'dm';
  title: string;
  avatarUrl?: string;
  online?: boolean;
}
