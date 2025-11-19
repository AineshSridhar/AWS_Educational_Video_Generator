import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ToolType } from "@/lib/model-config";
import type {
  AttachmentMeta,
  ChatMessage,
  JobStatusEntry,
  SessionJob,
} from "@/types/chat";

export type ChatSession = {
  id: string;
  prompt: string;
  tool: ToolType;
  model: string;
  createdAt: number;
  videoUrl: string | null;
  statusHistory: string[];
  attachments: string[];
  messages: ChatMessage[];
  jobId?: string | null;
  jobs: Record<string, SessionJob>;
};

interface ChatHistoryContextValue {
  sessions: ChatSession[];
  activeSessionId: string | null;
  setActiveSession: (id: string | null) => void;
  createSession: (session: ChatSession) => void;
  appendStatus: (id: string, status: string) => void;
  updateSession: (id: string, payload: Partial<ChatSession>) => void;
  getSessionById: (id: string) => ChatSession | undefined;
  appendMessage: (id: string, message: ChatMessage) => void;
  registerJob: (sessionId: string, job: SessionJob) => void;
  updateJob: (
    sessionId: string,
    jobId: string,
    payload: Partial<SessionJob>
  ) => void;
  appendJobStatus: (
    sessionId: string,
    jobId: string,
    status: string,
    progress?: string
  ) => void;
  deleteSession: (id: string) => void;
}

const STORAGE_KEY = "vit-chat-history";
const ACTIVE_KEY = "vit-chat-active";

const ChatHistoryContext = createContext<ChatHistoryContextValue | undefined>(
  undefined
);

const normalizeAttachments = (attachments: unknown): AttachmentMeta[] => {
  if (!Array.isArray(attachments)) return [];
  return attachments
    .map((attachment) => {
      if (
        attachment &&
        typeof attachment === "object" &&
        "name" in attachment &&
        typeof (attachment as { name: unknown }).name === "string"
      ) {
        const name = String((attachment as { name: unknown }).name);
        const sizeValue = Number((attachment as { size?: unknown }).size);
        return {
          name,
          size: Number.isFinite(sizeValue) ? sizeValue : 0,
        } satisfies AttachmentMeta;
      }
      return null;
    })
    .filter(Boolean) as AttachmentMeta[];
};

const normalizeMessage = (message: unknown): ChatMessage | null => {
  if (!message || typeof message !== "object") return null;
  const payload = message as Partial<ChatMessage> & Record<string, unknown>;
  const id =
    typeof payload.id === "string"
      ? payload.id
      : crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
  const timestamp =
    typeof payload.timestamp === "number" ? payload.timestamp : Date.now();
  const role = payload.role === "assistant" ? "assistant" : "user";
  const imageUrls = Array.isArray(payload.imageUrls)
    ? payload.imageUrls.filter((url): url is string => typeof url === "string")
    : undefined;

  return {
    id,
    role,
    content: typeof payload.content === "string" ? payload.content : "",
    tool: (payload.tool as ToolType | undefined) ?? undefined,
    model: typeof payload.model === "string" ? payload.model : undefined,
    attachments: normalizeAttachments(payload.attachments),
    status:
      payload.status === "success"
        ? "success"
        : payload.status === "error"
        ? "error"
        : payload.status === "info"
        ? "info"
        : undefined,
    timestamp,
    videoUrl:
      typeof payload.videoUrl === "string" ? payload.videoUrl : undefined,
    imageUrls,
    data: payload.data,
    jobId: typeof payload.jobId === "string" ? payload.jobId : undefined,
  } satisfies ChatMessage;
};

const normalizeJobHistory = (history: unknown): JobStatusEntry[] => {
  if (!Array.isArray(history)) return [];
  return history
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const payload = entry as Partial<JobStatusEntry> &
        Record<string, unknown>;
      const timestamp =
        typeof payload.timestamp === "number" ? payload.timestamp : Date.now();
      const status =
        typeof payload.status === "string" ? payload.status : "QUEUED";
      const progress =
        typeof payload.progress === "string" ? payload.progress : undefined;
      return { status, progress, timestamp } satisfies JobStatusEntry;
    })
    .filter(Boolean) as JobStatusEntry[];
};

