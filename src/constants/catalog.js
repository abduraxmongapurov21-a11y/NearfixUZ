export const DISTRICTS = ["Barchasi", "Yunusobod", "Chilonzor", "Mirzo Ulug'bek"];

export const PRICE_RANGES = [
  { id: "all", label: "Barchasi" },
  { id: "low", label: "70K gacha", max: 70000 },
  { id: "mid", label: "150K gacha", max: 150000 },
  { id: "premium", label: "150K+" }
];

export const DEFAULT_CATALOG_FILTERS = {
  availableNow: false,
  minRating: false,
  district: "Barchasi",
  priceRange: "all"
};
