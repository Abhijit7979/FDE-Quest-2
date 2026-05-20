import type { SupabaseClient } from "@supabase/supabase-js";

import { definitionFromJoined, parseAnswersJson } from "@/lib/responses/display";
import type { Definition } from "@/lib/schema/definition";

export const RESPONSES_PAGE_SIZE = 20;
export const SHEET_PAGE_SIZE = 50;

export type InboxResponseRow = {
  id: string;
  formId: string;
  formTitle: string;
  definition: Definition;
  answers: Record<string, unknown>;
  submittedAt: string;
};

export type ResponsesInboxResult = {
  rows: InboxResponseRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type FormFilterOption = {
  id: string;
  title: string;
};

export type ResponseFormSummary = {
  id: string;
  title: string;
  status: string;
  responseCount: number;
  lastSubmittedAt: string | null;
  fieldCount: number;
};

export type FormSheetMeta = {
  id: string;
  title: string;
  status: string;
  definition: Definition;
};

export type SheetResponseRow = {
  id: string;
  answers: Record<string, unknown>;
  submittedAt: string;
};

export type FormResponseSheetResult = {
  form: FormSheetMeta;
  rows: SheetResponseRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export class ResponsesDataError extends Error {}

type ResponseQueryRow = {
  id: string;
  form_id: string;
  answers: unknown;
  submitted_at: string;
  forms: { title: string | null; definition: unknown } | null;
};

export async function fetchResponsesInbox(
  supabase: SupabaseClient,
  options: { page?: number; formId?: string | null } = {},
): Promise<ResponsesInboxResult> {
  const page = Math.max(1, options.page ?? 1);
  const formId = options.formId?.trim() || null;
  const from = (page - 1) * RESPONSES_PAGE_SIZE;
  const to = from + RESPONSES_PAGE_SIZE - 1;

  let query = supabase
    .from("form_responses")
    .select(
      "id, form_id, answers, submitted_at, forms!inner(title, definition)",
      { count: "exact" },
    )
    .order("submitted_at", { ascending: false })
    .range(from, to);

  if (formId) {
    query = query.eq("form_id", formId);
  }

  const { data, error, count } = await query.returns<ResponseQueryRow[]>();

  if (error) throw new ResponsesDataError(error.message);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / RESPONSES_PAGE_SIZE));

  const rows: InboxResponseRow[] = (data ?? []).map((row) => ({
    id: row.id,
    formId: row.form_id,
    formTitle: row.forms?.title?.trim() || "Untitled form",
    definition: definitionFromJoined(row.forms?.definition),
    answers: parseAnswersJson(row.answers),
    submittedAt: row.submitted_at,
  }));

  return {
    rows,
    total,
    page: Math.min(page, totalPages),
    pageSize: RESPONSES_PAGE_SIZE,
    totalPages,
  };
}

export async function fetchResponseFormSummaries(
  supabase: SupabaseClient,
): Promise<ResponseFormSummary[]> {
  const [{ data: forms, error: formsErr }, { data: respRows, error: respErr }] =
    await Promise.all([
      supabase
        .from("forms")
        .select("id, title, status, definition")
        .order("updated_at", { ascending: false }),
      supabase
        .from("form_responses")
        .select("form_id, submitted_at"),
    ]);

  if (formsErr) throw new ResponsesDataError(formsErr.message);
  if (respErr) throw new ResponsesDataError(respErr.message);

  const agg = new Map<string, { count: number; lastAt: string }>();
  for (const r of respRows ?? []) {
    const prev = agg.get(r.form_id);
    if (!prev) {
      agg.set(r.form_id, { count: 1, lastAt: r.submitted_at });
      continue;
    }
    prev.count += 1;
    if (r.submitted_at > prev.lastAt) prev.lastAt = r.submitted_at;
  }

  const summaries = (forms ?? []).map((f) => {
    const stats = agg.get(f.id);
    const def = definitionFromJoined(f.definition);
    return {
      id: f.id,
      title: f.title?.trim() || "Untitled form",
      status: f.status,
      responseCount: stats?.count ?? 0,
      lastSubmittedAt: stats?.lastAt ?? null,
      fieldCount: def.fields.length,
    };
  });

  summaries.sort((a, b) => {
    if (a.responseCount > 0 && b.responseCount === 0) return -1;
    if (b.responseCount > 0 && a.responseCount === 0) return 1;
    const aTime = a.lastSubmittedAt ?? "";
    const bTime = b.lastSubmittedAt ?? "";
    return bTime.localeCompare(aTime);
  });

  return summaries;
}

export async function fetchFormResponseSheet(
  supabase: SupabaseClient,
  formId: string,
  page = 1,
): Promise<FormResponseSheetResult | null> {
  const id = formId.trim();
  if (!id) return null;

  const { data: form, error: formErr } = await supabase
    .from("forms")
    .select("id, title, status, definition")
    .eq("id", id)
    .maybeSingle();

  if (formErr) throw new ResponsesDataError(formErr.message);
  if (!form) return null;

  const safePage = Math.max(1, page);
  const from = (safePage - 1) * SHEET_PAGE_SIZE;
  const to = from + SHEET_PAGE_SIZE - 1;

  const { data, error, count } = await supabase
    .from("form_responses")
    .select("id, answers, submitted_at", { count: "exact" })
    .eq("form_id", id)
    .order("submitted_at", { ascending: false })
    .range(from, to);

  if (error) throw new ResponsesDataError(error.message);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / SHEET_PAGE_SIZE));

  return {
    form: {
      id: form.id,
      title: form.title?.trim() || "Untitled form",
      status: form.status,
      definition: definitionFromJoined(form.definition),
    },
    rows: (data ?? []).map((row) => ({
      id: row.id,
      answers: parseAnswersJson(row.answers),
      submittedAt: row.submitted_at,
    })),
    total,
    page: Math.min(safePage, totalPages),
    pageSize: SHEET_PAGE_SIZE,
    totalPages,
  };
}

export async function fetchFormFilterOptions(
  supabase: SupabaseClient,
): Promise<FormFilterOption[]> {
  const { data, error } = await supabase
    .from("forms")
    .select("id, title")
    .order("title", { ascending: true });

  if (error) throw new ResponsesDataError(error.message);

  return (data ?? []).map((f) => ({
    id: f.id,
    title: f.title?.trim() || "Untitled form",
  }));
}

export async function deleteFormResponse(
  supabase: SupabaseClient,
  responseId: string,
): Promise<void> {
  const { error } = await supabase
    .from("form_responses")
    .delete()
    .eq("id", responseId);

  if (error) throw new ResponsesDataError(error.message);
}
