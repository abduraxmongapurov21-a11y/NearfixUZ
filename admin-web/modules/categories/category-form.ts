import type { CategoryInput } from "./types/category";

const fieldMessages = {
  slug: "Slug: 2–64 ta kichik lotin harfi, raqam yoki defis (-) ishlating. Bo'shliq mumkin emas. Masalan: test-slug.",
  nameUz: "O'zbekcha nomi: 2–80 ta belgidan iborat nom kiriting.",
  nameRu: "Ruscha nomi: 2–80 ta belgidan iborat nom kiriting.",
  nameEn: "Inglizcha nomi: 2–80 ta belgidan iborat nom kiriting.",
  iconKey: "Ikonka: ro'yxatdan mavjud ikonka tanlang."
};

export function validateCategoryDraft(draft: CategoryInput, editing: boolean) {
  const slug = draft.slug.trim();
  if (!editing && (slug.length < 2 || slug.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))) {
    return fieldMessages.slug;
  }
  for (const field of ["nameUz", "nameRu", "nameEn"] as const) {
    const length = draft[field].trim().length;
    if (length < 2 || length > 80) return fieldMessages[field];
  }
  return null;
}

export function categorySaveErrorMessage(value: unknown) {
  if (value && typeof value === "object" && "code" in value && value.code === "VALIDATION_ERROR" && "payload" in value) {
    const payload = value.payload;
    if (payload && typeof payload === "object" && "issues" in payload) {
      const issues = payload.issues;
      if (issues && typeof issues === "object" && "fieldErrors" in issues) {
        const fields = issues.fieldErrors;
        if (fields && typeof fields === "object") {
          const fieldErrors = fields as Record<string, unknown>;
          const messages = (Object.keys(fieldMessages) as (keyof typeof fieldMessages)[])
            .filter((field) => Array.isArray(fieldErrors[field]) && fieldErrors[field].length > 0)
            .map((field) => fieldMessages[field]);
          if (messages.length) return messages.join(" ");
        }
      }
    }
  }
  return value instanceof Error ? value.message : "Kategoriya saqlanmadi";
}
