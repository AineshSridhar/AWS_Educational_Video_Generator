import { API_ENDPOINTS, MODEL_CONFIG, type ToolType } from "./model-config";

export interface ToolRequestOptions {
  tool: ToolType;
  model: string;
  prompt: string;
  files?: File[];
  metadata?: Record<string, string>;
}

export interface ToolResponse {
  jobId?: string;
  data: unknown;
  endpoint: string;
}

export async function submitToolRequest(
  options: ToolRequestOptions
): Promise<ToolResponse> {
  const { tool, model, prompt, files = [], metadata = {} } = options;
  const endpointPath = MODEL_CONFIG[tool]?.[model];

  if (!endpointPath) {
    throw new Error(`Model "${model}" is not configured for ${tool}.`);
  }

  const formData = new FormData();
  formData.append("prompt", prompt);
  formData.append("tool", tool);
  formData.append("model", model);

  Object.entries(metadata).forEach(([key, value]) => {
    formData.append(key, value);
  });

  files.forEach((file, index) => {
    formData.append(`file_${index}`, file, file.name);
  });

  const response = await fetch(API_ENDPOINTS.modelPath(endpointPath), {
    method: "POST",
    body: formData,
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "detail" in payload
        ? String((payload as { detail: unknown }).detail)
        : "Request failed";
    throw new Error(message);
  }

  const jobId =
    typeof payload === "object" && payload && "job_id" in payload
      ? String((payload as { job_id: unknown }).job_id)
      : undefined;

  return {
    jobId,
    data: payload,
    endpoint: endpointPath,
  };
}
