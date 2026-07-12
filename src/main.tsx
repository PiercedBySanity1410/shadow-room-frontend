import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import App from "./app";
import "./shared/styles/globals.scss";
import ModalProvider from "./modals/useModal";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ModalProvider>
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<App />} />
        </Routes>
      </BrowserRouter>
    </ModalProvider>
  </StrictMode>,
);
