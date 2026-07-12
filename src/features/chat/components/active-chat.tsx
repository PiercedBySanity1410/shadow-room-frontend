import React, { useState, useEffect, useRef } from "react";
import { useOutletContext, useNavigate, useParams } from "react-router";
import { ArrowLeftIcon, SendIcon } from "../../../shared/components/icons/icons";
import type { ChatUserContact } from "../types/chat.type";
import { db } from "../../../db/database";
import { useStore } from "../../../core/store/useStore";
import { MessageSystem } from "../../../core/crypto/message-system";
import { formatMessageTimestamp } from "./chat-container";
import { globalChatStream } from "../../../core/websockets/global-stream";
import { E2EECryptoUtils } from "../../../core/crypto/e2ee-cryptosystem";
import { useModal } from "../../../modals/useModal";
import { MemberListModal } from "../../../modals/components/member-list-modal";
import { InviteUserModal } from "../../../modals/components/invite-user-modal";
import { DestroyRoomModal } from "../../../modals/components/destroy-room-modal";

function formatMessageDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  
  const dateMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  
  const oneDay = 24 * 60 * 60 * 1000;
  
  if (dateMidnight === nowMidnight) {
    return "Today";
  } else if (nowMidnight - dateMidnight === oneDay) {
    return "Yesterday";
  } else {
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
}

/** Single tick SVG icon for "sent" status */
const SingleTick = () => (
  <svg className="status-ticks" viewBox="0 0 16 11" width="16" height="11">
    <path d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.011-2.095a.46.46 0 0 0-.327-.14.46.46 0 0 0-.33.14l-.618.616a.46.46 0 0 0-.14.33.46.46 0 0 0 .14.33l2.96 3.085c.089.089.195.14.327.14a.5.5 0 0 0 .381-.178l7.1-8.746a.398.398 0 0 0 .076-.306.398.398 0 0 0-.178-.254L11.071.653z" fill="currentColor"/>
  </svg>
);

/** Double tick SVG icon for "delivered" and "read" status */
const DoubleTick = ({ read }: { read: boolean }) => (
  <svg className={`status-ticks ${read ? "read" : ""}`} viewBox="0 0 16 11" width="16" height="11">
    <path d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.011-2.095a.46.46 0 0 0-.327-.14.46.46 0 0 0-.33.14l-.618.616a.46.46 0 0 0-.14.33.46.46 0 0 0 .14.33l2.96 3.085c.089.089.195.14.327.14a.5.5 0 0 0 .381-.178l7.1-8.746a.398.398 0 0 0 .076-.306.398.398 0 0 0-.178-.254L11.071.653z" fill="currentColor"/>
    <path d="M15.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-1.2-1.25-.618.617 2.14 2.232c.089.089.195.14.327.14a.5.5 0 0 0 .381-.178l7.1-8.746a.398.398 0 0 0 .076-.306.398.398 0 0 0-.178-.254L15.071.653z" fill="currentColor"/>
  </svg>
);

interface OutletContextType {
  onChatSelected?: () => void;
  onBackToList?: () => void;
}

/**
 * ActiveChat renders the secure messaging log feed and text input bar
 * for the currently active/selected contact room session.
 */
