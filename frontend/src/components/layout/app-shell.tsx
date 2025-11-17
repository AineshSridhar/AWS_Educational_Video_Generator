import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu } from "lucide-react";
import { ChatSidebar } from "@/components/layout/chat-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-linear-to-br from-background via-background to-primary/5">
      <ChatSidebar />

      <div className="flex w-full flex-col">
        <header className="flex items-center justify-between border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur">
          <button
            type="button"
            className="rounded-lg border border-border/80 p-2 lg:hidden"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu className="size-5" />
          </button>
          <a href="/" className="text-sm font-medium text-muted-foreground">
            AWS Educational Video Generator
          </a>
          <ThemeToggle />
        </header>

        <main className="relative flex-1 overflow-y-auto px-4 py-6 lg:px-10 lg:py-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>

      <AnimatePresence>
        {mobileSidebarOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
              className="h-full w-72 shadow-2xl"
            >
              <ChatSidebar
                className="flex h-full w-full"
                onNavigate={() => setMobileSidebarOpen(false)}
              />
            </motion.div>
            <button
              type="button"
              aria-label="Close sidebar overlay"
              className="flex-1 bg-black/40"
              onClick={() => setMobileSidebarOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
