import type { SupabaseClient } from "@supabase/supabase-js";

// Files submitted by respondents through `file_upload` fields land in the
// private `response-uploads` bucket. Layout: {form_id}/{uuid}.{ext} — the
// migration's RLS lets anon upload only into a published form's folder.

export const RESPONSE_UPLOADS_BUCKET = "response-uploads";
export const MAX_RESPONSE_FILE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_RESPONSE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export type AllowedResponseMime = (typeof ALLOWED_RESPONSE_MIME)[number];

/** Shape stored in `form_responses.answers` for a `file_upload` field. */
export type UploadedFileAnswer = {
  path: string;
  name: string;
  size: number;
  mime: string;
};

export class ResponseUploadError extends Error {}

function extensionFor(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "application/pdf":
      return "pdf";
    default:
      return "bin";
  }
}

export function validateResponseFile(file: File): void {
  if (!ALLOWED_RESPONSE_MIME.includes(file.type as AllowedResponseMime)) {
    throw new ResponseUploadError(
      "Unsupported file type. Upload a JPEG, PNG, WebP, or PDF.",
    );
  }
  if (file.size > MAX_RESPONSE_FILE_BYTES) {
    throw new ResponseUploadError("File is larger than 10 MB.");
  }
}

/**
 * Uploads a respondent's file to the `response-uploads` bucket and returns
 * the value to store in the answer payload for that field.
 */
export async function uploadResponseFile(
  supabase: SupabaseClient,
  formId: string,
  file: File,
): Promise<UploadedFileAnswer> {
  validateResponseFile(file);
  const ext = extensionFor(file.type);
  const path = `${formId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(RESPONSE_UPLOADS_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });
  if (error) throw new ResponseUploadError(error.message);

  return { path, name: file.name, size: file.size, mime: file.type };
}

/** Owner-side: mint a short-lived signed URL to view/download a submitted file. */
export async function createResponseFileSignedUrl(
  supabase: SupabaseClient,
  path: string,
  expiresInSeconds = 120,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(RESPONSE_UPLOADS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw new ResponseUploadError(
      error?.message ?? "Could not create a download link.",
    );
  }
  return data.signedUrl;
}

/** Type guard for a stored `file_upload` answer value. */
export function isUploadedFileAnswer(value: unknown): value is UploadedFileAnswer {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.path === "string" && typeof v.name === "string";
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
