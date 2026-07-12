import axios from "axios";
import { E2EECryptoUtils } from "./e2ee-cryptosystem";
import { db } from "../../db/database";
import { globalChatStream } from "../websockets/global-stream";
import type { Base64, Envelope } from "../websockets/types/websocket.type";
import { msgLog, dbLog, cryptoLog, logger } from "../logger";

/**
 * MessageSystem provides modular encapsulation for end-to-end encrypted (E2EE)
 * message sending, signing, envelope wrapping, and local database storage.
 */
export class MessageSystem {
  /**
   * Encrypts and transmits a 1-to-1 secure E2EE message to a recipient.
   * Also stores the plaintext message locally in IndexedDB.
   *
   * @param params - Messaging payload and identity attributes
   * @returns Promise resolving to the generated messageId
   */
  static async send1to1Message(params: {
    senderId: string;
    recipientId: string;
    messageText: string;
    senderCodename: string;
    senderIncognitoId: string;
  }): Promise<string> {
    const { senderId, recipientId, messageText, senderCodename, senderIncognitoId } = params;
    msgLog("▶ send1to1Message()", { senderId, recipientId, textLength: messageText.length });

    // 1. Fetch our own keys
    msgLog("  [1] Fetching sender ECDH + ECDSA keys from IndexedDB...");
    const ourEcdhKey = await db.keys.get(senderId);
    const ourEcdsaKey = await db.keys.get(`${senderId}:dsa`);

    if (!ourEcdhKey || !ourEcdsaKey) {
      logger.error("[MSG-SYSTEM]", "send1to1Message: Local cryptographic keys missing for sender", { senderId });
      throw new Error("Local cryptographic keys missing for sender.");
    }
    msgLog("  [1] ✔ Sender keys found");

    // 2. Fetch contact keys
    msgLog("  [2] Fetching recipient contact from IndexedDB...", { recipientId });
    const contact = await db.contacts.get(recipientId);
    if (!contact || !contact.publicKey || !contact.publicKeyDsa || Object.keys(contact.publicKey).length === 0) {
      logger.error("[MSG-SYSTEM]", "send1to1Message: Recipient public keys missing", { recipientId, contact });
      throw new Error("Recipient public keys missing.");
    }
    msgLog("  [2] ✔ Recipient keys found", { codename: contact.codename });

    // 3. Derive shared secret via ECDH
    cryptoLog("  [3] Deriving ECDH shared secret...");
    const sharedHexKey = await E2EECryptoUtils.deriveSharedSecret(
      ourEcdhKey.privateKey,
      contact.publicKey
    );
    cryptoLog("  [3] ✔ Shared secret derived");

    // 4. Encrypt message text
    cryptoLog("  [4] Encrypting with AES-GCM-256...");
    const cipherPkg = await E2EECryptoUtils.encrypt1to1(
      sharedHexKey,
      messageText
    );
    cryptoLog("  [4] ✔ Message encrypted");

    // 5. Sign the ciphertext
    cryptoLog("  [5] Signing ciphertext with ECDSA...");
    const signatureB64 = await E2EECryptoUtils.signMessage(
      ourEcdsaKey.privateKey,
      cipherPkg.ciphertext
    );
    cryptoLog("  [5] ✔ Ciphertext signed");

    const messageId = crypto.randomUUID();
    msgLog("  Generated messageId", { messageId });

    // 6. Build the transmission envelope
    const envelope: Envelope = {
      id: messageId,
      to: [recipientId],
      type: "message",
      payload: {
        from: {
          id: senderId,
          deviceId: "rig_alpha",
        },
        contentType: "text/plain",
        encryption: {
          alg: "AES-GCM-256",
          iv: cipherPkg.iv as Base64,
        },
        ciphertext: cipherPkg.ciphertext as Base64,
        sig: {
          alg: "ECDSA-P256-SHA256",
          value: signatureB64 as Base64,
        },
        meta: {
          senderCodename,
          senderIncognitoId,
          senderPublicKey: ourEcdhKey.publicKey,
          senderPublicKeyDsa: ourEcdsaKey.publicKey,
        },
      },
    };
    logger.group("[MSG-SYSTEM]", `[6] Envelope built → ${recipientId}`, envelope);

    // 7. Transmit envelope over global WebSocket stream
    msgLog("  [7] Transmitting envelope over WebSocket...");
    globalChatStream.send(envelope);
    msgLog("  [7] ✔ Envelope transmitted");

    // 8. Save local message to Dexie DB (plain text stored in `ciphertext` column)
    dbLog("  [8] Saving sent message to IndexedDB...", { messageId, conversationId: recipientId });
    await db.messages.put({
      messageId: envelope.id,
      conversationId: recipientId,
      from: {
        id: senderId,
        codename: senderCodename,
      },
      contentType: "text/plain",
      ciphertext: messageText,
      timestamp: Date.now(),
      status: "sent",
    });
    dbLog("  [8] ✔ Message persisted");

    return messageId;
  }

