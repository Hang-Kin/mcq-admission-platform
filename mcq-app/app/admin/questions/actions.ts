"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import {
  MAX_QUESTION_IMAGE_BYTES,
  QUESTION_IMAGE_BUCKET,
  publicQuestionImagePath,
  questionImageError,
  questionImageExtension,
} from "./questionImages";
import {
  MAX_IMPORT_ROWS,
  validateQuestionRow,
  type QuestionPayload,
} from "./questionValidation";

export type { QuestionPayload };

const STAFF_ROLES = ["admin", "teacher"];

function parseQuestionPayload(
  formData: FormData,
): ReturnType<typeof validateQuestionRow> {
  const question_text = String(formData.get("question_text") ?? "");
  const category = String(formData.get("category") ?? "");
  const type = String(formData.get("type") ?? "").trim();
  const correctAnswerRaw = String(formData.get("correct_answer") ?? "");
  const optionsRaw = String(formData.get("options") ?? "");
  const question_set = String(formData.get("question_set") ?? "");

  let options: string[] | null = null;
  if (type === "radio") {
    try {
      const parsed = JSON.parse(optionsRaw);
      options = Array.isArray(parsed)
        ? parsed.map((value) => String(value))
        : [];
    } catch {
      options = [];
    }
  }

  return validateQuestionRow({
    question_text,
    category,
    type,
    options,
    correct_answer: correctAnswerRaw,
    question_set,
    requireQuestionSet: true,
  });
}

async function requireRole(allowed: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You are not signed in. Refresh and log in again." } as const;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? "";
  if (!allowed.includes(role)) {
    return { error: "You do not have permission to change questions." } as const;
  }

  return { supabase, role } as const;
}

function imageFile(formData: FormData): File | null {
  const value = formData.get("image");
  if (!value || typeof value === "string") return null;
  if (value.size === 0 || typeof value.arrayBuffer !== "function") return null;
  return value;
}

async function uploadQuestionImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  file: File,
): Promise<{ url: string } | { error: string }> {
  const invalid = questionImageError(file);
  if (invalid) return { error: invalid };

  const extension = questionImageExtension(file.type);
  if (!extension) return { error: "Image must be PNG, JPEG, WEBP, or GIF." };
  if (file.size > MAX_QUESTION_IMAGE_BYTES) {
    return { error: "Image must be 5 MB or smaller." };
  }

  const path = `${crypto.randomUUID()}.${extension}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await supabase.storage
    .from(QUESTION_IMAGE_BUCKET)
    .upload(path, bytes, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    return {
      error:
        "Could not upload the image. Apply migration 012 if the question-images bucket is not set up yet.",
    };
  }

  const { data } = supabase.storage.from(QUESTION_IMAGE_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}

async function removeStoredImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  imageUrl: string | null,
) {
  if (!imageUrl) return;
  const path = publicQuestionImagePath(imageUrl);
  if (!path) return;
  await supabase.storage.from(QUESTION_IMAGE_BUCKET).remove([path]);
}

async function resolveImageUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData,
  currentUrl: string | null,
): Promise<{ url: string | null; replaced: boolean } | { error: string }> {
  const file = imageFile(formData);
  const remove = String(formData.get("remove_image") ?? "") === "1";

  if (file) {
    const uploaded = await uploadQuestionImage(supabase, file);
    if ("error" in uploaded) return uploaded;
    return { url: uploaded.url, replaced: true };
  }

  if (remove) {
    return { url: null, replaced: true };
  }

  return { url: currentUrl, replaced: false };
}

export async function createQuestion(formData: FormData) {
  const parsed = parseQuestionPayload(formData);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const auth = await requireRole(STAFF_ROLES);
  if ("error" in auth) return { error: auth.error };

  const image = await resolveImageUrl(auth.supabase, formData, null);
  if ("error" in image) return image;

  const { error } = await auth.supabase.from("questions").insert({
    ...parsed.payload,
    image_url: image.url,
  });

  if (error) {
    if (image.replaced) await removeStoredImage(auth.supabase, image.url);
    return { error: error.message };
  }

  revalidatePath("/admin/questions");
  redirect("/admin/questions");
}

export async function updateQuestion(id: string, formData: FormData) {
  const parsed = parseQuestionPayload(formData);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const auth = await requireRole(STAFF_ROLES);
  if ("error" in auth) return { error: auth.error };

  const { data: existing, error: existingError } = await auth.supabase
    .from("questions")
    .select("image_url")
    .eq("id", id)
    .single();

  if (existingError || !existing) {
    return { error: "Question not found." };
  }

  const image = await resolveImageUrl(
    auth.supabase,
    formData,
    existing.image_url,
  );
  if ("error" in image) return image;

  const { error } = await auth.supabase
    .from("questions")
    .update({
      ...parsed.payload,
      image_url: image.url,
    })
    .eq("id", id);

  if (error) {
    if (image.replaced && image.url && image.url !== existing.image_url) {
      await removeStoredImage(auth.supabase, image.url);
    }
    return { error: error.message };
  }

  if (image.replaced && existing.image_url && existing.image_url !== image.url) {
    await removeStoredImage(auth.supabase, existing.image_url);
  }

  revalidatePath("/admin/questions");
  revalidatePath(`/admin/questions/${id}/edit`);
  redirect("/admin/questions");
}

export async function deleteQuestion(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Missing question." };

  const auth = await requireRole(["admin"]);
  if ("error" in auth) return { error: auth.error };

  const { data: existing } = await auth.supabase
    .from("questions")
    .select("image_url")
    .eq("id", id)
    .maybeSingle();

  const { error } = await auth.supabase.from("questions").delete().eq("id", id);

  if (error) {
    return {
      error:
        "Could not delete this question. Only an admin can delete questions, and questions already used in a sitting cannot be removed.",
    };
  }

  await removeStoredImage(auth.supabase, existing?.image_url ?? null);
  revalidatePath("/admin/questions");
  redirect("/admin/questions");
}

export async function bulkImportQuestions(rows: QuestionPayload[]) {
  if (rows.length === 0) {
    return { error: "CSV has no data rows." };
  }

  if (rows.length > MAX_IMPORT_ROWS) {
    return {
      error: `CSV files are limited to ${MAX_IMPORT_ROWS} questions. This import has ${rows.length} data rows.`,
    };
  }

  for (const row of rows) {
    const result = validateQuestionRow(row);
    if (!result.ok) {
      return { error: result.error };
    }
  }

  const auth = await requireRole(STAFF_ROLES);
  if ("error" in auth) return { error: auth.error };

  const { error } = await auth.supabase.from("questions").insert(rows);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/questions");
  redirect("/admin/questions");
}
