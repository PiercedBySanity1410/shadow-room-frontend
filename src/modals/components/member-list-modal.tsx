import React, { useState, useEffect } from "react";
import { CloseIcon } from "../../shared/components/icons/icons";
import { useModal } from "../useModal";
import "../styles/modal.scss";
import { db } from "../../db/database";
import { globalChatStream } from "../../core/websockets/global-stream";

interface MemberInfo {
  id: string;
  codename: string;
  incognitoId: string;
}

export const MemberListModal: React.FC<{ roomId: string }> = ({ roomId }) => {
  const { closeModal } = useModal();
  const [members, setMembers] = useState<MemberInfo[]>([]);

  useEffect(() => {
    const currentUserId = localStorage.getItem("user_id") || "";
    const myCodename = localStorage.getItem("codename") || "You";
    const myIncognitoId = localStorage.getItem("incognitoId") || "avatar_001.png";

    // 1. Fetch cached members from local db contacts first
    const loadCached = async () => {
      const room = await db.contacts.get(roomId);
      if (room && room.members) {
        const ids = room.members.split(",").map((id) => id.trim()).filter(Boolean);
        const list: MemberInfo[] = [];
        for (const id of ids) {
          if (id === currentUserId) {
            list.push({
              id,
              codename: `${myCodename} (You)`,
              incognitoId: myIncognitoId,
            });
          } else {
            const m = await db.contacts.get(id);
            list.push({
              id,
              codename: m?.codename || `Operative ${id.substring(0, 8)}`,
              incognitoId: m?.incognitoId || "avatar_001.png",
            });
          }
        }
        setMembers(list);
      }
    };
    loadCached();

    // 2. Listen for fresh members list from server
    const handleList = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.roomId === roomId) {
        const freshMembers: MemberInfo[] = (customEvent.detail.members || []).map((m: MemberInfo) => {
          if (m.id === currentUserId) {
            return {
              ...m,
              codename: `${m.codename || myCodename} (You)`,
              incognitoId: m.incognitoId || myIncognitoId,
            };
          }
          return m;
        });
        setMembers(freshMembers);
      }
    };

    window.addEventListener("room-members-list", handleList);

    // 3. Request fresh list
    try {
      globalChatStream.send({
        id: crypto.randomUUID(),
        type: "command",
        to: [],
        payload: {
          code: "GET_ROOM_MEMBERS",
          targetId: roomId,
        },
      });
    } catch (err) {
      console.error("Failed to request room members:", err);
    }

    return () => {
      window.removeEventListener("room-members-list", handleList);
    };
  }, [roomId]);

  return (
    <div className="modal-card">
      <div className="modal-header">
        <h2 className="modal-title">Room Members</h2>
        <div className="close" onClick={closeModal}>
          <CloseIcon size={16} />
        </div>
      </div>

      <div className="modal-content">
        <div className="member-list-stack">
          {members.map((member) => (
            <div key={member.id} className="member-row-item">
              <div className="avatar-status-container">
                <img
                  src={`/images/${member.incognitoId}`}
                  alt={`${member.codename}'s profile avatar`}
                  className="member-avatar"
                />
              </div>

              <div className="member-info-row">
                <div className="member-name">{member.codename}</div>
                <div className="member-role-tag">
                  <span className="role-text">{member.id.substring(0, 8)}...</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
