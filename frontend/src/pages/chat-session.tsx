import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useChatHistory } from "@/contexts/chat-history-context";

const formatDateTime = (timestamp: number) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));

export function ChatSessionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getSessionById, setActiveSession } = useChatHistory();
  const session = id ? getSessionById(id) : undefined;

  useEffect(() => {
    if (id) {
      setActiveSession(id);
    }
  }, [id, setActiveSession]);

  if (!session) {
    return (
      <Card className="glass-card p-8 text-center">
        <h2 className="text-2xl font-semibold">Session not found</h2>
        <p className="mt-2 text-muted-foreground">
          The session you are looking for does not exist anymore. Start a new
          one below.
        </p>
        <Button className="mt-6" onClick={() => navigate("/")}>
          Start a new session
        </Button>
      </Card>
    );
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Session Overview
          </p>
          <h1 className="text-3xl font-bold">{session.style} video</h1>
          <p className="text-sm text-muted-foreground">
            Created {formatDateTime(session.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => navigate("/")}>
            New session
          </Button>
          {session.videoUrl && (
            <Button asChild className="bg-secondary text-secondary-foreground">
              <a
                href={session.videoUrl}
                download
                target="_blank"
                rel="noreferrer"
              >
                Download video
              </a>
            </Button>
          )}
        </div>
      </header>

      <Card className="glass-card p-6">
        <h2 className="text-xl font-semibold">Script</h2>
        <p className="mt-2 whitespace-pre-line text-muted-foreground">
          {session.script}
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass-card p-6">
          <h3 className="text-lg font-semibold">Status history</h3>
          <div className="mt-4 space-y-3">
            {session.statusHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No status updates yet.
              </p>
            ) : (
              session.statusHistory.map((status, index) => (
                <motion.div
                  key={`${status}-${index}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="rounded-lg border border-border/40 bg-background/40 px-4 py-2 text-sm"
                >
                  {status}
                </motion.div>
              ))
            )}
          </div>
        </Card>

        <Card className="glass-card p-6">
          <h3 className="text-lg font-semibold">Video preview</h3>
          {session.videoUrl ? (
            <div className="mt-4 overflow-hidden rounded-xl border">
              <video src={session.videoUrl} controls className="w-full" />
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Video still generating. Stay tuned!
            </p>
          )}
        </Card>
      </div>
    </section>
  );
}