  /**
   * Generates and distributes our sender key for a secure Room to all active members.
   */
  static async establishGroupSenderKey(params: {
    senderId: string;
    roomId: string;
    senderCodename: string;
    senderIncognitoId: string;
    memberIds: string[];
    forceResend?: boolean;
  }): Promise<{ keyId: string; chainKeyHex: string }> {
    const { senderId, roomId, senderCodename, senderIncognitoId, memberIds, forceResend } = params;
    msgLog("▶ establishGroupSenderKey()", { senderId, roomId, memberCount: memberIds.length, memberIds });

    // 1. Check if we already have a sender key bundle for this room
    const bundleRecord = await db.senderKeys.get(`${senderId}:${roomId}`);
    let bundle: { keyId: string; chainKeyHex: string; counter?: number };
    const distributedTo: string[] = bundleRecord?.distributedTo ? [...bundleRecord.distributedTo] : [];
    if (!bundleRecord) {
      cryptoLog("  [1] No existing sender key — generating new bundle...", { roomId });
      const generated = await E2EECryptoUtils.generateSenderKey();
      bundle = {
        keyId: generated.keyId,
        chainKeyHex: generated.chainKeyHex,
        counter: 0,
      };
      await db.senderKeys.put({
        id: `${senderId}:${roomId}`,
        groupId: roomId,
        senderId,
        keyId: bundle.keyId,
        chainKeyHex: bundle.chainKeyHex,
        counter: 0,
        distributedTo,
      });
      cryptoLog("  [1] ✔ Sender key generated and stored", { keyId: bundle.keyId });
    } else {
      bundle = {
        keyId: bundleRecord.keyId,
        chainKeyHex: bundleRecord.chainKeyHex,
        counter: bundleRecord.counter || 0,
      };
      cryptoLog("  [1] Existing sender key found", { keyId: bundle.keyId, counter: bundleRecord.counter });
    }

    // 2. For each active member (except ourselves), encrypt and distribute this key
    msgLog("  [2] Fetching our own ECDH + ECDSA keys...");
    const ourEcdhKey = await db.keys.get(senderId);
    const ourEcdsaKey = await db.keys.get(`${senderId}:dsa`);

    if (!ourEcdhKey || !ourEcdsaKey) {
      logger.error("[MSG-SYSTEM]", "establishGroupSenderKey: Missing local keys", { senderId });
      throw new Error("Missing local keys for group key distribution.");
    }

    for (const peerId of memberIds) {
      if (peerId === senderId || peerId === "") {
        msgLog(`  Skipping self/empty peer`, { peerId });
        continue;
      }
      if (!forceResend && distributedTo.includes(peerId)) {
        msgLog(`  Already distributed sender key to peer — skipping`, { peerId });
        continue;
      }

      msgLog(`  Processing peer`, { peerId });
      let peerContact = await db.contacts.get(peerId);
      if (!peerContact || !peerContact.publicKey || !peerContact.publicKeyDsa) {
        msgLog("  Peer not in local contacts — fetching from search API...", { peerId });
        try {
          const backendUrl = import.meta.env.VITE_BACKEND_HTTP_URL || "http://localhost:8080";
          const res = await axios.post(`${backendUrl}/api/search`, { query: peerId }, { withCredentials: true });
          const found = Array.isArray(res.data)
            ? res.data.find((c: { id: string; handshakeJWK?: JsonWebKey; identityJWK?: JsonWebKey; codename?: string; incognitoId?: string }) => c.id === peerId)
            : null;
          if (found && found.handshakeJWK && found.identityJWK) {
            peerContact = {
              id: found.id,
              codename: found.codename || found.id,
              incognitoId: found.incognitoId || "avatar_001.png",
              publicKey: found.handshakeJWK,
              publicKeyDsa: found.identityJWK,
            };
            await db.contacts.put(peerContact);
            msgLog("  ✔ Peer fetched from server and cached", { peerId, codename: peerContact.codename });
          } else {
            logger.warn("[MSG-SYSTEM]", `Peer ${peerId} not found in server registry`);
          }
        } catch (err) {
          logger.error("[MSG-SYSTEM]", `Failed to fetch public keys for room member ${peerId}`, err);
        }
      } else {
        msgLog("  Peer found in local contacts", { peerId, codename: peerContact.codename });
      }

      if (!peerContact || !peerContact.publicKey || !peerContact.publicKeyDsa) {
        logger.warn("[MSG-SYSTEM]", `Skipping peer ${peerId} — public keys unavailable after lookup`);
        continue;
      }

      try {
        cryptoLog(`  Deriving shared secret with peer ${peerId}...`);
        const sharedHexKey = await E2EECryptoUtils.deriveSharedSecret(
          ourEcdhKey.privateKey,
          peerContact.publicKey
        );

        const packet = await E2EECryptoUtils.distributeSenderKeyToPeer(
          senderId,
          sharedHexKey,
          roomId,
          bundle
        );
        cryptoLog(`  ✔ Sender key packet encrypted for peer`, { peerId });

        const cipherText = JSON.stringify(packet);

        const signatureB64 = await E2EECryptoUtils.signMessage(
          ourEcdsaKey.privateKey,
          cipherText
        );

        const envelope: Envelope = {
          id: crypto.randomUUID(),
          to: [peerId],
          type: "message",
          payload: {
            from: {
              id: senderId,
              deviceId: "rig_alpha",
            },
            contentType: "application/x-sender-key",
            encryption: {
              alg: "AES-GCM-256",
              iv: packet.iv as Base64,
            },
            ciphertext: cipherText as Base64,
            sig: {
              alg: "ECDSA-P256-SHA256",
              value: signatureB64 as Base64,
            },
            meta: {
              senderCodename,
              senderIncognitoId,
              groupId: roomId,
              isRoom: true,
            },
          },
        };

        msgLog(`  ▶ Sending sender-key envelope to peer`, { peerId });
        globalChatStream.send(envelope);
        if (!distributedTo.includes(peerId)) {
          distributedTo.push(peerId);
          await db.senderKeys.update(`${senderId}:${roomId}`, { distributedTo });
        }
        msgLog(`  ✔ Sender key distributed to peer`, { peerId });
      } catch (err) {
        logger.error("[MSG-SYSTEM]", `Failed to distribute sender key to peer ${peerId}`, err);
      }
    }

    msgLog("✔ establishGroupSenderKey() complete", { keyId: bundle.keyId });
    return bundle;
  }

