import { z } from "zod";

export function supportContactHtml(email: string | undefined, subject = "NearFIX yordam") {
  if (!email) return "";
  const parsed = z.string().trim().email().safeParse(email);
  if (!parsed.success) throw new Error("PUBLIC_SUPPORT_EMAIL must be a valid email address");
  const text = parsed.data.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
  return `<a href="mailto:${encodeURIComponent(parsed.data)}?subject=${encodeURIComponent(subject)}">${text}</a>`;
}
