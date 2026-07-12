import React, { useState } from "react";
import { useModal } from "../useModal";
import "../styles/modal.scss";
import { CloseIcon } from "../../shared/components/icons/icons";
import { db } from "../../db/database";
import { useStore } from "../../core/store/useStore";
import { globalChatStream } from "../../core/websockets/global-stream";

type VisibilityOption = "public" | "private";

const generateRandomBase64 = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
};

export const CreateRoomModal: React.FC = () => {
  const { closeModal } = useModal();
  const { user } = useStore();
  const [visibility, setVisibility] = useState<VisibilityOption>("public");
  const [roomId] = useState<string>(() => crypto.randomUUID());
  const [passphrase] = useState<string>(() => generateRandomBase64());

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId.trim()) return;

    try {
      globalChatStream.send({
        id: crypto.randomUUID(),
        type: "command",
        to: [],
        payload: {
          code: "CREATE_ROOM",
          message: visibility,
          targetId: roomId.trim(),
          passphrase: passphrase.trim(),
        },
      });

      const myId = user?.id || localStorage.getItem("user_id") || "";
      await db.contacts.put({
        id: roomId.trim(),
        codename: roomId.trim(),
        incognitoId: `avatar_${String(Math.floor(Math.random() * 202) + 1).padStart(3, "0")}.png`,
        isRoom: true,
        passphrase: passphrase.trim(),
        creatorId: myId,
        members: myId,
      });

      useStore.getState().addActiveChat({
        id: roomId.trim(),
        codename: roomId.trim(),
        incognitoId: `avatar_${String(Math.floor(Math.random() * 202) + 1).padStart(3, "0")}.png`,
        isRoom: true,
        passphrase: passphrase.trim(),
        activeNow: true,
        unreadCount: 0,
        lastMessageText: "Secure room created.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
    } catch (err) {
      console.error("Failed to create room:", err);
    }
    closeModal();
  };

  return (
    <div className="modal-card">
      <div className="modal-header">
        <h2 className="modal-title">Create a Room</h2>
        <div className="close" onClick={closeModal}>
          <CloseIcon size={16} />
        </div>
      </div>
      <form onSubmit={handleCreate} className="modal-content">
        <div className="avatar-wrapper">
          <img
            src="/images/avatar_060.png"
            alt="Room representation avatar"
            className="avatar"
          />
        </div>

        <div className="form-fields-stack">
          <div className="input-group">
            <label className="input-label">Room Identifier (UUID - Auto Generated)</label>
            <div className="input-container">
              <input
                type="text"
                value={roomId}
                readOnly
                className="base-input"
                style={{ cursor: "default", opacity: 0.85 }}
              />
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Visibility</label>
            <div className="toggle-container">
              <button
                type="button"
                className={`toggle-option ${visibility === "public" ? "active" : ""}`}
                onClick={() => setVisibility("public")}
              >
                Public
              </button>
              <button
                type="button"
                className={`toggle-option ${visibility === "private" ? "active" : ""}`}
                onClick={() => setVisibility("private")}
              >
                Private
              </button>
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Access Key (Base64 - Auto Generated)</label>
            <div className="input-container">
              <input
                type="text"
                value={passphrase}
                readOnly
                className="base-input"
                style={{ cursor: "default", opacity: 0.85 }}
              />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={closeModal}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Create
          </button>
        </div>
      </form>
    </div>
  );
};