  /**
   * Encrypts and transmits a secure room message to all members of the room using our Sender Key.
   */
  static async sendRoomMessage(params: {
    senderId: string;
    roomId: string;
    messageText: string;
    senderCodename: string;
    senderIncognitoId: string;
  }): Promise<string> {
    const { senderId, roomId, messageText, senderCodename, senderIncognitoId } = params;
    msgLog("▶ sendRoomMessage()", { senderId, roomId, textLength: messageText.length });

    // 1. Fetch the room's members list
    const roomContact = await db.contacts.get(roomId);
    if (!roomContact || !roomContact.isRoom) {
      logger.error("[MSG-SYSTEM]", "sendRoomMessage: Target room not found in registry", { roomId });
      throw new Error("Target secure room not found in registry.");
    }

    const memberIds = (roomContact.members || "").split(",").map(m => m.trim()).filter(Boolean);
    msgLog("  Room member list", { roomId, count: memberIds.length, memberIds });

    // 2. Ensure all current room members have our sender key
    msgLog("  [2] Establishing group sender key for all members...");
    await MessageSystem.establishGroupSenderKey({
      senderId,
      roomId,
      senderCodename,
      senderIncognitoId,
      memberIds,
    });
    const keyRecord = await db.senderKeys.get(`${senderId}:${roomId}`);
    if (!keyRecord) {
      logger.error("[MSG-SYSTEM]", "sendRoomMessage: Failed to initialize group sender key", { roomId });
      throw new Error("Failed to initialize group sender key.");
    }
    msgLog("  [2] ✔ Group sender key ready", { keyId: keyRecord.keyId, counter: keyRecord.counter });

    // 3. Encrypt room message using group ratchet key material
    cryptoLog("  [3] Group-encrypting message via ratchet...");
    const { transportPayload, nextChainKeyHex } = await E2EECryptoUtils.groupEncrypt(
      roomId,
      messageText,
      keyRecord.chainKeyHex,
      keyRecord.keyId,
      keyRecord.counter
    );
    cryptoLog("  [3] ✔ Message encrypted", { keyId: transportPayload.keyId, counter: transportPayload.counter });

    // 4. Update local sender key database state
    dbLog(`  [4] Advancing chain key counter ${keyRecord.counter} → ${keyRecord.counter + 1}`);
    await db.senderKeys.put({
      ...keyRecord,
      chainKeyHex: nextChainKeyHex,
      counter: keyRecord.counter + 1,
    });

    // 5. Sign the ciphertext using our ECDSA private key
    const ourEcdsaKey = await db.keys.get(`${senderId}:dsa`);
    if (!ourEcdsaKey) {
      logger.error("[MSG-SYSTEM]", "sendRoomMessage: Missing local private signing key");
      throw new Error("Missing local private signing key.");
    }

    cryptoLog("  [5] Signing room ciphertext with ECDSA...");
    const signatureB64 = await E2EECryptoUtils.signMessage(
      ourEcdsaKey.privateKey,
      transportPayload.cipher
    );
    cryptoLog("  [5] ✔ Room ciphertext signed");

    const messageId = crypto.randomUUID();
    msgLog("  Generated messageId", { messageId });

    // 6. Build the group transmission envelope
    const envelope: Envelope = {
      id: messageId,
      to: [roomId],
      type: "message",
      payload: {
        from: {
          id: senderId,
          deviceId: "rig_alpha",
        },
        contentType: "text/plain",
        encryption: {
          alg: "AES-GCM-256",
          iv: transportPayload.iv as Base64,
        },
        ciphertext: transportPayload.cipher as Base64,
        sig: {
          alg: "ECDSA-P256-SHA256",
          value: signatureB64 as Base64,
        },
        meta: {
          isRoom: true,
          senderCodename,
          senderIncognitoId,
          keyId: transportPayload.keyId,
          counter: transportPayload.counter,
        },
      },
    };
    logger.group("[MSG-SYSTEM]", `[6] Room envelope built → ${roomId}`, envelope);

    // 7. Transmit to secure node relay
    msgLog("  [7] Transmitting room envelope over WebSocket...");
    globalChatStream.send(envelope);
    msgLog("  [7] ✔ Room message transmitted");

    // 8. Save local message to Dexie DB (plain text stored in `ciphertext` column)
    dbLog("  [8] Saving room message to IndexedDB...", { messageId, conversationId: roomId });
    await db.messages.put({
      messageId: envelope.id,
      conversationId: roomId,
      from: {
        id: senderId,
        codename: senderCodename,
      },
      contentType: "text/plain",
      ciphertext: messageText,
      timestamp: Date.now(),
      status: "sent",
      deliveredTo: [],
      readBy: [],
    });
    dbLog("  [8] ✔ Room message persisted");

    return messageId;
  }

