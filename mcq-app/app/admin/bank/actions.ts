"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isStaffRole } from "@/lib/staffRole";
import { createClient } from "@/lib/supabase/server";

import {
  attachmentError,
  attachmentExtension,
  publicQuestionImagePath,
  QUESTION_IMAGE_BUCKET,
  uploadFailureMessage,
} from "./attachments";
import { validateBankQuestion } from "./bankValidation";
import { bankWriteError } from "./schemaError";
import {
  isRealTopic,
  parseSubject,
  topicHref,
  validateTopicName,
  type SubjectId,
} from "./subjects";

type StaffClient = Awaited<ReturnType<typeof createClient>>;

async function requireStaff() {
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

  if (!isStaffRole(profile?.role)) {
    return { error: "You do not have permission to change questions." } as const;
  }

  return { supabase } as const;
}

function fileFrom(formData: FormData): File | null {
  const value = formData.get("attachment");
  if (!value || typeof value === "string") return null;
  if (value.size === 0 || typeof value.arrayBuffer !== "function") return null;
  return value;
}

async function uploadAttachment(
  supabase: StaffClient,
  file: File,
): Promise<{ url: string } | { error: string }> {
  const invalid = attachmentError(file);
  if (invalid) return { error: invalid };

  const extension = attachmentExtension(file.type);
  if (!extension) return { error: "Use a PNG, JPEG, WEBP, GIF, or PDF file." };

  const path = `${crypto.randomUUID()}.${extension}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = file.type === "image/jpg" ? "image/jpeg" : file.type;
  const { error } = await supabase.storage.from(QUESTION_IMAGE_BUCKET).upload(path, bytes, {
    contentType,
    upsert: false,
  });

  if (error) return { error: uploadFailureMessage(file.type, error.message) };

  const { data } = supabase.storage.from(QUESTION_IMAGE_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}

async function removeStored(supabase: StaffClient, imageUrl: string | null) {
  if (!imageUrl) return;
  const path = publicQuestionImagePath(imageUrl);
  if (!path) return;
  await supabase.storage.from(QUESTION_IMAGE_BUCKET).remove([path]);
}

async function resolveAttachment(
  supabase: StaffClient,
  formData: FormData,
  currentUrl: string | null,
): Promise<{ url: string | null; replaced: boolean } | { error: string }> {
  const file = fileFrom(formData);
  const remove = String(formData.get("remove_attachment") ?? "") === "1";

  if (file) {
    const uploaded = await uploadAttachment(supabase, file);
    if ("error" in uploaded) return uploaded;
    return { url: uploaded.url, replaced: true };
  }

  if (remove) return { url: null, replaced: true };
  return { url: currentUrl, replaced: false };
}

function readOptions(formData: FormData): string[] | null {
  const raw = String(formData.get("options") ?? "");
  if (!raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((value) => String(value)) : [];
  } catch {
    return [];
  }
}

function refreshBank(subject: SubjectId, category: string) {
  revalidatePath("/admin/bank");
  revalidatePath(`/admin/bank/${subject}`);
  revalidatePath(`/admin/bank/${subject}/without-topic`);
  if (isRealTopic(category)) {
    revalidatePath(topicHref(subject, category));
  }
  revalidatePath("/admin/questions");
}

function safeBankPath(value: string): string | null {
  if (!value.startsWith("/admin/bank")) return null;
  if (value.startsWith("//") || value.includes("://") || value.includes("\\")) return null;
  return value;
}

export async function openTopic(subject: string, formData: FormData) {
  const parsed = parseSubject(subject);
  if (!parsed) return { error: "Choose Math or Chinese." };

  const topic = validateTopicName(String(formData.get("topic") ?? ""));
  if (!topic.ok) return { error: topic.error };

  redirect(topicHref(parsed, topic.name));
}

export async function createBankQuestion(formData: FormData) {
  const parsed = validateBankQuestion({
    subject: String(formData.get("subject") ?? ""),
    category: String(formData.get("topic") ?? ""),
    questionText: String(formData.get("question_text") ?? ""),
    kind: String(formData.get("answer_kind") ?? ""),
    options: readOptions(formData),
    correctAnswer: String(formData.get("correct_answer") ?? ""),
    fractionA: String(formData.get("fraction_a") ?? ""),
    fractionB: String(formData.get("fraction_b") ?? ""),
  });
  if (!parsed.ok) return { error: parsed.error };

  const auth = await requireStaff();
  if ("error" in auth) return { error: auth.error };

  const image = await resolveAttachment(auth.supabase, formData, null);
  if ("error" in image) return image;

  const { error } = await auth.supabase.from("questions").insert({
    question_text: parsed.payload.question_text,
    category: parsed.payload.category,
    subject: parsed.payload.subject,
    type: parsed.payload.type,
    options: parsed.payload.options,
    correct_answer: parsed.payload.correct_answer,
    question_set: null,
    image_url: image.url,
  });

  if (error) {
    if (image.replaced) await removeStored(auth.supabase, image.url);
    return { error: bankWriteError(error.message) };
  }

  refreshBank(parsed.payload.subject, parsed.payload.category);
}

export async function updateBankQuestion(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "This question could not be found." };

  const auth = await requireStaff();
  if ("error" in auth) return { error: auth.error };

  const { data: existing, error: existingError } = await auth.supabase
    .from("questions")
    .select("id, category, subject, image_url")
    .eq("id", id)
    .maybeSingle();

  if (existingError || !existing) {
    return {
      error: existingError
        ? bankWriteError(existingError.message)
        : "This question could not be found.",
    };
  }

  const filing = String(formData.get("filing") ?? "") === "1";
  const typedTopic = String(formData.get("topic") ?? "");
  const keepLegacy = filing && !typedTopic.trim();
  const category = keepLegacy ? String(existing.category ?? "") : typedTopic;

  const parsed = validateBankQuestion({
    subject: String(formData.get("subject") ?? ""),
    category,
    allowLegacyCategory: keepLegacy,
    questionText: String(formData.get("question_text") ?? ""),
    kind: String(formData.get("answer_kind") ?? ""),
    options: readOptions(formData),
    correctAnswer: String(formData.get("correct_answer") ?? ""),
    fractionA: String(formData.get("fraction_a") ?? ""),
    fractionB: String(formData.get("fraction_b") ?? ""),
  });
  if (!parsed.ok) return { error: parsed.error };

  if (existing.subject !== parsed.payload.subject) {
    return { error: "This question belongs to a different subject." };
  }

  const image = await resolveAttachment(auth.supabase, formData, existing.image_url);
  if ("error" in image) return image;

  const { error } = await auth.supabase
    .from("questions")
    .update({
      question_text: parsed.payload.question_text,
      category: parsed.payload.category,
      subject: parsed.payload.subject,
      type: parsed.payload.type,
      options: parsed.payload.options,
      correct_answer: parsed.payload.correct_answer,
      image_url: image.url,
    })
    .eq("id", id);

  if (error) {
    if (image.replaced && image.url && image.url !== existing.image_url) {
      await removeStored(auth.supabase, image.url);
    }
    return { error: bankWriteError(error.message) };
  }

  if (image.replaced && existing.image_url && existing.image_url !== image.url) {
    await removeStored(auth.supabase, existing.image_url);
  }

  refreshBank(parsed.payload.subject, parsed.payload.category);
  if (existing.category && existing.category !== parsed.payload.category) {
    refreshBank(parsed.payload.subject, String(existing.category));
  }

  const destination = isRealTopic(parsed.payload.category)
    ? topicHref(parsed.payload.subject, parsed.payload.category)
    : `/admin/bank/${parsed.payload.subject}/without-topic`;
  redirect(destination);
}

export async function deleteBankQuestion(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "This question could not be found." };

  const auth = await requireStaff();
  if ("error" in auth) return { error: auth.error };

  const { data: existing } = await auth.supabase
    .from("questions")
    .select("image_url, subject, category")
    .eq("id", id)
    .maybeSingle();

  const { error } = await auth.supabase.from("questions").delete().eq("id", id);
  if (error) {
    return {
      error:
        "Could not delete this question. You may not have permission, or a sitting is already using it.",
    };
  }

  await removeStored(auth.supabase, existing?.image_url ?? null);

  const subject = parseSubject(existing?.subject);
  if (subject) {
    refreshBank(subject, String(existing?.category ?? ""));
  } else {
    revalidatePath("/admin/bank");
  }

  const returnTo = safeBankPath(String(formData.get("return_to") ?? ""));
  redirect(returnTo ?? (subject ? `/admin/bank/${subject}` : "/admin/bank"));
}
