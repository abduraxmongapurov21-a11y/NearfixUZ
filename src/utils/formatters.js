export function formatOrderNumber(id) {
  return `#${String(id).replace("order-", "")}`;
}
