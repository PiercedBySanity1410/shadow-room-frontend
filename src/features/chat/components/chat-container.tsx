/* eslint-disable react-refresh/only-export-components */
import React, { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { ChatList } from "./chat-list";
import type { ChatUserContact } from "../types/chat.type";
import { useStore } from "../../../core/store/useStore";
import "../styles/chat.scss";
import { PlusIcon, SearchIcon } from "../../../shared/components/icons/icons";
import { useModal } from "../../../modals/useModal";
import { CreateRoomModal } from "../../../modals/components/create-room-modal";
import axios from "axios";
import { db } from "../../../db/database";
import type { ContactRecord } from "../../../db/types/database.type";
import { subscribeToChatStream, globalChatStream } from "../../../core/websockets/global-stream";
import { E2EECryptoUtils } from "../../../core/crypto/e2ee-cryptosystem";
import { MessageSystem } from "../../../core/crypto/message-system";
import { chatLog, roomLog, rcptLog, secLog, dbLog, msgLog, logger } from "../../../core/logger";



const pendingKeyRequests = new Set<string>();

const requestSenderKeyDebounced = (peerId: string, roomId: string, myId: string) => {
  const requestKey = `${peerId}:${roomId}`;
  if (pendingKeyRequests.has(requestKey)) {
    chatLog(`REQUEST_SENDER_KEYS debounced (already pending)`, { peerId, roomId });
    return;
  }
  pendingKeyRequests.add(requestKey);
  setTimeout(() => pendingKeyRequests.delete(requestKey), 5000);

  chatLog(`▶ Sending REQUEST_SENDER_KEYS`, { peerId, roomId, myId });
  globalChatStream.send({
    id: crypto.randomUUID(),
    type: "command",
    to: [peerId],
    payload: {
      code: "REQUEST_SENDER_KEYS",
      targetId: roomId,
      message: myId,
    },
  });
};

export function formatMessageTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } else {
    return date.toLocaleDateString();
  }
}
/* ChatContainer serves as the main navigation shell, displaying the sidebar list
* of active conversations, an operative search mechanism, and rendering selected rooms in an Outlet.
*/
export const ChatContainer: React.FC = () => {
  const { openModal } = useModal();
  const location = useLocation();
  const navigate = useNavigate();

  const {
    activeChats,
    isLoading,
    setIsLoading,
    setActiveChats,
    addActiveChat,
    updateChatStatus,
    incrementUnread,
  } = useStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ChatUserContact[]>([]);
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  const [isContactsLoaded, setIsContactsLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.innerWidth < 768
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    /**
     * Executes fuzzy search query against the node registry.
     * Maps response fields from ServerUserResponse to ChatUserContact typings.
     */
    const performSearch = async () => {
      if (debouncedQuery.length < 2) {
        setSearchResults([]);
        return;
      }
      chatLog(`Search triggered`, { query: debouncedQuery });
      try {
        const backendUrl =
          import.meta.env.VITE_BACKEND_HTTP_URL || "http://localhost:8080";

        const response = await axios.post(
          `${backendUrl}/api/search`,
          { query: debouncedQuery },
          { withCredentials: true },
        );

        const formattedResults: ChatUserContact[] = response.data.map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (srvUser: any) => ({
            id: srvUser.id,
            codename: srvUser.codename,
            incognitoId: srvUser.incognitoId,
            activeNow: srvUser.activeNow ?? false,
            publicKey: srvUser.handshakeJWK || ({} as JsonWebKey),
            publicKeyDsa: srvUser.identityJWK || ({} as JsonWebKey),
            isRoom: srvUser.isRoom ?? false,
          }),
        );

        setSearchResults(formattedResults);
      } catch (err) {
        console.error("Search failed:", err);
      }
    };

    performSearch();
  }, [debouncedQuery]);



  // Load contacts from IndexedDB into store on startup
  useEffect(() => {
    const loadContacts = async () => {
      chatLog("loadContacts() — reading IndexedDB contacts on startup");
      try {
        const stored = await db.contacts.toArray();
        chatLog(`IndexedDB contacts loaded`, { count: stored.length });
        if (stored.length > 0) {
          const chatsWithLastMessage = await Promise.all(
            stored.map(async (c) => {
              const msgs = await db.messages
                .where("conversationId")
                .equals(c.id)
                .sortBy("timestamp");
              const last = msgs[msgs.length - 1];
              const formattedTime = last
                ? formatMessageTimestamp(last.timestamp)
                : "";
              const currentUserId = localStorage.getItem("user_id") || "";
              const isMine = last?.from?.id === currentUserId;
              let lastMessageText = "";
              if (last) {
                if (isMine) {
                  lastMessageText = `You: ${last.ciphertext}`;
                } else if (c.isRoom) {
                  const senderName = last.from?.codename || "Anonymous Agent";
                  lastMessageText = `${senderName}: ${last.ciphertext}`;
                } else {
                  lastMessageText = last.ciphertext;
                }
              }
              const currentChats = useStore.getState().activeChats;
              const existing = currentChats.find((chat) => chat.id === c.id);
              return {
                id: c.id,
                codename: c.codename,
                incognitoId: c.incognitoId,
                time: formattedTime,
                activeNow: existing?.activeNow ?? false,
                hasUnread: existing?.hasUnread ?? false,
                publicKey: c.publicKey,
                publicKeyDsa: c.publicKeyDsa,
                lastMessageText,
                lastMessageTimestamp: last ? last.timestamp : 0,
                isRoom: c.isRoom,
                passphrase: c.passphrase,
              };
            })
          );
          chatsWithLastMessage.sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0));
          setActiveChats(chatsWithLastMessage);
        }
        setIsContactsLoaded(true);
        setIsLoading(false);
      } catch (error) {
        console.error(
          "Failed to load contacts from IndexedDB on startup:",
          error,
        );
        setIsContactsLoaded(true);
        setIsLoading(false);
      }
    };
    loadContacts();
  }, [setActiveChats, setIsLoading]);

  // Automatically sync activeChats state updates back to IndexedDB
  useEffect(() => {
    const syncToDB = async () => {
      try {
        for (const chat of activeChats) {
          const existing = await db.contacts.get(chat.id);
          await db.contacts.put({
            id: chat.id,
            codename: chat.codename,
            incognitoId: chat.incognitoId,
            publicKey:
              chat.publicKey || existing?.publicKey || ({} as JsonWebKey),
            publicKeyDsa:
              chat.publicKeyDsa || existing?.publicKeyDsa || ({} as JsonWebKey),
            isRoom: chat.isRoom ?? existing?.isRoom,
            passphrase: chat.passphrase ?? existing?.passphrase,
            creatorId: existing?.creatorId,
            members: existing?.members,
          });
        }
      } catch (error) {
        console.error("Failed to sync active chats to IndexedDB:", error);
      }
    };
    if (activeChats.length > 0) {
      syncToDB();
    }
  }, [activeChats]);

  // Re-join active rooms on backend to ensure server-side room.Members map is always populated.
  //
  // This only needs to happen once per successful connection (initial load, and again after
  // any reconnect, since the server's in-memory room registry doesn't survive a restart) --
  // NOT every time activeChats changes for an unrelated reason like a new message arriving or
  // an unread counter bumping. Depending on `activeChats` directly caused this to re-fire (and
  // re-send JOIN_ROOM for every room the user is in) on practically every incoming packet, which
  // spammed the relay with redundant JOIN_ROOM/GET_ROOM_MEMBERS traffic and repeated
  // JOIN_ROOM_FAIL noise. joinedRoomsRef tracks what's already been (re-)joined for the current
  // connection; it's cleared whenever FLUSH_COMPLETE fires again (i.e. on reconnect) so a fresh
  // server-side registry still gets properly repopulated.
  const syncedRoomsRef = React.useRef<Set<string>>(new Set());

  const syncActiveRoomMembers = React.useCallback(() => {
    const rooms = useStore.getState().activeChats.filter(c => c.isRoom);
    roomLog(`syncActiveRoomMembers() called`, { totalRooms: rooms.length });
    for (const chat of rooms) {
      if (!syncedRoomsRef.current.has(chat.id)) {
        syncedRoomsRef.current.add(chat.id);
        roomLog(`  ▶ Sending GET_ROOM_MEMBERS`, { roomId: chat.id });
        try {
          globalChatStream.send({
            id: crypto.randomUUID(),
            type: "command",
            to: [],
            payload: {
              code: "GET_ROOM_MEMBERS",
              targetId: chat.id,
            },
          });
        } catch (e) {
          logger.error("[CHAT-ROOM-SYNC]", `Failed to sync room members for ${chat.id}`, e);
        }
      } else {
        roomLog(`  Already synced — skipping`, { roomId: chat.id });
      }
    }
  }, []);

  useEffect(() => {
    if (!isContactsLoaded) return;
    syncActiveRoomMembers();
  }, [isContactsLoaded, syncActiveRoomMembers]);

  // Check for invite links in query params and join if present
  useEffect(() => {
    if (!isContactsLoaded) return;
    const params = new URLSearchParams(window.location.search);
    const inviteRoomId = params.get("roomId");
    const invitePassphrase = params.get("passphrase");

    if (inviteRoomId && invitePassphrase) {
      try {
        globalChatStream.send({
          id: crypto.randomUUID(),
          type: "command",
          to: [],
          payload: {
            code: "JOIN_ROOM",
            targetId: inviteRoomId,
            passphrase: invitePassphrase,
          },
        });

        db.contacts.put({
          id: inviteRoomId,
          codename: inviteRoomId,
          incognitoId: `avatar_${String(Math.floor(Math.random() * 202) + 1).padStart(3, "0")}.png`,
          isRoom: true,
          passphrase: invitePassphrase,
        }).then(() => {
          useStore.getState().addActiveChat({
            id: inviteRoomId,
            codename: inviteRoomId,
            incognitoId: `avatar_${String(Math.floor(Math.random() * 202) + 1).padStart(3, "0")}.png`,
            isRoom: true,
            passphrase: invitePassphrase,
            activeNow: true,
            unreadCount: 0,
            lastMessageText: "Joined via invite link.",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          });
          setIsLoading(false);
          navigate(`/chat/${inviteRoomId}`);
        });

        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (err) {
        console.error("Failed to join room via invite link:", err);
        setIsLoading(false);
      }
    }
  }, [isContactsLoaded, navigate, setIsLoading]);

  // Global chat stream subscriber hook
  useEffect(() => {
    if (!isContactsLoaded) return;

    const unsubscribe = subscribeToChatStream(async (envelope) => {
      chatLog(`◀ Packet arrived  type=${envelope.type}  code=${(envelope.payload as { code?: string })?.code ?? "—"}  from=${envelope.from ?? "server"}  id=${envelope.id ?? "?"}`, envelope);

      if (envelope.type === "command") {
        const payload = envelope.payload;
        if (payload.code === "STATUS_UPDATE" && payload.targetId) {
          chatLog(`STATUS_UPDATE`, { targetId: payload.targetId, status: payload.message });
          updateChatStatus(payload.targetId, payload.message === "online");
        } else if (payload.code === "FLUSH_COMPLETE") {
          chatLog("FLUSH_COMPLETE — relay registration acknowledged, re-joining rooms");
          setIsLoading(false);
          // A fresh FLUSH_COMPLETE means we just (re)registered with the relay, so its
          // in-memory room registry may have lost our membership (e.g. server restart).
          // Clear the dedup set and re-send JOIN_ROOM for everything we should be in.
          syncedRoomsRef.current.clear();
          syncActiveRoomMembers();

          // Re-run group sender-key distribution for every room we're in. The normal
          // triggers (ROOM_MEMBERS / ROOM_MEMBER_JOINED / REQUEST_SENDER_KEYS) only fire
          // once, at the moment they're received -- if that moment lands in the gap of a
          // reconnect (exactly what a flapping connection produces), the key packet is
          // gone for good with nothing to prompt a retry. Treating every successful
          // reconnect as a chance to re-sync keys for all rooms closes that gap.
          (async () => {
            const currentUserId = localStorage.getItem("user_id") || "";
            if (!currentUserId) return;
            for (const chat of useStore.getState().activeChats) {
              if (!chat.isRoom) continue;
              try {
                const roomContact = await db.contacts.get(chat.id);
                const memberIds = (roomContact?.members || "")
                  .split(",")
                  .map((m) => m.trim())
                  .filter(Boolean);
                if (memberIds.length === 0) continue;
                await MessageSystem.establishGroupSenderKey({
                  senderId: currentUserId,
                  roomId: chat.id,
                  senderCodename: useStore.getState().user?.codename || "Anonymous Agent",
                  senderIncognitoId: useStore.getState().user?.incognitoId || "avatar_001.png",
                  memberIds,
                });
              } catch (err) {
                console.error(`Failed to re-sync group sender key for room ${chat.id} on reconnect:`, err);
              }
            }
          })();
        } else if (payload.code === "MESSAGE_READ_ACK" && payload.message) {
          rcptLog("MESSAGE_READ_ACK received", { messageIds: payload.message, readerId: payload.targetId });
          // The recipient read our messages — update local DB statuses to 'read' after signature verification
          const readerId = payload.targetId;
          const signature = payload.signature;
          if (readerId && signature) {
            const contact = await db.contacts.get(readerId);
            if (contact && contact.isRoom) {
              rcptLog("  Room READ_ACK — skipping signature check (server-relayed)");
              // Bypass signature check for Room commands (relayed anonymously by trusted server)
            } else if (contact && contact.publicKeyDsa) {
              const currentUserId = localStorage.getItem("user_id") || "";
              const signString = `MESSAGE_READ|${payload.message}|${currentUserId}`;
              rcptLog("  Verifying read-receipt ECDSA signature...", { readerId, signString });
              const isValid = await E2EECryptoUtils.verifySignature(
                contact.publicKeyDsa,
                signString,
                signature
              );
              if (!isValid) {
                secLog(`Invalid read-receipt signature from ${readerId}`);
                return;
              }
              rcptLog("  ✔ Read-receipt signature valid");
            }
          }

          const currentUserId = localStorage.getItem("user_id") || "";
          const messageIds = payload.message.split(",");
          for (const rawMsgId of messageIds) {
            const msgId = rawMsgId.trim();
            const msg = await db.messages.get(msgId);
            if (msg) {
              const contact = await db.contacts.get(msg.conversationId);
              if (contact && contact.isRoom) {
                const readBy = Array.isArray(msg.readBy) ? [...msg.readBy] : [];
                if (readerId && readerId !== currentUserId && !readBy.includes(readerId)) {
                  readBy.push(readerId);
                }
                const roomMemberIds = (contact.members || "")
                  .split(",")
                  .map((m) => m.trim())
                  .filter((id) => id && id !== currentUserId);
                const requiredCount = Math.max(1, roomMemberIds.length);
                const newStatus = readBy.length >= requiredCount ? "read" : (msg.status || "sent");
                await db.messages.put({
                  ...msg,
                  readBy,
                  status: newStatus,
                });
              } else {
                await db.messages.where("messageId").equals(msgId).modify({ status: "read" });
              }
              window.dispatchEvent(new CustomEvent("read-receipt", { detail: { conversationId: msg.conversationId } }));
            }
          }
        } else if (payload.code === "MESSAGE_DELIVERED_ACK" && payload.message) {
          rcptLog("MESSAGE_DELIVERED_ACK received", { messageIds: payload.message, recipientId: payload.targetId });
          // The recipient received our messages — update local DB statuses to 'delivered' after signature verification
          const recipientId = payload.targetId;
          const signature = payload.signature;
          if (recipientId && signature) {
            const contact = await db.contacts.get(recipientId);
            if (contact && contact.isRoom) {
              rcptLog("  Room DELIVERED_ACK — skipping signature check (server-relayed)");
              // Bypass signature check for Room commands (relayed anonymously by trusted server)
            } else if (contact && contact.publicKeyDsa) {
              const currentUserId = localStorage.getItem("user_id") || "";
              const signString = `MESSAGE_DELIVERED|${payload.message}|${currentUserId}`;
              rcptLog("  Verifying delivery-receipt ECDSA signature...", { recipientId, signString });
              const isValid = await E2EECryptoUtils.verifySignature(
                contact.publicKeyDsa,
                signString,
                signature
              );
              if (!isValid) {
                secLog(`Invalid delivery-receipt signature from ${recipientId}`);
                return;
              }
              rcptLog("  ✔ Delivery-receipt signature valid");
            }
          }

          const currentUserId = localStorage.getItem("user_id") || "";
          const messageIds = payload.message.split(",");
          for (const rawMsgId of messageIds) {
            const msgId = rawMsgId.trim();
            const msg = await db.messages.get(msgId);
            if (msg && msg.status !== "read") {
              const contact = await db.contacts.get(msg.conversationId);
              if (contact && contact.isRoom) {
                const deliveredTo = Array.isArray(msg.deliveredTo) ? [...msg.deliveredTo] : [];
                if (recipientId && recipientId !== currentUserId && !deliveredTo.includes(recipientId)) {
                  deliveredTo.push(recipientId);
                }
                const roomMemberIds = (contact.members || "")
                  .split(",")
                  .map((m) => m.trim())
                  .filter((id) => id && id !== currentUserId);
                const requiredCount = Math.max(1, roomMemberIds.length);
                const newStatus = deliveredTo.length >= requiredCount ? "delivered" : (msg.status || "sent");
                await db.messages.put({
                  ...msg,
                  deliveredTo,
                  status: newStatus,
                });
              } else {
                await db.messages.where("messageId").equals(msgId).modify({ status: "delivered" });
              }
              window.dispatchEvent(new CustomEvent("read-receipt", { detail: { conversationId: msg.conversationId } }));
            }
          }
        } else if (payload.code === "ROOM_MEMBERS" && payload.targetId) {
          const roomId = payload.targetId;
          roomLog("ROOM_MEMBERS received", { roomId, members: payload.message });
          let contact = await db.contacts.get(roomId);
          if (!contact) {
            contact = {
              id: roomId,
              codename: roomId,
              incognitoId: `avatar_${String(Math.floor(Math.random() * 202) + 1).padStart(3, "0")}.png`,
              isRoom: true,
            };
          }
          contact.members = payload.message || "";
          await db.contacts.put(contact);
          dbLog("Room contact updated with member list", { roomId, members: contact.members });

          // Trigger E2EE group sender key distribution to current members
          const currentUserId = localStorage.getItem("user_id") || "";
          const members = (payload.message || "").split(",").map((m) => m.trim()).filter(Boolean);
          roomLog("  Distributing sender key to all room members", { roomId, count: members.length });
          try {
            await MessageSystem.establishGroupSenderKey({
              senderId: currentUserId,
              roomId,
              senderCodename: useStore.getState().user?.codename || "Anonymous Agent",
              senderIncognitoId: useStore.getState().user?.incognitoId || "avatar_001.png",
              memberIds: members,
            });
          } catch (err) {
            console.error("Failed to establish group sender key on join:", err);
          }
        } else if (payload.code === "ROOM_MEMBER_JOINED" && payload.targetId) {
          const roomId = payload.targetId;
          const newMemberId = payload.message || "";
          roomLog("ROOM_MEMBER_JOINED", { roomId, newMemberId });
          if (!newMemberId) return;
          let contact = await db.contacts.get(roomId);
          if (!contact) {
            contact = {
              id: roomId,
              codename: roomId,
              incognitoId: `avatar_${String(Math.floor(Math.random() * 202) + 1).padStart(3, "0")}.png`,
              isRoom: true,
            };
          }
          const members = (contact.members || "").split(",").map((m) => m.trim()).filter(Boolean);
          if (!members.includes(newMemberId)) {
            members.push(newMemberId);
            contact.members = members.join(",");
            await db.contacts.put(contact);
            dbLog("Room member list updated", { roomId, updatedMembers: contact.members });
          }

          // Distribute our E2EE sender key to the new member
          const currentUserId = localStorage.getItem("user_id") || "";
          if (newMemberId !== currentUserId) {
            roomLog("  Distributing sender key to new member", { newMemberId, roomId });
            try {
              await MessageSystem.establishGroupSenderKey({
                senderId: currentUserId,
                roomId,
                senderCodename: useStore.getState().user?.codename || "Anonymous Agent",
                senderIncognitoId: useStore.getState().user?.incognitoId || "avatar_001.png",
                memberIds: [newMemberId],
              });
            } catch (err) {
              console.error("Failed to establish group sender key for new member:", err);
            }
          }
        } else if (payload.code === "REQUEST_SENDER_KEYS" && payload.targetId) {
          const roomId = payload.targetId;
          const requestingUserId = payload.message || "";
          const currentUserId = localStorage.getItem("user_id") || "";
          roomLog("REQUEST_SENDER_KEYS received", { roomId, requestingUserId, currentUserId });
          if (requestingUserId && requestingUserId !== currentUserId) {
            roomLog("  Responding with our sender key...", { requestingUserId, roomId });
            try {
              await MessageSystem.establishGroupSenderKey({
                senderId: currentUserId,
                roomId,
                senderCodename: useStore.getState().user?.codename || "Anonymous Agent",
                senderIncognitoId: useStore.getState().user?.incognitoId || "avatar_001.png",
                memberIds: [requestingUserId],
              });
            } catch (err) {
              console.error("Failed to respond to REQUEST_SENDER_KEYS:", err);
            }
          }
        } else if (payload.code === "ROOM_MEMBER_LEFT" && payload.targetId) {
          const roomId = payload.targetId;
          const leavingMemberId = payload.message;
          roomLog("ROOM_MEMBER_LEFT", { roomId, leavingMemberId });
          const contact = await db.contacts.get(roomId);
          if (contact) {
            const members = (contact.members || "").split(",").map((m) => m.trim()).filter(Boolean);
            const filteredMembers = members.filter((m) => m !== leavingMemberId);
            contact.members = filteredMembers.join(",");
            await db.contacts.put(contact);
            dbLog("Room member list updated after leave", { roomId, remaining: contact.members });
          }
        } else if (payload.code === "ROOM_DELETED" && payload.targetId) {
          const roomId = payload.targetId;
          roomLog("ROOM_DELETED", { roomId });
          await db.contacts.delete(roomId);
          await db.messages.where("conversationId").equals(roomId).delete();
          useStore.getState().setActiveChats(
            useStore.getState().activeChats.filter((c) => c.id !== roomId)
          );
          window.dispatchEvent(new CustomEvent("room-deleted", { detail: { roomId } }));
        } else if (payload.code === "JOIN_ROOM_FAIL" && payload.targetId) {
          const roomId = payload.targetId;
          roomLog("JOIN_ROOM_FAIL", { roomId, reason: payload.message });
          alert(`Access Denied: ${payload.message}`);
          await db.contacts.delete(roomId);
          useStore.getState().setActiveChats(
            useStore.getState().activeChats.filter((c) => c.id !== roomId)
          );
        } else if (payload.code === "ROOM_MEMBERS_LIST" && payload.targetId) {
          try {
            const membersList = JSON.parse(payload.message || "[]");
            const memberIds = membersList.map((m: { id: string }) => m.id).filter(Boolean);
            if (memberIds.length > 0) {
              db.contacts.get(payload.targetId).then((contact) => {
                if (contact) {
                  contact.members = memberIds.join(",");
                  db.contacts.put(contact);
                }
              });
              const currentUserId = localStorage.getItem("user_id") || "";
              for (const m of membersList) {
                if (m.id && m.id !== currentUserId && m.codename) {
                  db.contacts.get(m.id).then((c) => {
                    if (!c) {
                      db.contacts.put({
                        id: m.id,
                        codename: m.codename,
                        incognitoId: m.incognitoId || "avatar_001.png",
                      });
                    } else if (c.codename !== m.codename) {
                      c.codename = m.codename;
                      db.contacts.put(c);
                    }
                  });
                }
              }
            }
            window.dispatchEvent(
              new CustomEvent("room-members-list", {
                detail: {
                  roomId: payload.targetId,
                  members: membersList,
                },
              })
            );
          } catch (err) {
            console.error("Failed to parse ROOM_MEMBERS_LIST:", err);
          }
        }
      } else if (envelope.type === "message") {
        const payload = envelope.payload;
        try {
          const currentUserId = localStorage.getItem("user_id");
          if (!currentUserId) return;

          const senderId = payload.from.id;
          const isRoom = !!payload.meta?.isRoom || payload.contentType === "application/x-sender-key";
          const targetConversationId: string = isRoom ? String(payload.meta?.groupId || envelope.to[0] || "") : senderId;

          msgLog(`◀ Incoming message  contentType=${payload.contentType}  isRoom=${isRoom}  from=${senderId}  to=${targetConversationId}  id=${envelope.id}`);

          // 2. Fetch our ECDH private key
          const keyRecord = await db.keys.get(currentUserId);
          if (!keyRecord || !keyRecord.privateKey) {
            logger.error("[CHAT-CONTAINER]", "Missing local ECDH private key for decryption");
            return;
          }

          // 3. Fetch sender's public keys
          const contact = await db.contacts.get(senderId);
          let peerEcdhPub = contact?.publicKey && contact.publicKey.kty
            ? contact.publicKey
            : payload.meta?.senderPublicKey;
          let peerEcdsaPub = contact?.publicKeyDsa && contact.publicKeyDsa.kty
            ? contact.publicKeyDsa
            : payload.meta?.senderPublicKeyDsa;

          msgLog(`  Sender key lookup`, { senderId, foundInContacts: !!contact, hasPubKey: !!peerEcdhPub, hasDsaKey: !!peerEcdsaPub });

          if (!peerEcdhPub || !peerEcdsaPub) {
            try {
              const backendUrl = import.meta.env.VITE_BACKEND_HTTP_URL || "http://localhost:8080";
              const res = await axios.post(`${backendUrl}/api/search`, { query: senderId }, { withCredentials: true });
              const found = Array.isArray(res.data) ? res.data.find((c: { id: string; handshakeJWK?: JsonWebKey; identityJWK?: JsonWebKey; codename?: string; incognitoId?: string }) => c.id === senderId) : null;
              if (found && found.handshakeJWK) {
                peerEcdhPub = found.handshakeJWK;
                peerEcdsaPub = found.identityJWK;
                await db.contacts.put({
                  id: found.id,
                  codename: found.codename || found.id,
                  incognitoId: found.incognitoId || "avatar_001.png",
                  publicKey: found.handshakeJWK,
                  publicKeyDsa: found.identityJWK,
                });
              }
            } catch (err) {
              console.error("Failed to fetch sender keys from search API:", err);
            }
          }

          if (!isRoom && (!peerEcdhPub || !peerEcdsaPub)) {
            logger.error("[CHAT-CONTAINER]", "Missing peer public keys for decryption / signature verification", { senderId, isRoom });
            return;
          }

          // 4. Verify message signature if ECDSA public key is available
          if (peerEcdsaPub) {
            msgLog(`  Verifying ECDSA message signature...`, { senderId });
            const isSignatureValid = await E2EECryptoUtils.verifySignature(
              peerEcdsaPub as JsonWebKey,
              payload.ciphertext,
              payload.sig.value
            );

            if (!isSignatureValid) {
              secLog(`Signature verification FAILED for message envelope  from=${senderId}  id=${envelope.id}`);
              return;
            }
            msgLog(`  ✔ Signature valid`);
          }

          let cleartext = "";
          if (payload.contentType === "application/x-sender-key") {
            msgLog(`  Decrypting sender-key packet from ${senderId}...`);
            const sharedKey = await E2EECryptoUtils.deriveSharedSecret(
              keyRecord.privateKey,
              peerEcdhPub as JsonWebKey
            );

            let cipherB64 = payload.ciphertext;
            let ivB64 = payload.encryption.iv;
            try {
              if (payload.ciphertext && payload.ciphertext.startsWith("{")) {
                const parsedCipher = JSON.parse(payload.ciphertext);
                if (parsedCipher.cipher && parsedCipher.iv) {
                  cipherB64 = parsedCipher.cipher;
                  ivB64 = parsedCipher.iv;
                }
              }
            } catch {
              // use payload.ciphertext directly
            }

            const decryptedKeyPacket = await E2EECryptoUtils.decrypt1to1(
              sharedKey,
              cipherB64,
              ivB64
            );
            const keyPacket = JSON.parse(decryptedKeyPacket);
            dbLog(`  Storing received sender key from ${senderId}`, { group: keyPacket.group, keyId: keyPacket.keyId });
            await db.senderKeys.put({
              id: `${senderId}:${keyPacket.group}`,
              groupId: keyPacket.group,
              senderId: senderId,
              keyId: keyPacket.keyId,
              chainKeyHex: keyPacket.chainKeyHex,
              counter: typeof keyPacket.counter === "number" ? keyPacket.counter : 0,
            });
            msgLog(`  ✔ Sender key stored from ${senderId}  group=${keyPacket.group}  keyId=${keyPacket.keyId}`);
            return;
          }

          if (isRoom) {
            if (senderId === currentUserId) {
              msgLog(`  Skipping own room message (already saved locally)`);
              return; // We already decrypted/saved our own message when sending
            }
            const keyRecordId = `${senderId}:${targetConversationId}`;
            const groupKeyRecord = await db.senderKeys.get(keyRecordId);
            msgLog(`  Group message decrypt  keyRecordId=${keyRecordId}  keyFound=${!!groupKeyRecord}`);
            if (!groupKeyRecord) {
              secLog(`No group sender key for ${keyRecordId} — requesting keys from ${senderId}`);
              cleartext = "[Encrypted Group Signal - Key Unavailable]";
              requestSenderKeyDebounced(senderId, targetConversationId, currentUserId);
            } else {
              const msgCounter = typeof payload.meta?.counter === "number" ? payload.meta.counter : (groupKeyRecord.counter + 1);
              const { messageKeyBuffer, nextChainKeyHex } = await MessageSystem.advanceChainAndDeriveKey(
                groupKeyRecord.chainKeyHex,
                msgCounter,
                groupKeyRecord.counter
              );
              cleartext = await E2EECryptoUtils.groupDecrypt({
                group: targetConversationId,
                keyId: payload.meta?.keyId as string,
                counter: msgCounter,
                iv: payload.encryption.iv,
                cipher: payload.ciphertext,
              }, messageKeyBuffer);
              const nextCounter = Math.max(groupKeyRecord.counter, msgCounter);
              await db.senderKeys.put({
                ...groupKeyRecord,
                chainKeyHex: nextChainKeyHex,
                counter: nextCounter,
              });
            }
          } else {
            const sharedKey = await E2EECryptoUtils.deriveSharedSecret(
              keyRecord.privateKey,
              peerEcdhPub as JsonWebKey
            );
            cleartext = await E2EECryptoUtils.decrypt1to1(
              sharedKey,
              payload.ciphertext,
              payload.encryption.iv
            );
          }

          msgLog(`  ✔ Message decrypted  cleartext length=${cleartext.length}  isRoom=${isRoom}  from=${senderId}`);

          // If the sender is not in our contacts, let's create a contact for them (only if not room)
          if (!contact && !isRoom) {
            const newContact: ContactRecord = {
              id: senderId,
              incognitoId: (payload.meta?.senderIncognitoId as string) || "avatar_001.png",
              codename: (payload.meta?.senderCodename as string) || "Unknown Agent",
              publicKey: peerEcdhPub as JsonWebKey,
              publicKeyDsa: peerEcdsaPub as JsonWebKey,
            };
            await db.contacts.put(newContact);
            addActiveChat({
              id: newContact.id,
              codename: newContact.codename,
              incognitoId: newContact.incognitoId,
              time: formatMessageTimestamp(envelope.timestamp || Date.now()),
              activeNow: true,
              hasUnread: true,
              publicKey: newContact.publicKey,
              publicKeyDsa: newContact.publicKeyDsa,
              lastMessageText: isRoom ? `${newContact.codename}: ${cleartext}` : cleartext,
              lastMessageTimestamp: envelope.timestamp || Date.now(),
            });
            try {
              globalChatStream.send({
                id: crypto.randomUUID(),
                type: "command",
                to: [],
                payload: {
                  code: "SUBSCRIBE_STATUS",
                  message: "",
                  targetId: senderId,
                },
              });
            } catch (subErr) {
              console.error("Failed to subscribe to contact status:", subErr);
            }
          }

          // 7. Save message to Dexie DB (plain text stored in `ciphertext` column)
          const msgId = envelope.id || crypto.randomUUID();
          const isViewingThisChat = window.location.pathname === `/chat/${targetConversationId}`;
          dbLog(`  Saving incoming message`, { msgId, conversationId: targetConversationId, isViewingThisChat });

          await db.messages.put({
            messageId: msgId,
            conversationId: targetConversationId,
            from: {
              id: senderId,
              codename: contact?.codename || (payload.meta?.senderCodename as string) || "Unknown Agent",
            },
            contentType: payload.contentType,
            ciphertext: cleartext,
            timestamp: envelope.timestamp || Date.now(),
            status: isViewingThisChat ? "read" : "delivered",
            meta: payload.meta,
          });

          // 8. Update unread state and last message details in activeChats
          const formattedTime = formatMessageTimestamp(envelope.timestamp || Date.now());

          const isMine = senderId === currentUserId;
          const senderName = contact?.codename || (payload.meta?.senderCodename as string) || "Unknown Agent";
          const lastMessageText = isMine
            ? `You: ${cleartext}`
            : isRoom
              ? `${senderName}: ${cleartext}`
              : cleartext;
          useStore.getState().updateLastMessage(
            targetConversationId,
            lastMessageText,
            formattedTime,
            envelope.timestamp || Date.now()
          );

          if (!isViewingThisChat) {
            incrementUnread(targetConversationId);
            // Send delivery receipt back to sender/room
            rcptLog(`Sending MESSAGE_DELIVERED receipt`, { msgId, targetConversationId });
            let sigB64 = "";
            try {
              const ourEcdsaKey = await db.keys.get(`${currentUserId}:dsa`);
              if (ourEcdsaKey?.privateKey) {
                sigB64 = await E2EECryptoUtils.signMessage(ourEcdsaKey.privateKey, `MESSAGE_DELIVERED|${msgId}|${targetConversationId}`);
              }
            } catch (err) {
              logger.error("[RECEIPT]", "Failed to sign MESSAGE_DELIVERED command", err);
            }

            try {
              globalChatStream.send({
                id: crypto.randomUUID(),
                type: "command",
                to: [],
                payload: {
                  code: "MESSAGE_DELIVERED",
                  message: msgId,
                  targetId: targetConversationId,
                  signature: sigB64 || undefined,
                },
              });
              rcptLog(`  ✔ MESSAGE_DELIVERED sent`);
            } catch (err) {
              logger.error("[RECEIPT]", "Failed to send MESSAGE_DELIVERED receipt", err);
            }
          } else {
            // Notify current active chat view to refresh messages
            window.dispatchEvent(new CustomEvent("new-message", { detail: { conversationId: targetConversationId } }));
            // Send read receipt back to sender/room
            rcptLog(`Sending MESSAGE_READ receipt (chat is active)`, { msgId, targetConversationId });
            let sigB64 = "";
            try {
              const ourEcdsaKey = await db.keys.get(`${currentUserId}:dsa`);
              if (ourEcdsaKey?.privateKey) {
                sigB64 = await E2EECryptoUtils.signMessage(ourEcdsaKey.privateKey, `MESSAGE_READ|${msgId}|${targetConversationId}`);
              }
            } catch (err) {
              logger.error("[RECEIPT]", "Failed to sign MESSAGE_READ command", err);
            }

            try {
              globalChatStream.send({
                id: crypto.randomUUID(),
                type: "command",
                to: [],
                payload: {
                  code: "MESSAGE_READ",
                  message: msgId,
                  targetId: targetConversationId,
                  signature: sigB64 || undefined,
                },
              });
              rcptLog(`  ✔ MESSAGE_READ sent`);
            } catch (err) {
              logger.error("[RECEIPT]", "Failed to send MESSAGE_READ receipt", err);
            }
          }

        } catch (err) {
          logger.error("[CHAT-CONTAINER]", "Failed to decrypt or process incoming message", err);
        }
      }
    });

    // Ensure status subscription is sent for all loaded contacts once listener is registered
    useStore.getState().activeChats.forEach((contact) => {
      try {
        globalChatStream.send({
          id: crypto.randomUUID(),
          type: "command",
          to: [],
          payload: {
            code: "SUBSCRIBE_STATUS",
            message: "",
            targetId: contact.id,
          },
        });
      } catch (err) {
        console.error("Failed to send status subscribe command", err);
      }
    });

    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isContactsLoaded, setActiveChats, addActiveChat, updateChatStatus, incrementUnread]);

  const isChatSelected = location.pathname !== "/";
  const shouldShowSidebar = isMobile ? !isChatSelected : true;

  const isSearching = searchQuery.length >= 2;

  // cast activeChats if it doesn't match the schema interface cleanly yet
  const displayList = (
    isSearching ? searchResults : activeChats
  ) as ChatUserContact[];
  const hasChats = displayList.length > 0;

  if (isLoading) {
    return <div className="loading-screen">Loading Chats...</div>;
  }

  return (
    <div
      className={`chat-container ${isChatSelected && !shouldShowSidebar ? "chat-view" : ""}`}
    >
      {shouldShowSidebar && (
        <div className="sidebar">
          <div className="top-actions">
            <div className="search-box">
              <SearchIcon />
              <input
                type="text"
                placeholder="Search User"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              className="action-btn"
              aria-label="Add or Filter Options"
              onClick={() => openModal(<CreateRoomModal />)}
            >
              <PlusIcon />
            </button>
          </div>

          <ChatList
            chats={displayList}
            hasChats={hasChats}
            isSearching={isSearching}
            searchClose={async (contactRecord: ContactRecord) => {
              try {
                if (contactRecord.isRoom) {
                  const existing = await db.contacts.get(contactRecord.id);
                  let passphraseStr = existing?.passphrase;
                  if (!existing || !passphraseStr) {
                    const inputPass = prompt("Enter Access Phrase to join this secure room:");
                    if (inputPass === null) return; // User cancelled
                    passphraseStr = inputPass.trim();

                    globalChatStream.send({
                      id: crypto.randomUUID(),
                      type: "command",
                      to: [],
                      payload: {
                        code: "JOIN_ROOM",
                        targetId: contactRecord.id,
                        passphrase: passphraseStr,
                      },
                    });

                    await db.contacts.put({
                      id: contactRecord.id,
                      codename: contactRecord.codename,
                      incognitoId: contactRecord.incognitoId,
                      isRoom: true,
                      passphrase: passphraseStr,
                    });
                  }

                  addActiveChat({
                    id: contactRecord.id,
                    codename: contactRecord.codename,
                    incognitoId: contactRecord.incognitoId,
                    isRoom: true,
                    passphrase: passphraseStr,
                    time: "",
                    activeNow: true,
                    hasUnread: false,
                  });
                  setSearchQuery("");
                  return;
                }

                // Simply add the contact to the active chats state.
                // The automatic sync effect handles persisting it to IndexedDB.
                addActiveChat({
                  id: contactRecord.id,
                  codename: contactRecord.codename,
                  incognitoId: contactRecord.incognitoId,
                  time: "",
                  activeNow: false,
                  hasUnread: false,
                  publicKey: contactRecord.publicKey,
                  publicKeyDsa: contactRecord.publicKeyDsa,
                });

                // Subscribe to status updates for this contact
                try {
                  globalChatStream.send({
                    id: crypto.randomUUID(),
                    type: "command",
                    to: [],
                    payload: {
                      code: "SUBSCRIBE_STATUS",
                      message: "",
                      targetId: contactRecord.id,
                    },
                  });
                } catch (subErr) {
                  console.error("Failed to subscribe to contact status:", subErr);
                }

                // 2. Clear the search input bar
                setSearchQuery("");
              } catch (error) {
                console.error(
                  "Failed to add searched contact to local database:",
                  error,
                );
              }
            }}
          />
        </div>
      )}

      <div className="main-chat-window" data-show-sidebar={shouldShowSidebar}>
        <Outlet
          context={{ onChatSelected: () => { }, onBackToList: () => { } }}
        />
      </div>
    </div>
  );
};
export default ChatContainer;
