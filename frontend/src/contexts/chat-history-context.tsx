import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ChatSession = {
  id: string;
  script: string;
  style: string;
  createdAt: number;
  videoUrl: string | null;
  statusHistory: string[];
};

interface ChatHistoryContextValue {
  sessions: ChatSession[];
  activeSessionId: string | null;
  setActiveSession: (id: string | null) => void;
  createSession: (session: ChatSession) => void;
  appendStatus: (id: string, status: string) => void;
  updateSession: (id: string, payload: Partial<ChatSession>) => void;
  getSessionById: (id: string) => ChatSession | undefined;
}

const STORAGE_KEY = "vit-chat-history";
const ACTIVE_KEY = "vit-chat-active";

const ChatHistoryContext = createContext<ChatHistoryContextValue | undefined>(
  undefined
);

const readStorage = (): ChatSession[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as ChatSession[]) : [];
    return parsed.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.warn("Failed to parse chat history", error);
    return [];
  }
};

export function ChatHistoryProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<ChatSession[]>(() => readStorage());
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(ACTIVE_KEY);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (activeSessionId) {
      window.localStorage.setItem(ACTIVE_KEY, activeSessionId);
    } else {
      window.localStorage.removeItem(ACTIVE_KEY);
    }
  }, [activeSessionId]);

  const createSession = (session: ChatSession) => {
    setSessions((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === session.id);
      if (existingIndex !== -1) {
        const copy = [...prev];
        copy[existingIndex] = { ...copy[existingIndex], ...session };
        return copy;
      }
      return [session, ...prev];
    });
    setActiveSessionId(session.id);
  };

  const appendStatus = (id: string, status: string) => {
    setSessions((prev) =>
      prev.map((session) =>
        session.id === id
          ? {
              ...session,
              statusHistory: [...session.statusHistory, status].slice(-50),
            }
          : session
      )
    );
  };

  const updateSession = (id: string, payload: Partial<ChatSession>) => {
    setSessions((prev) =>
      prev.map((session) =>
        session.id === id ? { ...session, ...payload } : session
      )
    );
  };

  const value = useMemo<ChatHistoryContextValue>(
    () => ({
      sessions,
      activeSessionId,
      setActiveSession: setActiveSessionId,
      createSession,
      appendStatus,
      updateSession,
      getSessionById: (id: string) =>
        sessions.find((session) => session.id === id),
    }),
    [sessions, activeSessionId]
  );

  return (
    <ChatHistoryContext.Provider value={value}>
      {children}
    </ChatHistoryContext.Provider>
  );
}

export function useChatHistory() {
  const context = useContext(ChatHistoryContext);
  if (!context) {
    throw new Error("useChatHistory must be used within ChatHistoryProvider");
  }
  return context;
}
