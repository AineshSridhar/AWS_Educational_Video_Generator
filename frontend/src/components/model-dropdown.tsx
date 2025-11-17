import { MODEL_CONFIG, TOOL_SETTINGS, type ToolType } from "@/lib/model-config";
import { cn } from "@/lib/utils";

interface ModelDropdownProps {
  tool: ToolType;
  value: string;
  onChange: (model: string) => void;
}

export function ModelDropdown({ tool, value, onChange }: ModelDropdownProps) {
  const models = Object.keys(MODEL_CONFIG[tool] ?? {});

  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
        {TOOL_SETTINGS[tool].label} Model
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "min-w-[220px] rounded-2xl border border-border/50 bg-background/80 px-4 py-2.5 text-sm font-medium transition",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        )}
      >
        {models.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>
    </label>
  );
}
