export interface SenderInfo {
  id: string;
  codename?: string;
}

export interface MessagePayload {
  messageId: string; // Primary Key
  conversationId: string; // Indexed for fetching room history
  from: SenderInfo;
  contentType: string;
  ciphertext: string;
  timestamp: number; // Indexed for chronological sorting
  status?: "sent" | "delivered" | "read"; // Read receipt status tracking
  deliveredTo?: string[];
  readBy?: string[];
  meta?: Record<string, unknown>;
}

export interface KeyRecord {
  id: string; // The user's unique ID or userId:dsa (Primary Key)
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
}

export interface ContactRecord {
  id: string; // Primary Key
  incognitoId: string;
  codename: string;
  publicKey?: JsonWebKey;
  publicKeyDsa?: JsonWebKey;
  members?: string;
  isRoom?: boolean;
  passphrase?: string;
  creatorId?: string;
}

export interface SenderKeyRecord {
  id: string; // composite key: groupId:senderId
  groupId: string;
  senderId: string;
  keyId: string;
  chainKeyHex: string;
  counter: number;
  distributedTo?: string[];
}