export const ActiveChat: React.FC = () => {
  const [message, setMessage] = useState("");
  const [userProfile, setUserProfile] = useState<ChatUserContact | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadStartIndex, setUnreadStartIndex] = useState<number | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const unreadBannerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const context = useOutletContext<OutletContextType>();
  const { id } = useParams<{ id: string }>();

  const { user: currentUser, activeChats, markAsRead, updateLastMessage } = useStore();
  const currentUserId = currentUser?.id || localStorage.getItem("user_id") || "";

  /**
   * Clears the current chat target and redirects layout flow back to root list.
   */
  const handleBack = () => {
    context?.onBackToList?.();
    navigate("/");
  };

  const loadMessages = async () => {
    if (!id) return;
    try {
      const chatMessages = await db.messages
        .where("conversationId")
        .equals(id)
        .sortBy("timestamp");
      setMessages(chatMessages);
      setTimeout(scrollToBottom, 50);
    } catch (err) {
      console.error("Failed to load messages from local database:", err);
    }
  };

  const scrollToBottom = () => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  };

  /**
   * Sends MESSAGE_READ receipts for all unread incoming messages,
   * marks messages as 'read' in local DB, and resets store unread count.
   */
  const sendReadReceipts = async () => {
    if (!id || !currentUserId) return;
    try {
      const unreadMsgs = await db.messages
        .where("conversationId")
        .equals(id)
        .filter((m) => m.from.id !== currentUserId && m.status === "delivered")
        .toArray();

      if (unreadMsgs.length > 0) {
        // Mark all as read locally
        const msgIds = unreadMsgs.map((m) => m.messageId);
        for (const msgId of msgIds) {
          await db.messages.where("messageId").equals(msgId).modify({ status: "read" });
        }

        // Send read receipt to the sender
        const msgIdsStr = msgIds.join(",");
        let sigB64 = "";
        try {
          const ourEcdsaKey = await db.keys.get(`${currentUserId}:dsa`);
          if (ourEcdsaKey?.privateKey) {
            sigB64 = await E2EECryptoUtils.signMessage(ourEcdsaKey.privateKey, `MESSAGE_READ|${msgIdsStr}|${id}`);
          }
        } catch (err) {
          console.error("Failed to sign MESSAGE_READ command batch:", err);
        }

        try {
          globalChatStream.send({
            id: crypto.randomUUID(),
            type: "command",
            to: [],
            payload: {
              code: "MESSAGE_READ",
              message: msgIdsStr,
              targetId: id,
              signature: sigB64 || undefined,
            },
          });
        } catch (err) {
          console.error("Failed to send message read receipt via stream", err);
        }
      }

      // Reset store unread state
      markAsRead(id);
    } catch (err) {
      console.error("Failed to send read receipts:", err);
    }
  };

  // Sync profile details matching the current channel ID
  useEffect(() => {
    if (!id) return;

    const fetchUserData = async () => {
      try {
        setIsLoading(true);

        // Fetch contact from db
        const contact = await db.contacts.get(id);
        if (contact) {
          const isRoomContact =
            Boolean(contact.isRoom) ||
            !contact.publicKey ||
            Object.keys(contact.publicKey).length === 0;

          if (isRoomContact && !contact.isRoom) {
            contact.isRoom = true;
            await db.contacts.put(contact);
          }

          setUserProfile({
            id: contact.id,
            codename: contact.codename,
            incognitoId: contact.incognitoId,
            activeNow: false,
            publicKey: contact.publicKey || ({} as JsonWebKey),
            publicKeyDsa: contact.publicKeyDsa || ({} as JsonWebKey),
            isRoom: isRoomContact,
          });
        } else {
          const storeContact = activeChats.find((c) => c.id === id);
          if (storeContact) {
            const isRoomContact =
              Boolean(storeContact.isRoom) ||
              !storeContact.publicKey ||
              Object.keys(storeContact.publicKey).length === 0;

            setUserProfile({
              id: storeContact.id,
              codename: storeContact.codename,
              incognitoId: storeContact.incognitoId,
              activeNow: storeContact.activeNow ?? false,
              publicKey: storeContact.publicKey || ({} as JsonWebKey),
              publicKeyDsa: storeContact.publicKeyDsa || ({} as JsonWebKey),
              isRoom: isRoomContact,
            });
          }
        }

        // Load messages and find unread index
        const chatMessages = await db.messages
          .where("conversationId")
          .equals(id)
          .sortBy("timestamp");
        
        // Find the first unread incoming message index
        const myId = currentUser?.id || localStorage.getItem("user_id") || "";
        const firstUnreadIdx = chatMessages.findIndex(
          (m) => m.from.id !== myId && m.status === "delivered"
        );
        setUnreadStartIndex(firstUnreadIdx >= 0 ? firstUnreadIdx : null);
        setMessages(chatMessages);

        // Send read receipts for unread messages
        await sendReadReceipts();

        // Scroll: if there are unreads, scroll to banner; else scroll to bottom
        setTimeout(() => {
          if (firstUnreadIdx >= 0 && unreadBannerRef.current) {
            unreadBannerRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
          } else {
            scrollToBottom();
          }
        }, 100);
      } catch (error) {
        console.error("Failed to load user profile context:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Listen for new messages coming from the global stream
  useEffect(() => {
    const handleNewMessage = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.conversationId === id) {
        setUnreadStartIndex(null); // Clear unread banner on new live messages
        loadMessages();
      }
    };

    window.addEventListener("new-message", handleNewMessage);
    return () => {
      window.removeEventListener("new-message", handleNewMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Listen for read receipt updates to refresh tick status
  useEffect(() => {
    const handleReadReceipt = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.conversationId === id) {
        loadMessages();
      }
    };

    window.addEventListener("read-receipt", handleReadReceipt);
    return () => {
      window.removeEventListener("read-receipt", handleReadReceipt);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const { openModal } = useModal();

  const handleShowMembers = () => {
    if (id) openModal(<MemberListModal roomId={id} />);
  };

  const handleInvite = () => {
    if (id) openModal(<InviteUserModal roomId={id} />);
  };

  const handleDestroy = () => {
    if (id) openModal(<DestroyRoomModal roomId={id} />);
  };

  const handleLeave = () => {
    if (!id) return;
    if (confirm("Are you sure you want to leave this secure room?")) {
      try {
        globalChatStream.send({
          id: crypto.randomUUID(),
          type: "command",
          to: [],
          payload: {
            code: "LEAVE_ROOM",
            targetId: id,
          },
        });
        db.contacts.delete(id).then(() => {
          useStore.getState().setActiveChats(
            useStore.getState().activeChats.filter((c) => c.id !== id)
          );
          navigate("/");
        });
      } catch (err) {
        console.error("Failed to leave room:", err);
      }
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!message.trim() || !id || !currentUserId || !userProfile) return;

    try {
      const messageText = message.trim();
      const isRoomChat =
        Boolean(userProfile.isRoom) ||
        !userProfile.publicKey ||
        Object.keys(userProfile.publicKey).length === 0;

      if (isRoomChat) {
        if (!userProfile.isRoom) {
          await db.contacts.update(id, { isRoom: true });
        }
        await MessageSystem.sendRoomMessage({
          senderId: currentUserId,
          roomId: id,
          messageText,
          senderCodename: currentUser?.codename || "Anonymous Agent",
          senderIncognitoId: currentUser?.incognitoId || "avatar_001.png",
        });
      } else {
        await MessageSystem.send1to1Message({
          senderId: currentUserId,
          recipientId: id,
          messageText,
          senderCodename: currentUser?.codename || "Anonymous Agent",
          senderIncognitoId: currentUser?.incognitoId || "avatar_001.png",
        });
      }

      // Update last message in store activeChats
      const formattedTime = formatMessageTimestamp(Date.now());
      if (id) {
        updateLastMessage(id, `You: ${messageText}`, formattedTime, Date.now());
      }

      // Clear input and reload list
      setMessage("");
      setUnreadStartIndex(null);
      await loadMessages();
    } catch (err) {
      console.error("Transmission or encryption failure:", err);
    }
  };

  if (isLoading) {
    return <></>;
  }

  const storeContact = activeChats.find((c) => c.id === id);
  const isOnline = storeContact?.activeNow ?? userProfile?.activeNow ?? false;

  return (
    <>
      <div className="chat-header">
        <div className="room-info">
          <button
            className="back-btn-mobile"
            onClick={handleBack}
            aria-label="Back to chats"
          >
            <ArrowLeftIcon />
          </button>
          <div className="avatar-container">
            <img
              src={`/images/${userProfile?.incognitoId}`}
              alt={userProfile?.codename || "User Avatar"}
              className="avatar"
            />
            {isOnline && <div className="status-badge" />}
          </div>
          <span className="name">
            {userProfile?.codename || "Anonymous Identity"}
          </span>
        </div>
        {userProfile?.isRoom && (
          <div className="room-actions-bar" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button className="btn-secondary compact" onClick={handleShowMembers} style={{ padding: "4px 8px", fontSize: "11px", height: "28px" }}>
              Members
            </button>
            <button className="btn-secondary compact" onClick={handleInvite} style={{ padding: "4px 8px", fontSize: "11px", height: "28px" }}>
              Invite
            </button>
            {userProfile.creatorId === currentUserId ? (
              <button className="btn-danger compact" onClick={handleDestroy} style={{ padding: "4px 8px", fontSize: "11px", height: "28px" }}>
                Destroy
              </button>
            ) : (
              <button className="btn-danger compact" onClick={handleLeave} style={{ padding: "4px 8px", fontSize: "11px", height: "28px" }}>
                Leave
              </button>
            )}
          </div>
        )}
      </div>

      <div className="messages-scroller" ref={scrollerRef}>
        {messages.length === 0 ? (
          <div
            className="empty-feed-notice"
            style={{
              margin: "auto",
              color: "#666",
              fontSize: "14px",
              fontStyle: "italic",
            }}
          >
            No messages recorded in this secure channel.
          </div>
        ) : (
          (() => {
            let lastDateStr = "";
            return messages.map((msg, idx) => {
              const isMine = msg.from.id === currentUserId;
              const msgDate = new Date(msg.timestamp);
              const msgDateStr = msgDate.toDateString();
              const showDateSeparator = msgDateStr !== lastDateStr;
              lastDateStr = msgDateStr;
              const dateText = formatMessageDate(msg.timestamp);
              const showUnreadBanner = unreadStartIndex !== null && idx === unreadStartIndex;

              return (
                <React.Fragment key={msg.messageId}>
                  {showDateSeparator && (
                    <div className="date-separator">{dateText}</div>
                  )}
                  {showUnreadBanner && (
                    <div className="unread-separator" ref={unreadBannerRef}>
                      <span className="unread-separator-text">
                        {unreadStartIndex !== null
                          ? `${messages.length - unreadStartIndex} UNREAD MESSAGE${messages.length - unreadStartIndex > 1 ? "S" : ""}`
                          : "UNREAD MESSAGES"}
                      </span>
                    </div>
                  )}
                  <div
                    className={`message-wrapper ${isMine ? "outgoing" : "incoming"}`}
                  >
                    {!isMine && (
                      <img
                        src={`/images/${userProfile?.incognitoId}`}
                        alt={userProfile?.codename}
                        className="msg-avatar"
                      />
                    )}
                    <div className="bubble">
                      <div className="text">{msg.ciphertext}</div>
                      <div className="time-meta">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {isMine && (
                          msg.status === "read"
                            ? <DoubleTick read={true} />
                            : msg.status === "delivered"
                              ? <DoubleTick read={false} />
                              : <SingleTick />
                        )}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            });
          })()
        )}
      </div>

      <form className="input-bar-container" onSubmit={handleSend}>
        <div className="input-wrapper">
          <input
            type="text"
            className="text-input-field"
            placeholder="Enter Secret Message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button type="submit" className="send-btn" aria-label="Send Message">
            <SendIcon color="#111" />
          </button>
        </div>
      </form>
    </>
  );
};
export default ActiveChat;
