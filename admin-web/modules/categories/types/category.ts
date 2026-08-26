export type AdminCategory = {
  id: string;
  slug: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  iconKey: string;
  sortOrder: number;
  isActive: boolean;
  referenceCount: number;
  references: { workers: number; orders: number; banners: number };
  createdAt: string;
  updatedAt: string;
};

export type CategoryInput = {
  slug: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  iconKey: string;
  sortOrder?: number;
  isActive?: boolean;
};

export type CategoriesPayload = { categories: AdminCategory[]; iconKeys: string[] };
