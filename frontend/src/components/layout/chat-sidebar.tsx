import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Download,
  History,
  PanelLeftOpen,
  PanelRightOpen,
  Plus,
  Search,
} from "lucide-react";
import { useChatHistory } from "@/contexts/chat-history-context";
import { cn } from "@/lib/utils";

const EXPANDED_WIDTH = 320;
const COLLAPSED_WIDTH = 72;
const COLLAPSED_ACTION_CLASS =
  "flex size-11 items-center justify-center rounded-2xl border border-sidebar-border/70 bg-sidebar-accent/30 text-sidebar-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:-translate-y-0.5 hover:border-sidebar-primary hover:text-sidebar-primary";

const formatDate = (timestamp: number) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).format(new Date(timestamp));

interface ChatSidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function ChatSidebar({ className, onNavigate }: ChatSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessions, activeSessionId, setActiveSession } = useChatHistory();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [search, setSearch] = useState("");

  const filteredSessions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sessions.filter((session) => {
      if (!term) return true;
      return (
        session.script.toLowerCase().includes(term) ||
        session.style.toLowerCase().includes(term)
      );
    });
  }, [sessions, search]);

  const handleSessionSelect = (id: string) => {
    setActiveSession(id);
    navigate(`/session/${id}`);
    onNavigate?.();
  };

  const isSessionActive = (sessionId: string) => {
    if (activeSessionId === sessionId) return true;
    return location.pathname.startsWith(`/session/${sessionId}`);
  };

  return (
    <motion.aside
      initial={{ x: -EXPANDED_WIDTH, opacity: 0, width: EXPANDED_WIDTH }}
      animate={{
        x: 0,
        opacity: 1,
        width: isCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
      }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className={cn(
        "flex h-screen flex-col overflow-hidden border-r border-sidebar-border/60 bg-sidebar/95 text-sidebar-foreground backdrop-blur-xl shadow-inner",
        className ?? "hidden lg:flex"
      )}
      style={{
        minWidth: isCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
        flexShrink: 0,
      }}
    >
      <div className="flex items-center justify-between border-b border-sidebar-border/60 px-4 py-4">
        <div className="flex items-center gap-2 overflow-hidden">
          {!isCollapsed && (
            <History className="size-5 text-sidebar-foreground/70 shrink-0" />
          )}
          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.span
                key="sidebar-title"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                className="font-semibold truncate"
              >
                Sessions
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <button
          type="button"
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="rounded-lg border border-sidebar-border/80 p-2 hover:bg-sidebar-accent transition-colors"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <PanelRightOpen className="size-4" />
          ) : (
            <PanelLeftOpen className="size-4" />
          )}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {isCollapsed ? (
          <motion.div
            key="sidebar-collapsed-actions"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-center gap-4 border-b border-sidebar-border/60 px-2 py-6"
          >
            <button
              type="button"
              aria-label="Start new session"
              title="Start new session"
              onClick={() => {
                setActiveSession(null);
                navigate("/");
                onNavigate?.();
              }}
              className={COLLAPSED_ACTION_CLASS}
            >
              <Plus className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Open downloads library"
              title="Open downloads library"
              onClick={() => {
                navigate("/downloads");
                onNavigate?.();
              }}
              className={COLLAPSED_ACTION_CLASS}
            >
              <Download className="size-4" />
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="sidebar-expanded-actions"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-3 border-b border-sidebar-border/60 px-4 py-4"
          >
            <label className="relative block text-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search sessions"
                className="w-full rounded-lg bg-sidebar-accent/40 py-2 pl-10 pr-3 text-sm outline-none ring-2 ring-transparent focus:ring-sidebar-ring"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveSession(null);
                  navigate("/");
                  onNavigate?.();
                }}
                className="flex-1 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground py-2 text-sm font-semibold hover:bg-sidebar-primary/90"
              >
                <Plus className="mr-2 inline size-4" /> New Session
              </button>
              <button
                type="button"
                onClick={() => {
                  navigate("/downloads");
                  onNavigate?.();
                }}
                className="flex-1 rounded-lg border border-sidebar-border py-2 text-sm font-semibold text-sidebar-foreground hover:bg-sidebar-accent/40"
              >
                <Download className="mr-2 inline size-4" /> Library
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {isCollapsed ? (
          <motion.div
            key="sidebar-collapsed-placeholder"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.9 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 items-center justify-center px-1"
          >
            <p className="rotate-90 text-[11px] tracking-[0.4em] text-muted-foreground uppercase">
              Sessions
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="sidebar-session-list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0 }}
            className="flex-1 overflow-y-auto px-3 py-4 space-y-2"
          >
            {filteredSessions.length === 0 ? (
              <motion.p
                key="empty-state"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.9 }}
                className="px-2 text-sm text-muted-foreground"
              >
                No sessions yet. Generate a video to get started.
              </motion.p>
            ) : (
              filteredSessions.map((session) => (
                <motion.button
                  key={session.id}
                  layout
                  onClick={() => handleSessionSelect(session.id)}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  whileHover={{ scale: 1.02 }}
                  className={cn(
                    "w-full rounded-xl border border-transparent px-3 py-3 text-left transition-colors overflow-hidden",
                    isSessionActive(session.id)
                      ? "bg-sidebar-primary/10 border-sidebar-primary text-sidebar-primary"
                      : "hover:bg-sidebar-accent/40"
                  )}
                >
                  <p className="truncate text-sm font-medium">
                    {session.script}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {session.style} • {formatDate(session.createdAt)}
                  </p>
                </motion.button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}
