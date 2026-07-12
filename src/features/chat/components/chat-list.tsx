import React, { useRef, useLayoutEffect } from "react";
import { NavLink } from "react-router";
import type { ContactRecord } from "../../../db/types/database.type";
import type { ChatUserContact } from "../types/chat.type";

interface ChatListProps {
  chats: ChatUserContact[];
  hasChats: boolean;
  isSearching: boolean;
  searchClose: (contactRecord: ContactRecord) => void;
}

/**
 * ChatList renders the list of active contacts/conversations in the sidebar,
 * or search results when fuzzy matching is triggered.
 */
export const ChatList: React.FC<ChatListProps> = ({
  chats,
  hasChats,
  isSearching,
  searchClose,
}) => {
  const itemRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const prevPositions = useRef<Map<string, number>>(new Map());

  useLayoutEffect(() => {
    const currentPositions = new Map<string, number>();

    itemRefs.current.forEach((el, id) => {
      if (el) {
        currentPositions.set(id, el.getBoundingClientRect().top);
      }
    });

    itemRefs.current.forEach((el, id) => {
      if (el) {
        const oldTop = prevPositions.current.get(id);
        const newTop = currentPositions.get(id);
        if (oldTop !== undefined && newTop !== undefined && oldTop !== newTop) {
          const deltaY = oldTop - newTop;
          el.style.transition = "none";
          el.style.transform = `translateY(${deltaY}px)`;
          el.style.zIndex = deltaY > 0 ? "10" : "1";

          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              el.style.transition = "transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1)";
              el.style.transform = "translateY(0)";
              setTimeout(() => {
                if (el) {
                  el.style.zIndex = "";
                  el.style.transition = "";
                  el.style.transform = "";
                }
              }, 460);
            });
          });
        }
      }
    });

    prevPositions.current = currentPositions;
  }, [chats]);

  return (
    <>
      {hasChats ? (
        <div className="chats-list">
          {chats.map((chat) => (
            <NavLink
              key={chat.id}
              ref={(el) => {
                if (el) {
                  itemRefs.current.set(chat.id, el);
                } else {
                  itemRefs.current.delete(chat.id);
                }
              }}
              to={`/chat/${chat.id}`}
              className={({ isActive }) =>
                `chat-item ${isActive ? "active" : ""}`
              }
              onClick={() => {
                if (isSearching) {
                  searchClose(chat as ContactRecord);
                }
              }}
            >
              <div className="avatar-container">
                <img
                  src={`/images/${chat.incognitoId}`}
                  alt={chat.codename}
                  className="avatar"
                />
                {chat.activeNow && <div className="status-badge" />}
              </div>
              <div className="chat-details">
                <div className="meta-row">
                  <div className="name">{chat.codename}</div>
                  {!isSearching && (
                    <div className="time-container">
                      <div className="time">{chat.time}</div>
                    </div>
                  )}
                </div>
                {!isSearching && (
                  <div className="status-row-container">
                    <div className="status-row" style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "240px",
                    }}>
                      {chat.lastMessageText || "Secure session established."}
                    </div>
                    {(chat.unreadCount ?? 0) > 0 && (
                      <div className="unread-badge">
                        {(chat.unreadCount ?? 0) > 99 ? "99+" : chat.unreadCount}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </NavLink>
          ))}
        </div>
      ) : (
        <div className="empty-sidebar">
          {isSearching ? "No matching signal signatures found." : "Secure grid channel is empty."}
        </div>
      )}
    </>
  );
};
export default ChatList;
