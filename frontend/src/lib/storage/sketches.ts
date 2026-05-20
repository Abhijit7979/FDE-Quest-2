import type { SupabaseClient } from "@supabase/supabase-js";

export const SKETCHES_BUCKET = "sketches";
export const MAX_SKETCH_BYTES = 10 * 1024 * 1024;
export const ALLOWED_SKETCH_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedSketchMime = (typeof ALLOWED_SKETCH_MIME)[number];

export class SketchUploadError extends Error {}

function extensionFor(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

export function validateSketchFile(file: File): void {
  if (!ALLOWED_SKETCH_MIME.includes(file.type as AllowedSketchMime)) {
    throw new SketchUploadError(
      "Unsupported file type. Use JPEG, PNG, or WebP.",
    );
  }
  if (file.size > MAX_SKETCH_BYTES) {
    throw new SketchUploadError("Sketch is larger than 10 MB.");
  }
}

export type UploadSketchResult = {
  storagePath: string;
};

/**
 * Uploads a sketch to the private `sketches` bucket at the RLS-required
 * path layout: `{userId}/{uuid}.{ext}`. Returns the storage path that the
 * FastAPI service expects in the /forms/generate body.
 */
export async function uploadSketch(
  supabase: SupabaseClient,
  userId: string,
  file: File,
): Promise<UploadSketchResult> {
  validateSketchFile(file);
  const ext = extensionFor(file.type);
  const storagePath = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(SKETCHES_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });
  if (error) {
    throw new SketchUploadError(error.message);
  }
  return { storagePath };
}
