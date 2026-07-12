import React from "react";
import { LogoIcon } from "../../../shared/components/icons/icons";

export const NoChatSelected: React.FC = () => {
  return (
    <div className="no-chat-selected">
      <div className="brand-wrapper">
        <LogoIcon className="logo" />
        <div className="title">Shadow Room</div>
      </div>
    </div>
  );
};
