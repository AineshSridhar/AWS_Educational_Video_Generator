import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SuccessScreenProps {
  videoUrl: string;
  onReset: () => void;
  sessionId?: string | null;
}

export function SuccessScreen({
  videoUrl,
  onReset,
  sessionId,
}: SuccessScreenProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Success Animation */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, type: "spring", stiffness: 100 }}
        className="text-center"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, ease: "easeInOut" }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/20 mb-4"
        >
          <span className="text-4xl">✨</span>
        </motion.div>
        <h2 className="text-3xl font-bold mb-2 gradient-text">
          Video Generated Successfully!
        </h2>
        <p className="text-muted-foreground">
          Your educational video is ready to watch
        </p>
      </motion.div>

      {/* Video Preview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card className="glass-card overflow-hidden">
          <div className="aspect-video bg-linear-to-br from-primary/10 to-accent/10 flex items-center justify-center">
            <video
              src={videoUrl}
              controls
              className="w-full h-full"
              controlsList="nodownload"
            >
              Your browser does not support the video tag.
            </video>
          </div>
        </Card>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="flex flex-col gap-4 sm:flex-row"
      >
        <Button
          onClick={() => {
            const a = document.createElement("a");
            a.href = videoUrl;
            a.download = "generated-video.mp4";
            a.click();
          }}
          className="flex-1 py-3 bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold rounded-lg transition-all"
        >
          📥 Download Video
        </Button>
        <Button
          onClick={onReset}
          className="flex-1 py-3 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-lg transition-all"
        >
          🎬 Generate Another
        </Button>
        {sessionId && (
          <Button
            variant="outline"
            onClick={() => navigate(`/session/${sessionId}`)}
            className="flex-1 py-3"
          >
            View Session
          </Button>
        )}
      </motion.div>

      {/* Video Details */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        <Card className="glass-card p-6">
          <div className="text-sm space-y-2">
            <p className="text-muted-foreground">
              Video successfully generated using AWS Bedrock Nova Reel
            </p>
            <p className="text-muted-foreground">
              Powered by Gemini AI for script analysis and prompt generation
            </p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
