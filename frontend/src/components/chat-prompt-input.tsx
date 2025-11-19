import { motion } from "framer-motion";
import { Paperclip, Send, X } from "lucide-react";
import { useCallback } from "react";
import { ToolSelector } from "@/components/tool-selector";
import type { ToolType } from "@/lib/model-config";
import { cn } from "@/lib/utils";
import type { KeyboardEvent } from "react";

const formatBytes = (bytes: number) => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
};

interface ChatPromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  activeTool: ToolType;
  onToolSelect: (tool: ToolType) => void;
  attachments?: { id: string; name: string; size: number }[];
  onRemoveAttachment?: (id: string) => void;
  onAttachClick?: () => void;
  showAttach?: boolean;
}

export function ChatPromptInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "Describe the video you want to create...",
  activeTool,
  onToolSelect,
  attachments = [],
  onRemoveAttachment,
  onAttachClick,
  showAttach = true,
}: ChatPromptInputProps) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        if (!disabled) {
          onSubmit();
        }
      }
    },
    [disabled, onSubmit]
  );

  return (
    <div className="rounded-3xl border border-border/60 bg-background/90 p-4 shadow-xl shadow-black/5">
      <label className="space-y-2 text-sm">
        <span className="sr-only">Prompt</span>
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "h-28 w-full resize-none rounded-2xl bg-muted/40 px-4 py-3 text-base text-foreground",
            "placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            disabled && "opacity-50"
          )}
        />
      </label>

      {attachments.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {attachments.map((file) => (
            <span
              key={file.id}
              className="inline-flex items-center gap-2 rounded-2xl border border-border/50 bg-muted/30 px-3 py-1 text-xs font-medium"
            >
              <span className="flex flex-col text-left">
                <span>{file.name}</span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  {formatBytes(file.size)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onRemoveAttachment?.(file.id)}
                className="rounded-full p-1 text-muted-foreground transition hover:bg-muted/50"
                aria-label={`Remove ${file.name}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <ToolSelector activeTool={activeTool} onSelect={onToolSelect} />
          {showAttach && (
            <button
              type="button"
              onClick={onAttachClick}
              disabled={disabled}
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl border border-border/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em]",
                "text-muted-foreground transition hover:border-primary/60",
                disabled && "opacity-50"
              )}
            >
              <Paperclip className="size-3.5" /> Attach
            </button>
          )}
        </div>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={onSubmit}
          disabled={disabled}
          className={cn(
            "flex items-center justify-center rounded-2xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition",
            "hover:bg-primary/90",
            disabled && "opacity-40"
          )}
          aria-label="Send prompt"
        >
          <Send className="mr-2 size-4" /> Send
        </motion.button>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Press Enter to send • Shift + Enter for a new line
      </p>
    </div>
  );
}
