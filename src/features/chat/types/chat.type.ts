import type { ContactRecord } from "../../../db/types/database.type";

export interface ChatUserContact extends Partial<ContactRecord> {
  id: string;
  codename: string;
  incognitoId: string;
  time?: string;
  activeNow?: boolean;
  hasUnread?: boolean;
  unreadCount?: number;
  lastMessageText?: string;
  lastMessageTimestamp?: number;
}
