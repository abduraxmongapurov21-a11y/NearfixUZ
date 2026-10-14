export function workerExperienceLabel(experience, translate) {
  const value = typeof experience === "string" ? experience.trim() : "";
  const years = value.match(/^(\d+(?:\.\d+)?)\s+yil$/u);
  if (years) {
    const count = Number(years[1]);
    return translate("{{value0}} yil", { value0: count, count });
  }
  return translate(value || "Ko'rsatilmagan");
}
