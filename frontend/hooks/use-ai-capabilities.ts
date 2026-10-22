"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

export type AITask = "cv.parse" | "job.parse" | "job.generate_description";
type Capabilities = { features: Partial<Record<AITask, { available: boolean }>> };

export function useAICapabilities(task: AITask) {
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setAvailable(false);
    apiRequest<Capabilities>("/api/v1/intelligence/capabilities", { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setAvailable(result.features?.[task]?.available === true); })
      .catch(() => { if (!controller.signal.aborted) setAvailable(false); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [task]);
  return { available, loading };
}
