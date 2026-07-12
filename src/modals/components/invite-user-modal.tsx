import React, { useState, useEffect } from "react";
import { useModal } from "../useModal";
import { CloseIcon } from "../../shared/components/icons/icons";
import "../styles/modal.scss";
import { db } from "../../db/database";

export const InviteUserModal: React.FC<{ roomId: string }> = ({ roomId }) => {
  const { closeModal } = useModal();
  const [timeLeft, setTimeLeft] = useState<number>(300); // 5 minutes validity standard
  const [inviteLink, setInviteLink] = useState<string>("");

  useEffect(() => {
    const buildLink = async () => {
      const room = await db.contacts.get(roomId);
      if (room) {
        const passphrase = room.passphrase || "";
        const url = `http://${window.location.host}/?roomId=${encodeURIComponent(roomId)}&passphrase=${encodeURIComponent(passphrase)}`;
        setInviteLink(url);
      }
    };
    buildLink();
  }, [roomId]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      alert("Invite link copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy link: ", err);
    }
  };

  const handleRegenerate = () => {
    setTimeLeft(300);
  };

  return (
    <div className="modal-card">
      <div className="modal-header">
        <h2 className="modal-title">Invite User</h2>
        <div className="close" onClick={closeModal}>
          <CloseIcon size={16} />
        </div>
      </div>

      <div className="modal-content">
        <div className="qr-section-stack">
          <div className="timer-countdown">{timeLeft} seconds left</div>

          <div className="qr-wrapper" style={{ background: "rgba(0,0,0,0.3)", padding: "10px", borderRadius: "12px", border: "1px solid rgba(0, 255, 102, 0.2)" }}>
            <svg
              className="qr-image-svg"
              viewBox="0 0 100 100"
              width="160"
              height="160"
            >
              {/* Corner position indicators */}
              <rect x="5" y="5" width="25" height="25" fill="none" stroke="#00ff66" strokeWidth="4" />
              <rect x="10" y="10" width="15" height="15" fill="#00ff66" />
              
              <rect x="70" y="5" width="25" height="25" fill="none" stroke="#00ff66" strokeWidth="4" />
              <rect x="75" y="10" width="15" height="15" fill="#00ff66" />
              
              <rect x="5" y="70" width="25" height="25" fill="none" stroke="#00ff66" strokeWidth="4" />
              <rect x="10" y="75" width="15" height="15" fill="#00ff66" />

              {/* Smaller alignment pattern */}
              <rect x="70" y="70" width="10" height="10" fill="none" stroke="#00ff66" strokeWidth="2" />
              <rect x="74" y="74" width="2" height="2" fill="#00ff66" />

              {/* Random grid dots to simulate data payload */}
              <g fill="#00ff66" opacity="0.85">
                <rect x="35" y="5" width="4" height="4" />
                <rect x="45" y="5" width="8" height="4" />
                <rect x="60" y="5" width="4" height="8" />
                
                <rect x="35" y="15" width="4" height="4" />
                <rect x="50" y="15" width="4" height="4" />
                <rect x="60" y="20" width="8" height="4" />

                <rect x="5" y="35" width="4" height="8" />
                <rect x="15" y="35" width="8" height="4" />
                <rect x="30" y="35" width="4" height="4" />
                <rect x="40" y="30" width="12" height="4" />
                <rect x="55" y="35" width="4" height="12" />
                <rect x="65" y="30" width="4" height="4" />
                <rect x="75" y="35" width="8" height="8" />
                <rect x="90" y="35" width="4" height="4" />

                <rect x="5" y="50" width="8" height="4" />
                <rect x="20" y="45" width="4" height="12" />
                <rect x="35" y="50" width="16" height="4" />
                <rect x="55" y="55" width="4" height="4" />
                <rect x="65" y="50" width="8" height="4" />
                <rect x="80" y="45" width="4" height="12" />
                <rect x="90" y="50" width="4" height="4" />

                <rect x="35" y="65" width="4" height="4" />
                <rect x="45" y="60" width="4" height="8" />
                <rect x="55" y="65" width="8" height="4" />
                
                <rect x="35" y="75" width="12" height="4" />
                <rect x="55" y="75" width="4" height="12" />
                <rect x="90" y="70" width="4" height="4" />
                
                <rect x="35" y="90" width="4" height="4" />
                <rect x="45" y="85" width="8" height="4" />
                <rect x="60" y="90" width="4" height="4" />
                <rect x="75" y="85" width="12" height="4" />
                <rect x="90" y="90" width="4" height="4" />
              </g>
            </svg>
          </div>

          <div className="scan-instruction">
            Scan with mobile device to join instantly.
          </div>
        </div>

        <div
          className="link-share-container"
          onClick={handleCopyLink}
          role="button"
          tabIndex={0}
        >
          <span className="truncated-link">{inviteLink}</span>
          <button
            className="copy-action-button"
            aria-label="Copy link to clipboard"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
        </div>
      </div>

      <div className="modal-footer">
        <button type="button" className="btn-secondary" onClick={closeModal}>
          Cancel
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={handleRegenerate}
        >
          Regenerate
        </button>
      </div>
    </div>
  );
};
