import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { StatusTimeline } from "./status-timeline";
import { SkeletonLoader } from "./skeleton-loader";
import { useChatHistory } from "@/contexts/chat-history-context";
import { API_ENDPOINTS } from "@/lib/model-config";

interface StatusPollingProps {
  jobId: string;
  sessionId: string;
  onSuccess: (videoUrl: string, jobId: string) => void;
  onError: (error: string, jobId: string) => void;
}

interface JobStatus {
  status: string;
  progress: string;
  video_url: string | null;
}

const STATUS_PHASES = [
  { id: "QUEUED", label: "Queued", icon: "📋" },
  { id: "ANALYZING_SCRIPT", label: "Analyzing Script", icon: "📝" },
  { id: "GENERATING_PROMPTS", label: "Generating Prompts", icon: "✨" },
  { id: "INVOKING_BEDROCK", label: "Invoking Bedrock", icon: "🚀" },
  { id: "POLLING_CLIPS", label: "Processing Clips", icon: "🎬" },
  { id: "COMPLETED", label: "Complete", icon: "✅" },
];

export function StatusPolling({
  jobId,
  sessionId,
  onSuccess,
  onError,
}: StatusPollingProps) {
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const [failureCount, setFailureCount] = useState(0);
  const { appendStatus, updateSession, appendJobStatus, updateJob } =
    useChatHistory();
  const lastStatusRef = useRef<string>("");

  useEffect(() => {
    lastStatusRef.current = "";
  }, [jobId]);

  useEffect(() => {
    if (!isPolling || !jobId) return;

    const pollStatus = async () => {
      try {
        const response = await fetch(API_ENDPOINTS.status(jobId));
        console.log("Status API Response(status-polling.tsx):", response);
        if (!response.ok) throw new Error("Failed to fetch status");

        const data: JobStatus = await response.json();
        console.log("Polled Job Status:(status-polling.tsx)", data);
        setStatus(data);
        setFailureCount(0);

        appendJobStatus(sessionId, jobId, data.status, data.progress);
        updateJob(sessionId, jobId, {
          status: data.status,
          progress: data.progress,
        });

        const readableStatus = data.status.replace(/_/g, " ");
        const statusKey = `${data.status}-${data.progress}`;
        if (statusKey !== lastStatusRef.current) {
          appendStatus(
            sessionId,
            `${new Date().toLocaleTimeString()} • ${readableStatus} — ${
              data.progress || ""
            }`
          );
          lastStatusRef.current = statusKey;
        }

        if (data.status === "COMPLETED") {
          if (data.video_url) {
            updateSession(sessionId, { videoUrl: data.video_url });
            updateJob(sessionId, jobId, {
              videoUrl: data.video_url,
              status: data.status,
              progress: data.progress,
            });
            setIsPolling(false);
            onSuccess(data.video_url, jobId);
          } else {
            onError("Video generation completed but no URL provided", jobId);
            setIsPolling(false);
          }
        } else if (data.status === "FAILED") {
          const failureMessage = data.progress || "Video generation failed";
          updateJob(sessionId, jobId, {
            status: "FAILED",
            progress: failureMessage,
          });
          onError(failureMessage, jobId);
          appendStatus(
            sessionId,
            `${new Date().toLocaleTimeString()} • FAILED — ${failureMessage}`
          );
          setIsPolling(false);
        }
      } catch (err) {
        appendStatus(
          sessionId,
          `${new Date().toLocaleTimeString()} • RETRYING — ${
            err instanceof Error ? err.message : "Network error"
          }`
        );
        appendJobStatus(
          sessionId,
          jobId,
          "RETRYING",
          err instanceof Error ? err.message : "Network error"
        );
        const nextFailures = failureCount + 1;
        setFailureCount(nextFailures);
        if (nextFailures > 10) {
          onError("Connection lost. Please try again.", jobId);
          setIsPolling(false);
        }
      }
    };

    const interval = setInterval(pollStatus, 3000);
    pollStatus();

    return () => clearInterval(interval);
  }, [
    jobId,
    isPolling,
    failureCount,
    onSuccess,
    onError,
    appendStatus,
    updateSession,
  ]);

  if (!status) {
    return <SkeletonLoader />;
  }

  const currentPhaseIndex = STATUS_PHASES.findIndex(
    (p) => p.id === status.status
  );

  return (
    <div className="space-y-6">
      appendJobStatus, updateJob,
      {/* Main Status Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="glass-card p-8">
          <div className="space-y-6">
            {/* Header */}
            <div>
              <h2 className="text-2xl font-semibold mb-2">Video Generation</h2>
              <p className="text-muted-foreground">{status.progress}</p>
            </div>

            {/* Timeline */}
            <StatusTimeline
              phases={STATUS_PHASES}
              currentPhaseIndex={currentPhaseIndex}
            />

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">
                  {Math.round(
                    ((currentPhaseIndex + 1) / STATUS_PHASES.length) * 100
                  )}
                  %
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${
                      ((currentPhaseIndex + 1) / STATUS_PHASES.length) * 100
                    }%`,
                  }}
                  transition={{ duration: 0.8, ease: "easeInOut" }}
                  className="h-full bg-linear-to-r from-primary via-accent to-secondary"
                />
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
      {/* Details */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card className="glass-card p-6">
          <div className="text-sm space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Job ID</span>
              <span className="font-mono text-xs">{jobId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium capitalize">{status.status}</span>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
