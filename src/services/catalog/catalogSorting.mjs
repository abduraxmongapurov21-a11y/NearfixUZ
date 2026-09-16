const availabilityRank = Object.freeze({ available: 0, busy: 1, offline: 2 });

function rating(worker) {
  const value = Number(worker?.rating);
  return Number.isFinite(value) ? value : 0;
}

function price(worker) {
  const value = Number(worker?.basePriceValue);
  return Number.isFinite(value) && value > 0 ? value : Number.POSITIVE_INFINITY;
}

function distance(worker) {
  const rawValue = worker?.distanceMeters;
  if (rawValue === null || rawValue === undefined || rawValue === "") return Number.POSITIVE_INFINITY;
  const value = Number(rawValue);
  return Number.isFinite(value) && value >= 0 ? value : Number.POSITIVE_INFINITY;
}

function status(worker) {
  return availabilityRank[worker?.availability] ?? 3;
}

function byId(first, second) {
  return String(first?.id || "").localeCompare(String(second?.id || ""));
}

export function sortCatalogWorkers(workers, sort = "recommended") {
  const values = Array.isArray(workers) ? [...workers] : [];

  return values.sort((first, second) => {
    if (sort === "nearest") {
      return distance(first) - distance(second) || status(first) - status(second) || rating(second) - rating(first) || byId(first, second);
    }

    if (sort === "rating") {
      return rating(second) - rating(first) || status(first) - status(second) || byId(first, second);
    }

    if (sort === "price") {
      return price(first) - price(second) || rating(second) - rating(first) || status(first) - status(second) || byId(first, second);
    }

    return status(first) - status(second) || rating(second) - rating(first) || byId(first, second);
  });
}