const normalizeJobs = (jobs: unknown): Record<string, SessionJob> => {
  if (!jobs || typeof jobs !== "object") return {};
  const entries = Array.isArray(jobs)
    ? (jobs
        .map((job) =>
          job && typeof job === "object" && "id" in job
            ? [(job as { id: string }).id, job]
            : null
        )
        .filter(Boolean) as [string, unknown][])
    : Object.entries(jobs as Record<string, unknown>);

  return entries.reduce<Record<string, SessionJob>>(
    (acc, [jobId, jobValue]) => {
      if (!jobValue || typeof jobValue !== "object") return acc;
      const payload = jobValue as Partial<SessionJob> & Record<string, unknown>;
      const id = typeof payload.id === "string" ? payload.id : String(jobId);
      const tool = (payload.tool ?? "video") as ToolType;
      const model =
        typeof payload.model === "string" ? payload.model : "aws-nova-reel";
      const createdAt =
        typeof payload.createdAt === "number" ? payload.createdAt : Date.now();
      const status =
        typeof payload.status === "string" ? payload.status : "QUEUED";
      const progress =
        typeof payload.progress === "string" ? payload.progress : undefined;
      acc[id] = {
        id,
        tool,
        model,
        createdAt,
        status,
        progress,
        history: normalizeJobHistory(payload.history),
        videoUrl:
          typeof payload.videoUrl === "string" ? payload.videoUrl : undefined,
        imageUrls: Array.isArray(payload.imageUrls)
          ? (payload.imageUrls as unknown[]).filter(
              (url): url is string => typeof url === "string"
            )
          : undefined,
      } satisfies SessionJob;
      return acc;
    },
    {}
  );
};

const normalizeSession = (
  session: Partial<ChatSession> & Record<string, unknown>
): ChatSession => {
  const rawMessages = Array.isArray(session.messages) ? session.messages : [];
  return {
    id: String(session.id ?? crypto.randomUUID?.() ?? Date.now().toString()),
    prompt:
      typeof session.prompt === "string"
        ? session.prompt
        : typeof (session as { script?: string }).script === "string"
        ? (session as { script: string }).script
        : "",
    tool: (session.tool ?? "video") as ToolType,
    model:
      typeof session.model === "string"
        ? session.model
        : typeof (session as { style?: string }).style === "string"
        ? (session as { style: string }).style
        : "aws-nova-reel",
    createdAt:
      typeof session.createdAt === "number" ? session.createdAt : Date.now(),
    videoUrl: typeof session.videoUrl === "string" ? session.videoUrl : null,
    statusHistory: Array.isArray(session.statusHistory)
      ? (session.statusHistory as string[])
      : [],
    attachments: Array.isArray(session.attachments)
      ? (session.attachments as string[])
      : [],
    messages: rawMessages
      .map((message) => normalizeMessage(message))
      .filter(Boolean) as ChatMessage[],
    jobId: typeof session.jobId === "string" ? session.jobId : null,
    jobs: normalizeJobs((session as { jobs?: unknown }).jobs),
  };
};

const readStorage = (): ChatSession[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>[]) : [];
    return parsed
      .map((session) => normalizeSession(session))
      .sort((a, b) => b.createdAt - a.createdAt);
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
        copy[existingIndex] = {
          ...copy[existingIndex],
          ...session,
          messages: session.messages ?? copy[existingIndex].messages,
          jobs: session.jobs ?? copy[existingIndex].jobs,
        };
        return copy;
      }
      return [
        {
          ...session,
          messages: session.messages ?? [],
          jobs: session.jobs ?? {},
        },
        ...prev,
      ];
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

  const appendMessage = (id: string, message: ChatMessage) => {
    setSessions((prev) =>
      prev.map((session) =>
        session.id === id
          ? {
              ...session,
              messages: [...session.messages, message],
            }
          : session
      )
    );
  };

  const registerJob = (sessionId: string, job: SessionJob) => {
    setSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              jobs: {
                ...session.jobs,
                [job.id]: job,
              },
            }
          : session
      )
    );
  };

  const updateJob = (
    sessionId: string,
    jobId: string,
    payload: Partial<SessionJob>
  ) => {
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id !== sessionId) return session;
        const job = session.jobs[jobId];
        if (!job) return session;
        return {
          ...session,
          jobs: {
            ...session.jobs,
            [jobId]: {
              ...job,
              ...payload,
            },
          },
        };
      })
    );
  };

  const appendJobStatus = (
    sessionId: string,
    jobId: string,
    status: string,
    progress?: string
  ) => {
    const entry: JobStatusEntry = {
      status,
      progress,
      timestamp: Date.now(),
    };
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id !== sessionId) return session;
        const job = session.jobs[jobId];
        if (!job) return session;
        return {
          ...session,
          jobs: {
            ...session.jobs,
            [jobId]: {
              ...job,
              status,
              progress,
              history: [...job.history, entry],
            },
          },
        };
      })
    );
  };

  const deleteSession = (id: string) => {
    setSessions((prev) => prev.filter((session) => session.id !== id));
    setActiveSessionId((current) => (current === id ? null : current));
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
      appendMessage,
      registerJob,
      updateJob,
      appendJobStatus,
      deleteSession,
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
