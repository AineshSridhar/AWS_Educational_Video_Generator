import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { HomePage } from "@/pages/home";
import { ChatSessionPage } from "@/pages/chat-session";
import { DownloadsPage } from "@/pages/downloads";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/session/:id" element={<ChatSessionPage />} />
        <Route path="/downloads" element={<DownloadsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
