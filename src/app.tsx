import { Routes, Route } from "react-router";
import { ProtectedGuard, PublicGuard } from "./routes/route-guards";
import { ChatContainer, ActiveChat, NoChatSelected } from "./features/chat";
import { HardwareIdentity } from "./features/auth";
import { Loading } from "./features/loading";

export default function App() {
  return (
    <>
      <Routes>
        <Route element={<ProtectedGuard />}>
          <Route path="/" element={<ChatContainer />}>
            <Route index element={<NoChatSelected />} />
            <Route path="chat/:id" element={<ActiveChat />} />
          </Route>
        </Route>
        <Route element={<PublicGuard />}>
          <Route path="identify" element={<HardwareIdentity />} />
        </Route>
      </Routes>
      <Loading />
    </>
  );
}
