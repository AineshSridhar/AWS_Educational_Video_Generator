import { useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Bot, Sparkles, UserRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ChatPromptInput } from "@/components/chat-prompt-input";
import { ModelDropdown } from "@/components/model-dropdown";
import { StatusPolling } from "./status-polling";
import { submitToolRequest } from "@/lib/api";
import {
  TOOL_SETTINGS,
  getDefaultModel,
  type ToolType,
} from "@/lib/model-config";
import { cn } from "@/lib/utils";
import {
  useChatHistory,
  type ChatSession,
} from "@/contexts/chat-history-context";
import type { AttachmentMeta, ChatMessage } from "@/types/chat";

interface PromptBoost {
  id: string;
  label: string;
  helper: string;
  snippet: string;
}

type PendingAttachment = {
  id: string;
  file: File;
};

const createId = () =>
  crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);

const formatSize = (bytes: number) =>
  bytes > 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes.toFixed(0)} B`;

const extractImageUrls = (payload: unknown): string[] => {
  if (!payload || typeof payload !== "object") return [];
  const urls = new Set<string>();
  if (
    "image_url" in payload &&
    typeof (payload as { image_url: unknown }).image_url === "string"
  ) {
    urls.add((payload as { image_url: string }).image_url);
  }
  const variations = (payload as { variations?: unknown }).variations;
  if (Array.isArray(variations)) {
    variations.forEach((variation) => {
      if (
        variation &&
        typeof variation === "object" &&
        "url" in variation &&
        typeof (variation as { url: unknown }).url === "string"
      ) {
        urls.add((variation as { url: string }).url);
      }
    });
  }
  return Array.from(urls);
};

const PROMPT_BOOSTS: PromptBoost[] = [
  {
    id: "story",
    label: "Story Spine",
    helper: "Hook, conflict, resolution",
    snippet:
      "Open with a relatable hook, escalate through a real-world conflict, and close with a memorable resolution plus call-to-action.",
  },
  {
    id: "lab",
    label: "Lab Demo",
    helper: "Steps + safety",
    snippet:
      "Break the explanation into numbered lab steps with safety reminders and comprehension pauses after each phase.",
  },
  {
    id: "visual",
    label: "Visual Anchor",
    helper: "Diagram beats",
    snippet:
      "Describe every scene with a bold visual anchor (camera move, lighting, and label overlay) to cement the concept.",
  },
];

export function VideoGenerator() {
  const [prompt, setPrompt] = useState("");
  const [activeTool, setActiveTool] = useState<ToolType>("video");
  const [selectedModel, setSelectedModel] = useState(() =>
    getDefaultModel("video")
  );
  const [attachedFiles, setAttachedFiles] = useState<PendingAttachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJobModel, setActiveJobModel] = useState<string | null>(null);
  const [activeJobSessionId, setActiveJobSessionId] = useState<string | null>(
    null
  );
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [boostNotice, setBoostNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    sessions,
    activeSessionId,
    createSession,
    updateSession,
    appendStatus,
    appendMessage,
    registerJob,
    appendJobStatus,
    updateJob,
  } = useChatHistory();

  const activeSession =
    (activeSessionId &&
      sessions.find((session) => session.id === activeSessionId)) ||
    null;
  const chatMessages = activeSession?.messages ?? [];

  const acceptsFiles = TOOL_SETTINGS[activeTool]?.acceptsFiles ?? false;
  const attachmentChips = attachedFiles.map((item) => ({
    id: item.id,
    name: item.file.name,
    size: item.file.size,
  }));
  const attachmentsForMessages: AttachmentMeta[] = attachmentChips.map(
    ({ name, size }) => ({ name, size })
  );

  const resetAttachmentInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const ensureSession = (
    seedPrompt: string,
    attachments: AttachmentMeta[]
  ): string => {
    if (activeSession && activeSessionId) {
      return activeSessionId;
    }

    const sessionId = createId();
    const newSession: ChatSession = {
      id: sessionId,
      prompt: seedPrompt,
      tool: activeTool,
      model: selectedModel,
      createdAt: Date.now(),
      videoUrl: null,
      statusHistory: [],
      attachments: attachments.map((file) => file.name),
      messages: [],
      jobId: null,
      jobs: {},
    };
    createSession(newSession);
    return sessionId;
  };

  const handleToolChange = (tool: ToolType) => {
    setActiveTool(tool);
    setSelectedModel(getDefaultModel(tool));
    setAttachedFiles([]);
    resetAttachmentInput();
  };

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setGlobalError("Please enter a prompt before sending.");
      return;
    }

    const filesSnapshot = attachedFiles.map((item) => item.file);
    const sessionId = ensureSession(trimmedPrompt, attachmentsForMessages);

    updateSession(sessionId, {
      prompt: trimmedPrompt,
      tool: activeTool,
      model: selectedModel,
      attachments: attachmentsForMessages.map((file) => file.name),
    });

    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: trimmedPrompt,
      tool: activeTool,
      model: selectedModel,
      attachments: attachmentsForMessages,
      timestamp: Date.now(),
    };

    appendMessage(sessionId, userMessage);
    setPrompt("");
    setGlobalError(null);
    setIsSubmitting(true);

    try {
      const response = await submitToolRequest({
        tool: activeTool,
        model: selectedModel,
        prompt: trimmedPrompt,
        files: filesSnapshot,
      });

      if (activeTool === "video") {
        if (!response.jobId) {
          throw new Error(
            "Video tool did not return a job id. Please try another model."
          );
        }
        setActiveJobId(response.jobId);
        setActiveJobModel(selectedModel);
        setActiveJobSessionId(sessionId);
        registerJob(sessionId, {
          id: response.jobId,
          tool: "video",
          model: selectedModel,
          createdAt: Date.now(),
          status: "QUEUED",
          progress: "Awaiting generation...",
          history: [],
        });
        appendJobStatus(
          sessionId,
          response.jobId,
          "QUEUED",
          "Awaiting generation..."
        );
        appendStatus(
          sessionId,
          `${new Date().toLocaleTimeString()} • Job queued with ${selectedModel}`
        );
        updateSession(sessionId, { jobId: response.jobId });
        appendMessage(sessionId, {
          id: createId(),
          role: "assistant",
          content: `Running ${selectedModel}. I will share status updates here.`,
          tool: activeTool,
          model: selectedModel,
          status: "info",
          timestamp: Date.now(),
          jobId: response.jobId,
        });
      } else {
        const imageJobId = createId();
        registerJob(sessionId, {
          id: imageJobId,
          tool: "image",
          model: selectedModel,
          createdAt: Date.now(),
          status: "QUEUED",
          progress: "Awaiting image pipeline",
          history: [],
        });
        appendJobStatus(
          sessionId,
          imageJobId,
          "QUEUED",
          "Awaiting image pipeline"
        );
        appendJobStatus(
          sessionId,
          imageJobId,
          "PROCESSING",
          "Sending prompt to image model"
        );
        const imageUrls = extractImageUrls(response.data);
        appendJobStatus(
          sessionId,
          imageJobId,
          "COMPLETED",
          imageUrls.length
            ? `${imageUrls.length} asset(s) ready`
            : "Response received"
        );
        updateJob(sessionId, imageJobId, {
          status: "COMPLETED",
          progress:
            imageUrls.length > 0
              ? `${imageUrls.length} asset(s) ready`
              : "Response received",
          imageUrls,
        });
        appendStatus(
          sessionId,
          `${new Date().toLocaleTimeString()} • Image job ${imageJobId} completed`
        );
        appendMessage(sessionId, {
          id: createId(),
          role: "assistant",
          content:
            imageUrls.length > 0
              ? `Generated ${imageUrls.length} ${
                  imageUrls.length > 1 ? "images" : "image"
                } with ${selectedModel}.`
              : `Response received from ${selectedModel}.`,
          tool: activeTool,
          model: selectedModel,
          status: imageUrls.length ? "success" : "info",
          timestamp: Date.now(),
          imageUrls,
          data: response.data,
          jobId: imageJobId,
        });
      }
      setAttachedFiles([]);
      resetAttachmentInput();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to submit request. Please try again.";
      setGlobalError(message);
      appendMessage(sessionId, {
        id: createId(),
        role: "assistant",
        content: message,
        status: "error",
        timestamp: Date.now(),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJobSuccess = (
    videoUrl: string,
    sessionId: string | null,
    jobId: string | null
  ) => {
    if (!sessionId || !jobId) return;
    const session = sessions.find((item) => item.id === sessionId);
    const job = session?.jobs[jobId];
    if (job?.status === "COMPLETED" && job.videoUrl) {
      setActiveJobId(null);
      setActiveJobSessionId(null);
      return;
    }
    setActiveJobId(null);
    setActiveJobSessionId(null);
    updateJob(sessionId, jobId, {
      status: "COMPLETED",
      progress: "Video ready",
      videoUrl,
    });
    appendJobStatus(sessionId, jobId, "COMPLETED", "Video ready");
    appendMessage(sessionId, {
      id: createId(),
      role: "assistant",
      content: "Your video is ready!",
      status: "success",
      timestamp: Date.now(),
      videoUrl,
      tool: "video",
      model: activeJobModel ?? selectedModel,
      jobId,
    });
  };

  const handleJobError = (
    message: string,
    sessionId: string | null,
    jobId: string | null
  ) => {
    if (!sessionId || !jobId) return;
    setActiveJobId(null);
    setActiveJobSessionId(null);
    updateJob(sessionId, jobId, {
      status: "FAILED",
      progress: message,
    });
    appendJobStatus(sessionId, jobId, "FAILED", message);
    appendMessage(sessionId, {
      id: createId(),
      role: "assistant",
      content: message,
      status: "error",
      timestamp: Date.now(),
      tool: "video",
      model: activeJobModel ?? selectedModel,
      jobId,
    });
    setGlobalError(message);
  };

  const currentPlaceholder = useMemo(() => {
    switch (activeTool) {
      case "image":
        return "Describe the image you want (lighting, medium, subject)...";
      default:
        return "Describe the lesson, tone, and scenes for your video...";
    }
  }, [activeTool]);

  const handleAttachClick = () => {
    if (!acceptsFiles) return;
    fileInputRef.current?.click();
  };

  const handleFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const list = event.target.files;
    if (!list) return;
    const newEntries = Array.from(list).map((file) => ({
      id: createId(),
      file,
    }));
    setAttachedFiles((prev) => [...prev, ...newEntries]);
    event.target.value = "";
  };

  const handleAttachmentRemove = (id: string) => {
    setAttachedFiles((prev) => prev.filter((file) => file.id !== id));
    resetAttachmentInput();
  };

  const handleBoostSelect = (boost: PromptBoost) => {
    setPrompt((prev) => {
      if (prev.includes(boost.snippet)) return prev;
      return prev ? `${prev.trim()}\n\n${boost.snippet}` : boost.snippet;
    });
    setBoostNotice(`${boost.label} booster added`);
    window.setTimeout(() => setBoostNotice(null), 2200);
  };

  return (
    <Card className="glass-card flex min-h-[640px] flex-col p-0">
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-6">
        <div className="space-y-4">
          {chatMessages.length === 0 && !activeJobId && (
            <p className="text-center text-sm text-muted-foreground">
              Start by selecting a tool and writing a prompt – replies appear
              here .
            </p>
          )}

          {chatMessages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          <AnimatePresence>
            {activeJobId && activeJobSessionId && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="flex justify-start"
              >
                <div className="max-w-full rounded-3xl bg-muted/40 p-3">
                  <StatusPolling
                    jobId={activeJobId}
                    sessionId={activeJobSessionId}
                    onSuccess={(videoUrl, jobId) =>
                      handleJobSuccess(videoUrl, activeJobSessionId, jobId)
                    }
                    onError={(message, jobId) =>
                      handleJobError(message, activeJobSessionId, jobId)
                    }
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="space-y-4 border-t border-border/60 bg-background/70 px-4 py-5">
        <PromptBoostRail onSelect={handleBoostSelect} />
        {boostNotice && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-2 text-xs text-primary">
            {boostNotice}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center rounded-full border border-border/50 bg-muted/30 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em]">
            {TOOL_SETTINGS[activeTool]?.label}
          </span>
          <span>Routing via {selectedModel}</span>
        </div>

        <ModelDropdown
          tool={activeTool}
          value={selectedModel}
          onChange={handleModelChange}
        />

        {globalError && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4" />
              <span>{globalError}</span>
            </div>
          </div>
        )}

        <ChatPromptInput
          value={prompt}
          onChange={setPrompt}
          onSubmit={handleSubmit}
          disabled={isSubmitting}
          placeholder={currentPlaceholder}
          activeTool={activeTool}
          onToolSelect={handleToolChange}
          attachments={attachmentChips}
          onRemoveAttachment={handleAttachmentRemove}
          onAttachClick={handleAttachClick}
          showAttach={acceptsFiles}
        />

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="sr-only"
          onChange={handleFilesSelected}
        />
      </div>
    </Card>
  );
}

function PromptBoostRail({
  onSelect,
}: {
  onSelect: (boost: PromptBoost) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {PROMPT_BOOSTS.map((boost) => (
        <button
          key={boost.id}
          type="button"
          onClick={() => onSelect(boost)}
          className="group flex flex-col rounded-2xl border border-border/50 bg-muted/20 px-4 py-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sparkles className="size-4 text-primary" />
            {boost.label}
          </span>
          <span className="text-xs text-muted-foreground group-hover:text-foreground">
            {boost.helper}
          </span>
        </button>
      ))}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const Icon = isUser ? UserRound : Bot;
  const bubbleClasses = cn(
    "rounded-3xl px-4 py-3 shadow-lg",
    isUser && "bg-primary text-primary-foreground",
    !isUser &&
      message.status === "error" &&
      "border border-destructive/40 bg-destructive/10",
    !isUser &&
      message.status === "success" &&
      "border border-primary/40 bg-primary/5",
    !isUser &&
      message.status === "info" &&
      "border border-border/40 bg-muted/30",
    !isUser && !message.status && "border border-border/30 bg-muted/20"
  );

  return (
    <motion.div
      layout
      className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {!isUser && (
        <span className="mt-1 flex size-9 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground">
          <Icon className="size-4" />
        </span>
      )}
      <div className="max-w-2xl space-y-2">
        <div className={bubbleClasses}>
          <p className="text-sm leading-relaxed">{message.content}</p>
          {message.attachments && message.attachments.length > 0 && (
            <ul className="mt-3 space-y-2 text-xs">
              {message.attachments.map((file) => (
                <li
                  key={file.name}
                  className="rounded-2xl border border-border/40 bg-muted/20 px-3 py-1"
                >
                  {file.name} • {formatSize(file.size)}
                </li>
              ))}
            </ul>
          )}
          {message.videoUrl && (
            <div className="mt-3 overflow-hidden rounded-2xl border border-border/40">
              <video src={message.videoUrl} controls className="w-full" />
            </div>
          )}
          {message.imageUrls && message.imageUrls.length > 0 && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {message.imageUrls.map((url) => (
                <div
                  key={url}
                  className="overflow-hidden rounded-2xl border border-border/40"
                >
                  <img
                    src={url}
                    alt="Generated result"
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {message.tool && TOOL_SETTINGS[message.tool]
            ? `${TOOL_SETTINGS[message.tool].label} • ${message.model ?? ""}`
            : message.model}
        </p>
      </div>
      {isUser && (
        <span className="mt-1 flex size-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
      )}
    </motion.div>
  );
}
