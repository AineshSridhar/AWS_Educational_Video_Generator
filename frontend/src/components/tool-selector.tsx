import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ImageIcon, Plus, VideoIcon, type LucideIcon } from "lucide-react";
import { TOOL_ORDER, TOOL_SETTINGS, type ToolType } from "@/lib/model-config";
import { cn } from "@/lib/utils";

const ICONS: Record<ToolType, LucideIcon> = {
  video: VideoIcon,
  image: ImageIcon,
};

interface ToolSelectorProps {
  activeTool: ToolType;
  onSelect: (tool: ToolType) => void;
}

export function ToolSelector({ activeTool, onSelect }: ToolSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleSelect = (tool: ToolType) => {
    onSelect(tool);
    setOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex size-10 items-center justify-center rounded-2xl border border-border/60 bg-background/60 text-foreground transition",
          open && "border-primary/60 text-primary"
        )}
        aria-label="Open tool menu"
      >
        <Plus className="size-5" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-12 left-0 z-20 w-64 rounded-2xl border border-border/60 bg-popover p-2 shadow-2xl"
          >
            {TOOL_ORDER.map((tool) => {
              const Icon = ICONS[tool];
              const isActive = tool === activeTool;
              return (
                <button
                  key={tool}
                  type="button"
                  onClick={() => handleSelect(tool)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted/50"
                  )}
                >
                  <span className="mt-0.5 flex size-9 items-center justify-center rounded-lg bg-muted/60">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">
                      {TOOL_SETTINGS[tool].label}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {TOOL_SETTINGS[tool].description}
                    </span>
                  </span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
