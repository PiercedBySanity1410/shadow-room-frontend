import Dexie, { type Table } from "dexie";
import type { KeyRecord, MessagePayload, ContactRecord, SenderKeyRecord } from "./types/database.type";

class ShadowRoomDatabase extends Dexie {
  keys!: Table<KeyRecord, string>;
  messages!: Table<MessagePayload, string>;
  contacts!: Table<ContactRecord, string>;
  senderKeys!: Table<SenderKeyRecord, string>;

  constructor() {
    super("ShadowRoomDB");

    this.version(1).stores({
      keys: "id",
      messages: "messageId, conversationId, timestamp",
      contacts: "id, codename",
    });

    this.version(2).stores({
      keys: "id",
      messages: "messageId, conversationId, timestamp, status",
      contacts: "id, codename",
    }).upgrade((trans) => {
      return trans.table("messages").toCollection().modify((msg) => {
        if (!msg.status) {
          msg.status = "read"; // Existing messages are already seen
        }
      });
    });

    this.version(3).stores({
      keys: "id",
      messages: "messageId, conversationId, timestamp, status",
      contacts: "id, codename, isRoom",
      senderKeys: "id, groupId, senderId",
    });
  }
}

export const db = new ShadowRoomDatabase();
