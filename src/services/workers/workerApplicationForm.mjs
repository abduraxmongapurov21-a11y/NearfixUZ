export const MAX_WORKER_PROFESSIONS = 5;

export function normalizeDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

export function formatGroupedDigits(value) {
  const digits = normalizeDigits(value).replace(/^0+(?=\d)/, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function toggleProfessionSelection(current, profession, max = MAX_WORKER_PROFESSIONS) {
  const selected = Array.from(new Set((current || []).filter(Boolean)));
  if (selected.includes(profession)) {
    return { professions: selected.filter((item) => item !== profession), limitReached: false };
  }
  if (selected.length >= max) return { professions: selected, limitReached: true };
  return { professions: [...selected, profession], limitReached: false };
}

export function workerApplicationPayload(form, partial = false) {
  const categoryIds = Array.from(new Set((form.categoryIds || []).filter(Boolean)));
  const professions = Array.from(new Set((form.professions || []).map((item) => item.trim()).filter(Boolean)));
  const payload = {
    name: form.name.trim(),
    cityId: form.cityId.trim(),
    ...(categoryIds.length ? { categoryIds } : { profession: professions[0] || "", professions }),
    experienceYears: form.experienceYears === "" ? undefined : Number(normalizeDigits(form.experienceYears)),
    profileImageUrl: form.profileImageUrl.trim(),
    bio: form.bio.trim(),
    basePrice: form.basePrice === "" ? undefined : Number(normalizeDigits(form.basePrice))
  };

  if (!partial) return payload;
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) =>
      value !== "" && value !== undefined && !(Array.isArray(value) && !value.length)
    )
  );
}

export function missingWorkerApplicationFields(form) {
  const missing = [];
  if (form.name.trim().length < 2) missing.push("Ism");
  if (form.cityId.trim().length < 2) missing.push("Shahar");
  if (!form.categoryIds?.length && !form.professions?.length) missing.push("Xizmat sohasi");
  if (form.experienceYears === "") missing.push("Tajriba");
  if (!form.profileImageUrl.trim()) missing.push("Profil rasmi");
  if (!form.bio.trim()) missing.push("O'zingiz haqingizda");
  if (!Number(normalizeDigits(form.basePrice))) missing.push("Boshlang'ich narx");
  return missing;
}

export function workerApplicationErrorMessage(result) {
  if (result?.status === 404) {
    return "Usta arizasi API serverda topilmadi. Development backend manzilini yoki backend versiyasini tekshiring.";
  }
  if (result?.code === "REQUEST_TIMEOUT" || result?.code === "NETWORK_REQUEST_FAILED") {
    return "Backend bilan aloqa o'rnatilmadi. Telefon va kompyuter bir tarmoqda ekanini tekshiring.";
  }
  if (result?.code === "WORKER_PROFILE_INCOMPLETE" && result?.missing?.length) {
    return `Quyidagi maydonlarni to'ldiring: ${result.missing.join(", ")}.`;
  }
  return result?.message || "Ma'lumotlarni tekshirib qayta urinib ko'ring.";
}
