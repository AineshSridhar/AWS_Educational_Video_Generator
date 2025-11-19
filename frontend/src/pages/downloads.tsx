import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Filter, Search, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  useChatHistory,
  type ChatSession,
} from "@/contexts/chat-history-context";
import { TOOL_SETTINGS } from "@/lib/model-config";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 6;

const formatDate = (timestamp: number) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));

export function DownloadsPage() {
  const { sessions } = useChatHistory();
  const navigate = useNavigate();
  const completedSessions = sessions.filter(
    (session): session is ChatSession & { videoUrl: string } =>
      Boolean(session.videoUrl)
  );

  const [search, setSearch] = useState("");
  const [toolFilter, setToolFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const tools = Array.from(new Set(sessions.map((session) => session.tool)));

  const filteredSessions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return completedSessions.filter((session) => {
      if (toolFilter !== "all" && session.tool !== toolFilter) return false;
      if (term && !session.prompt.toLowerCase().includes(term)) return false;
      if (startDate && session.createdAt < new Date(startDate).getTime())
        return false;
      if (endDate && session.createdAt > new Date(endDate).getTime())
        return false;
      return true;
    });
  }, [completedSessions, search, toolFilter, startDate, endDate]);

  const visibleSessions = filteredSessions.slice(0, visible);

  const inputBaseClass =
    "w-full rounded-2xl border border-border/40 bg-background/70 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 shadow-inner shadow-black/5 transition focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

  return (
    <section className="space-y-8">
      <header className="space-y-3 text-center md:text-left">
        <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
          Library
        </p>
        <h1 className="text-3xl font-bold">Downloads & Video Library</h1>
        <p className="text-muted-foreground">
          Browse every video you generated. Search, filter, and jump back into
          any session.
        </p>
      </header>

      <Card className="glass-card p-6 ring-1 ring-white/10 dark:ring-white/5">
        <div
          className="
      grid gap-6
      sm:grid-cols-2 
      lg:grid-cols-4
      items-end
    "
        >
          {/* SEARCH */}
          <label className="flex flex-col gap-2 text-sm">
            <span className="block text-xs uppercase tracking-[0.35em] text-muted-foreground">
              Search
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setVisible(PAGE_SIZE);
                }}
                placeholder="Search prompts"
                className={cn(inputBaseClass, "pl-11")}
              />
            </div>
          </label>

          {/* TOOL */}
          <label className="flex flex-col gap-2 text-sm">
            <span className="block text-xs uppercase tracking-[0.35em] text-muted-foreground">
              Tool
            </span>
            <select
              value={toolFilter}
              onChange={(event) => {
                setToolFilter(event.target.value);
                setVisible(PAGE_SIZE);
              }}
              className={cn(
                inputBaseClass,
                "appearance-none pr-10 bg-linear-to-r from-background/80 to-background/60"
              )}
            >
              <option value="all">All tools</option>
              {tools.map((tool) => (
                <option key={tool} value={tool}>
                  {TOOL_SETTINGS[tool]?.label ?? tool}
                </option>
              ))}
            </select>
          </label>

          {/* FROM DATE */}
          <label className="flex flex-col gap-2 text-sm">
            <span className="block text-xs uppercase tracking-[0.35em] text-muted-foreground">
              From
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => {
                setStartDate(event.target.value);
                setVisible(PAGE_SIZE);
              }}
              className={cn(
                inputBaseClass,
                "scheme-dark",
                "placeholder:text-muted-foreground"
              )}
            />
          </label>

          {/* TO DATE */}
          <label className="flex flex-col gap-2 text-sm">
            <span className="block text-xs uppercase tracking-[0.35em] text-muted-foreground">
              To
            </span>
            <input
              type="date"
              value={endDate}
              onChange={(event) => {
                setEndDate(event.target.value);
                setVisible(PAGE_SIZE);
              }}
              className={cn(
                inputBaseClass,
                "scheme-dark",
                "placeholder:text-muted-foreground"
              )}
            />
          </label>
        </div>
      </Card>

      <AnimatePresence initial={false}>
        {visibleSessions.length === 0 ? (
          <motion.div
            key="empty-library"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-dashed border-border/60 p-10 text-center text-muted-foreground"
          >
            <Filter className="mx-auto mb-4 size-10 opacity-60" />
            No videos match your filters yet.
          </motion.div>
        ) : (
          <motion.div
            key="library-grid"
            layout
            className="grid gap-6 md:grid-cols-2 xl:grid-cols-3"
          >
            {visibleSessions.map((session, index) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="glass-card flex h-full flex-col overflow-hidden">
                  <div className="relative aspect-video w-full overflow-hidden bg-linear-to-br from-primary/30 to-accent/40">
                    {session.videoUrl ? (
                      <video
                        src={session.videoUrl}
                        className="h-full w-full object-cover"
                        controls={false}
                        muted
                        loop
                        playsInline
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <Video className="size-12" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-3 px-6 py-4">
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex w-fit items-center rounded-full border border-border/60 bg-background/80 px-3 py-1 uppercase tracking-wide">
                        {TOOL_SETTINGS[session.tool]?.label ?? session.tool}
                      </span>
                      <span className="inline-flex w-fit items-center rounded-full border border-border/60 bg-background/40 px-3 py-1 uppercase tracking-wide">
                        {session.model}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold line-clamp-3">
                      {session.prompt}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Generated {formatDate(session.createdAt)}
                    </p>
                    <div className="mt-auto flex gap-3">
                      <Button asChild size="sm" className="flex-1">
                        <a
                          href={session.videoUrl}
                          download
                          target="_blank"
                          rel="noreferrer"
                        >
                          Download
                        </a>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => navigate(`/session/${session.id}`)}
                      >
                        Open Session
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {visible < filteredSessions.length && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => setVisible((prev) => prev + PAGE_SIZE)}
          >
            Load more
          </Button>
        </div>
      )}
    </section>
  );
}
