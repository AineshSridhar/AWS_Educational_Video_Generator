import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import { ThemeProvider } from "./contexts/theme-context";
import { ChatHistoryProvider } from "./contexts/chat-history-context";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <ChatHistoryProvider>
          <App />
        </ChatHistoryProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
