import { useState } from "react";
import { motion } from "framer-motion";
import {
  Clapperboard,
  Film,
  Sparkles,
  GraduationCap,
  Boxes,
  Palette,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const API_BASE_URL = "http://localhost:8000";

interface InputFormProps {
  onJobCreated: (
    jobId: string,
    payload: { script: string; style: string }
  ) => void;
}

interface StyleOption {
  value: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

const STYLE_OPTIONS: StyleOption[] = [
  {
    value: "documentary",
    label: "Documentary",
    icon: Clapperboard,
    description: "Narrated walk-through with b-roll",
  },
  {
    value: "cinematic",
    label: "Cinematic",
    icon: Film,
    description: "Dramatic lighting & depth",
  },
  {
    value: "animated",
    label: "Animated",
    icon: Sparkles,
    description: "Playful motion graphics",
  },
  {
    value: "tutorial",
    label: "Tutorial",
    icon: GraduationCap,
    description: "Step-by-step walkthrough",
  },
  {
    value: "3d-diagram",
    label: "3D Diagram",
    icon: Boxes,
    description: "Spatial breakdowns & models",
  },
  {
    value: "2d-cartoon",
    label: "2D Cartoon",
    icon: Palette,
    description: "Hand-drawn storytelling",
  },
];

export function InputForm({ onJobCreated }: InputFormProps) {
  const [script, setScript] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("documentary");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!script.trim()) {
      setError("Please enter a script");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script, style: selectedStyle }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to generate video");
      }

      const data = await response.json();
      onJobCreated(data.job_id, { script, style: selectedStyle });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="glass-card p-8 space-y-8">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Create Your Video</h2>
        <p className="text-muted-foreground">
          Write your educational script and select a visual style
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Script Input */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">
            Educational Script
          </label>
          <motion.textarea
            whileFocus={{ scale: 1.01 }}
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder="Enter your educational script (e.g. The Krebs Cycle is a series of chemical reactions...)"
            className="w-full h-48 p-4 rounded-lg border border-border bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          />
        </div>

        {/* Style Selection */}
        <div className="space-y-3">
          <label className="block text-sm font-medium">Visual Style</label>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {STYLE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isActive = selectedStyle === option.value;
              return (
                <motion.button
                  key={option.value}
                  type="button"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setSelectedStyle(option.value)}
                  className={cn(
                    "flex w-full items-center gap-4 rounded-2xl border-2 px-4 py-3 text-left transition-all",
                    isActive
                      ? "border-primary/70 bg-primary/5 shadow-lg shadow-primary/10"
                      : "border-border/60 bg-background/40 hover:border-primary/40"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-12 items-center justify-center rounded-xl text-primary",
                      "bg-gradient-to-br from-primary/15 via-accent/10 to-transparent",
                      isActive && "from-primary/30 via-primary/10 to-accent/10"
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{option.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm"
          >
            {error}
          </motion.div>
        )}

        {/* Submit Button */}
        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
          <Button
            type="submit"
            disabled={loading}
            className="w-full py-3 hover:from-primary/90 hover:to-accent/90 text-primary-foreground font-semibold rounded-lg transition-all disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⚙️</span>
                Generating...
              </span>
            ) : (
              "Generate Video"
            )}
          </Button>
        </motion.div>
      </form>
    </Card>
  );
}
