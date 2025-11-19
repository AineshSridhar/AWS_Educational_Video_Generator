"use client";

import { motion } from "framer-motion";

interface Phase {
  id: string;
  label: string;
  icon: string;
}

interface StatusTimelineProps {
  phases: Phase[];
  currentPhaseIndex: number;
}

export function StatusTimeline({
  phases,
  currentPhaseIndex,
}: StatusTimelineProps) {
  return (
    <div className="space-y-4">
      {phases.map((phase, index) => {
        const isActive = index === currentPhaseIndex;
        const isCompleted = index < currentPhaseIndex;
        return (
          <motion.div
            key={phase.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center gap-4"
          >
            {/* Timeline Dot */}
            <div className="relative flex flex-col items-center">
              <motion.div
                animate={
                  isActive
                    ? {
                        scale: [1, 1.2, 1],
                        boxShadow: [
                          "0 0 0 0px rgba(139, 92, 246, 0.3)",
                          "0 0 0 10px rgba(139, 92, 246, 0)",
                        ],
                      }
                    : {}
                }
                transition={{ duration: 2, repeat: Infinity }}
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                  isCompleted
                    ? "bg-primary/20 border-2 border-primary text-primary"
                    : isActive
                    ? "bg-primary text-primary-foreground border-2 border-primary"
                    : "bg-muted border-2 border-border text-muted-foreground"
                }`}
              >
                {isCompleted ? "✓" : phase.icon}
              </motion.div>

              {/* Connector Line */}
              {index < phases.length - 1 && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: isCompleted || isActive ? 40 : 40 }}
                  className={`w-1 mt-2 ${
                    isCompleted || isActive
                      ? "bg-linear-to-b from-primary to-primary/20"
                      : "bg-border"
                  }`}
                />
              )}
            </div>

            {/* Phase Label */}
            <div className="flex-1">
              <motion.div
                animate={{
                  opacity: isActive || isCompleted ? 1 : 0.6,
                  x: isActive ? 4 : 0,
                }}
                transition={{ duration: 0.3 }}
              >
                <p
                  className={`font-medium ${
                    isActive || isCompleted
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {phase.label}
                </p>
              </motion.div>
            </div>

            {/* Active Indicator */}
            {isActive && (
              <motion.span
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-primary text-sm font-medium"
              >
                Processing...
              </motion.span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
