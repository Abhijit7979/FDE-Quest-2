import type { SupabaseClient } from "@supabase/supabase-js";

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export type FormFieldType =
  | "short_text"
  | "long_text"
  | "email"
  | "number"
  | "phone"
  | "single_choice"
  | "multi_choice"
  | "dropdown"
  | "date"
  | "yes_no"
  | "file_upload";

export type FormField = {
  id: string;
  type: FormFieldType;
  label: string;
  required: boolean;
  placeholder: string | null;
  options?: string[];
  needs_review: boolean;
};

export type FormDefinition = {
  version: 1;
  fields: FormField[];
};

export type GenerateResponse = {
  job_id: string;
  form_id: string;
  status: JobStatus;
};

export type JobStatusResponse = {
  job_id: string;
  form_id: string | null;
  status: JobStatus;
  error: string | null;
  definition: FormDefinition | null;
  warnings: string[];
};

export class FormsApiError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
  ) {
    super(message);
  }
}

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

async function getAccessToken(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new FormsApiError(error.message, 401);
  const token = data.session?.access_token;
  if (!token) throw new FormsApiError("Not authenticated", 401);
  return token;
}

async function call<T>(
  supabase: SupabaseClient,
  path: string,
  init: RequestInit,
): Promise<T> {
  const token = await getAccessToken(supabase);
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail: string;
    try {
      const body = (await res.json()) as { detail?: string };
      detail = body.detail ?? res.statusText;
    } catch {
      detail = res.statusText;
    }
    throw new FormsApiError(detail, res.status);
  }
  return (await res.json()) as T;
}

export type GenerateFormBody = {
  storage_paths?: string[];
  /** @deprecated Prefer storage_paths */
  storage_path?: string;
  description?: string;
  form_id?: string;
};

export function generateForm(
  supabase: SupabaseClient,
  body: GenerateFormBody,
): Promise<GenerateResponse> {
  return call<GenerateResponse>(supabase, "/forms/generate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function pollGenerationJob(
  supabase: SupabaseClient,
  jobId: string,
): Promise<JobStatusResponse> {
  return call<JobStatusResponse>(supabase, `/forms/generate/${jobId}`, {
    method: "GET",
  });
}

export function validateDefinition(
  supabase: SupabaseClient,
  definition: unknown,
): Promise<{ valid: boolean; errors: unknown[] }> {
  return call(supabase, "/forms/validate", {
    method: "POST",
    body: JSON.stringify({ definition }),
  });
}

const TERMINAL: ReadonlySet<JobStatus> = new Set(["completed", "failed"]);

export async function waitForGenerationJob(
  supabase: SupabaseClient,
  jobId: string,
  opts: {
    intervalMs?: number;
    timeoutMs?: number;
    onTick?: (s: JobStatusResponse) => void;
    signal?: AbortSignal;
  } = {},
): Promise<JobStatusResponse> {
  const interval = opts.intervalMs ?? 2000;
  const timeout = opts.timeoutMs ?? 120_000;
  const deadline = Date.now() + timeout;

  while (true) {
    if (opts.signal?.aborted) throw new FormsApiError("Cancelled", 0);
    const snapshot = await pollGenerationJob(supabase, jobId);
    opts.onTick?.(snapshot);
    if (TERMINAL.has(snapshot.status)) return snapshot;
    if (Date.now() > deadline) {
      throw new FormsApiError("Generation timed out", 504);
    }
    await new Promise((r) => setTimeout(r, interval));
  }
}
