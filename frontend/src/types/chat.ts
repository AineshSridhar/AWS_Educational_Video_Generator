import type { ToolType } from "@/lib/model-config";

export interface AttachmentMeta {
  name: string;
  size: number;
}

export type MessageStatus = "info" | "success" | "error";

export interface JobStatusEntry {
  status: string;
  progress?: string;
  timestamp: number;
}

export interface SessionJob {
  id: string;
  tool: ToolType;
  model: string;
  createdAt: number;
  status: string;
  progress?: string;
  history: JobStatusEntry[];
  videoUrl?: string;
  imageUrls?: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  tool?: ToolType;
  model?: string;
  attachments?: AttachmentMeta[];
  status?: MessageStatus;
  timestamp: number;
  videoUrl?: string;
  imageUrls?: string[];
  data?: unknown;
  jobId?: string;
}