  /**
   * Advances the chain key ratchets and derives the sequence-specific message key.
   */
  static async advanceChainAndDeriveKey(
    chainKeyHex: string,
    targetCounter: number,
    currentCounter: number
  ): Promise<{ messageKeyBuffer: ArrayBuffer; nextChainKeyHex: string }> {
    const steps = Math.max(1, (targetCounter || 0) - (currentCounter || 0));
    cryptoLog("advanceChainAndDeriveKey()", { currentCounter, targetCounter, steps });
    const encoder = new TextEncoder();
    let chainKeyBuffer = E2EECryptoUtils.fromHex(chainKeyHex);
    let messageKeyBuffer = new ArrayBuffer(0);

    for (let i = 0; i < steps; i++) {
      const hmacBaseKey = await crypto.subtle.importKey(
        "raw",
        E2EECryptoUtils.toArrayBuffer(chainKeyBuffer),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );

      messageKeyBuffer = await crypto.subtle.sign(
        "HMAC",
        hmacBaseKey,
        encoder.encode("Message Key")
      );

      const advancedChainBuffer = await crypto.subtle.sign(
        "HMAC",
        hmacBaseKey,
        encoder.encode("Chain Key")
      );

      chainKeyBuffer = new Uint8Array(advancedChainBuffer);
    }

    cryptoLog("advanceChainAndDeriveKey() ✔ complete", { steps });
    return {
      messageKeyBuffer,
      nextChainKeyHex: E2EECryptoUtils.toHex(chainKeyBuffer),
    };
  }
}
