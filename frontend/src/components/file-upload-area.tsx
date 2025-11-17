import { useRef } from "react";
import type { ChangeEvent } from "react";
import { Paperclip, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface FileUploadAreaProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
}

export function FileUploadArea({
  files,
  onFilesChange,
  disabled = false,
}: FileUploadAreaProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList) return;
    const nextFiles = [...files, ...Array.from(fileList)];
    onFilesChange(nextFiles);
    event.target.value = "";
  };

  const removeFile = (index: number) => {
    const nextFiles = files.filter((_, idx) => idx !== index);
    onFilesChange(nextFiles);
  };

  return (
    <div className="rounded-2xl border border-dashed border-border/50 bg-background/70 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em]",
            "text-muted-foreground transition hover:border-primary/60",
            disabled && "opacity-50"
          )}
        >
          <Paperclip className="size-3.5" /> Attach Files
        </button>
        <span className="text-muted-foreground text-xs">
          Add reference images, transcripts, or supplemental files (optional)
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        multiple
        onChange={handleFiles}
        disabled={disabled}
      />

      <AnimatePresence>
        {files.length > 0 && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-4 space-y-2"
          >
            {files.map((file, index) => (
              <motion.li
                key={`${file.name}-${file.lastModified}-${index}`}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/30 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="rounded-full p-1 text-destructive/80 transition hover:bg-destructive/10"
                  aria-label={`Remove ${file.name}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
