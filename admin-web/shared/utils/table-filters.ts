export function matchesTableSearch(values: readonly (string | number | null | undefined)[], queries: readonly string[]) {
  const fields = values.map((value) => String(value ?? "").toLocaleLowerCase());
  const text = fields.join(" ");
  return queries.every((query) => query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean).every((term) => {
    if (text.includes(term)) return true;
    if (!/^\+?[\d()-]+$/.test(term)) return false;
    const digits = term.replace(/\D/g, "");
    return Boolean(digits) && fields.some((field) => field.replace(/\D/g, "").includes(digits));
  }));
}

export function getFilterOptions(values: readonly string[], label: (value: string) => string = (value) => value) {
  return Array.from(new Set(values.filter(Boolean)))
    .sort((first, second) => first.localeCompare(second, "uz"))
    .map((value) => ({ value, label: label(value) }));
}
