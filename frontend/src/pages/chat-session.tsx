import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useChatHistory } from "@/contexts/chat-history-context";
import { TOOL_SETTINGS } from "@/lib/model-config";
import type { SessionJob } from "@/types/chat";

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
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);

  useEffect(() => {
    if (id) {
      setActiveSession(id);
    }
  }, [id, setActiveSession]);

  const jobs = useMemo(() => {
    if (!session) return [];
    return Object.values(session.jobs ?? {}).sort(
      (a, b) => b.createdAt - a.createdAt
    );
  }, [session]);

  const videoPreviews = useMemo(() => {
    return jobs
      .filter((job) => job.tool === "video" && job.videoUrl)
      .map((job) => ({
        jobId: job.id,
        url: job.videoUrl as string,
        status: job.status,
      }));
  }, [jobs]);

  const imagePreviews = useMemo(() => {
    return jobs
      .filter((job) => job.tool === "image" && job.imageUrls?.length)
      .flatMap((job) =>
        (job.imageUrls ?? []).map((url, index) => ({
          jobId: job.id,
          url,
          key: `${job.id}-${index}`,
          status: job.status,
        }))
      );
  }, [jobs]);

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
          <h1 className="text-3xl font-bold">
            {TOOL_SETTINGS[session.tool]?.label ?? session.tool}
          </h1>
          <p className="text-sm text-muted-foreground">
            Created {formatDateTime(session.createdAt)}
          </p>
          <p className="text-xs text-muted-foreground">
            Model: {session.model}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => navigate("/")}>
            Continue session
          </Button>
          {/* {session.videoUrl && (
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
          )} */}
        </div>
      </header>

      <Card className="glass-card p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Prompt</h2>
          <p className="mt-2 whitespace-pre-line text-muted-foreground">
            {session.prompt}
          </p>
        </div>
        {session.attachments.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Attachments
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {session.attachments.map((name) => (
                <li
                  key={name}
                  className="rounded-lg border border-border/40 px-3 py-2"
                >
                  {name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass-card p-6">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-semibold">Generation status</h3>
            <span className="text-xs font-mono text-muted-foreground">
              {jobs.length} job{jobs.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-4 space-y-4">
            {jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No generations yet. Submit a prompt to see live status cards.
              </p>
            ) : (
              jobs.map((job) => <JobStatusCard key={job.id} job={job} />)
            )}
          </div>
        </Card>

        <Card className="glass-card p-6">
          <h3 className="text-lg font-semibold">Activity log</h3>
          <div className="mt-4 space-y-3 max-h-[420px] overflow-y-auto pr-1">
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
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <MediaPreviewCard
          title="Video previews"
          emptyText="No videos generated yet."
          items={videoPreviews}
          type="video"
          onShowAll={() => setShowVideoModal(true)}
        />
        <MediaPreviewCard
          title="Image previews"
          emptyText="No images generated yet."
          items={imagePreviews}
          type="image"
          onShowAll={() => setShowImageModal(true)}
        />
      </div>

      <MediaModal
        title="All videos"
        open={showVideoModal}
        onClose={() => setShowVideoModal(false)}
      >
        {videoPreviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No video assets available.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {videoPreviews.map((video) => (
              <div
                key={video.jobId}
                className="rounded-2xl border border-border/50 p-3"
              >
                <p className="text-xs text-muted-foreground mb-2">
                  Job {video.jobId}
                </p>
                <video
                  src={video.url}
                  controls
                  className="w-full rounded-xl border border-border/40"
                />
              </div>
            ))}
          </div>
        )}
      </MediaModal>

      <MediaModal
        title="All images"
        open={showImageModal}
        onClose={() => setShowImageModal(false)}
      >
        {imagePreviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No image assets available.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {imagePreviews.map((image) => (
              <div
                key={image.key}
                className="space-y-2 rounded-2xl border border-border/50 p-3"
              >
                <p className="text-xs text-muted-foreground">
                  Job {image.jobId}
                </p>
                <img
                  src={image.url}
                  alt={`Generated asset from job ${image.jobId}`}
                  className="h-48 w-full rounded-xl object-cover"
                />
              </div>
            ))}
          </div>
        )}
      </MediaModal>
    </section>
  );
}

function MediaPreviewCard({
  title,
  emptyText,
  items,
  type,
  onShowAll,
}: {
  title: string;
  emptyText: string;
  items: Array<{ jobId: string; url: string; key?: string }>;
  type: "video" | "image";
  onShowAll: () => void;
}) {
  const limitedItems = items.slice(0, 4);
  return (
    <Card className="glass-card p-6">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={onShowAll}
          disabled={items.length === 0}
        >
          Show all {type === "video" ? "videos" : "images"}
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {limitedItems.map((item) => (
            <div
              key={item.key ?? item.jobId}
              className="overflow-hidden rounded-2xl border border-border/40"
            >
              {type === "video" ? (
                <video src={item.url} controls className="w-full" />
              ) : (
                <img
                  src={item.url}
                  alt="Generated preview"
                  className="w-full object-cover"
                />
              )}
              <div className="px-3 py-2 text-xs text-muted-foreground">
                Job {item.jobId}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function MediaModal({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-3xl border border-border/40 bg-background/95 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
          <h4 className="text-lg font-semibold">{title}</h4>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-6 py-4 space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
}

function JobStatusCard({ job }: { job: SessionJob }) {
  const toolLabel = TOOL_SETTINGS[job.tool]?.label ?? job.tool;
  return (
    <div className="rounded-2xl border border-border/40 bg-background/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{toolLabel}</p>
          <p className="text-xs text-muted-foreground font-mono">
            Job {job.id}
          </p>
        </div>
        <span className="rounded-full border border-border/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
          {job.status.replace(/_/g, " ")}
        </span>
      </div>
      <div className="mt-4 space-y-3 text-sm">
        {job.history.length === 0 ? (
          <p className="text-muted-foreground">Waiting for updates…</p>
        ) : (
          job.history.map((entry, index) => (
            <div
              key={`${job.id}-${index}-${entry.timestamp}`}
              className="rounded-xl border border-border/30 bg-muted/20 px-3 py-2"
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{entry.status.replace(/_/g, " ")}</span>
                <span>{formatTime(entry.timestamp)}</span>
              </div>
              {entry.progress && (
                <p className="mt-1 text-foreground text-sm">{entry.progress}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const formatTime = (timestamp: number) =>
  new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).format(new Date(timestamp));
