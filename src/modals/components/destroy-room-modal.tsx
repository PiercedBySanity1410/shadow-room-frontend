import React, { useState } from "react";
import { useModal } from "../useModal";
import { CloseIcon } from "../../shared/components/icons/icons";
import "../styles/modal.scss";

import { globalChatStream } from "../../core/websockets/global-stream";

export const DestroyRoomModal: React.FC<{ roomId: string }> = ({ roomId }) => {
  const { closeModal } = useModal();
  const [accessKey, setAccessKey] = useState<string>("");

  const handleDestroy = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      globalChatStream.send({
        id: crypto.randomUUID(),
        type: "command",
        to: [],
        payload: {
          code: "DELETE_ROOM",
          targetId: roomId,
          passphrase: accessKey.trim(),
        },
      });
    } catch (err) {
      console.error("Failed to send destroy room command:", err);
    }
    closeModal();
  };

  return (
    <div className="modal-card">
      {/* Header */}
      <div className="modal-header">
        <h2 className="modal-title danger">Destroy Room</h2>
        <div className="close" onClick={closeModal}>
          <CloseIcon size={16} />
        </div>
      </div>

      {/* Form Content */}
      <form onSubmit={handleDestroy} className="modal-content">
        <div className="form-fields-stack">
          {/* Read-Only Block: Room Identifier */}
          <div className="input-group">
            <label className="input-label">Room Identifier</label>
            <div className="input-container read-only prefix-style">
              <span className="input-prefix">#</span>
              <span className="display-value">{roomId}</span>
            </div>
          </div>

          {/* Secure Input Block: Access Key Validation */}
          <div className="input-group">
            <label className="input-label">Access Key</label>
            <div className="input-container">
              <input
                type="password"
                placeholder="Enter room access key to confirm"
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                className="base-input"
                required
              />
            </div>
          </div>
        </div>

        {/* Action Controls Footer */}
        <div className="modal-footer">
          <button type="button" className="btn-outline" onClick={closeModal}>
            Cancel
          </button>
          <button type="submit" className="btn-danger">
            Destroy
          </button>
        </div>
      </form>
    </div>
  );
};
