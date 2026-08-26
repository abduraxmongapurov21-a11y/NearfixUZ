"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/shared/components/data-table";
import { hasPermission } from "@/shared/auth/permissions";
import { useAdminSessionStore } from "@/stores/admin-session-store";
import { resolveCategoryIcon } from "../category-icons";
import { useCategories } from "../hooks/use-categories";
import { createCategory, deleteCategory, reorderCategories, updateCategory } from "../services/categories-service";
import type { AdminCategory, CategoryInput } from "../types/category";

const emptyDraft: CategoryInput = {
  slug: "", nameUz: "", nameRu: "", nameEn: "", iconKey: "grid", isActive: true
};

export function CategoriesManager() {
  const { data = { categories: [], iconKeys: [] } } = useCategories();
  const queryClient = useQueryClient();
  const session = useAdminSessionStore((state) => state.session);
  const canManage = hasPermission(session, "content.manage");
  const [draft, setDraft] = useState<CategoryInput>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const categories = useMemo(() => [...data.categories].sort((a, b) => a.sortOrder - b.sortOrder), [data.categories]);

  async function refresh(success: string) {
    setMessage(success); setError(null);
    await queryClient.invalidateQueries({ queryKey: ["categories"] });
  }

  const saveMutation = useMutation({
    mutationFn: () => editingId
      ? updateCategory(editingId, { nameUz: draft.nameUz, nameRu: draft.nameRu, nameEn: draft.nameEn, iconKey: draft.iconKey, isActive: draft.isActive })
      : createCategory(draft),
    onSuccess: async () => { setDraft(emptyDraft); setEditingId(null); await refresh(editingId ? "Category yangilandi." : "Category yaratildi."); },
    onError: (value) => setError(value instanceof Error ? value.message : "Category saqlanmadi")
  });
  const toggleMutation = useMutation({
    mutationFn: (category: AdminCategory) => updateCategory(category.id, { isActive: !category.isActive }),
    onSuccess: () => refresh("Category holati yangilandi."),
    onError: (value) => setError(value instanceof Error ? value.message : "Holat saqlanmadi")
  });
  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => refresh("Category o'chirildi."),
    onError: (value) => setError(value instanceof Error ? value.message : "Category o'chirilmadi")
  });
  const reorderMutation = useMutation({
    mutationFn: reorderCategories,
    onSuccess: () => refresh("Tartib yangilandi."),
    onError: (value) => setError(value instanceof Error ? value.message : "Tartib saqlanmadi")
  });

  function submit(event: FormEvent) { event.preventDefault(); setMessage(null); setError(null); saveMutation.mutate(); }
  function edit(category: AdminCategory) {
    setEditingId(category.id);
    setDraft({ slug: category.slug, nameUz: category.nameUz, nameRu: category.nameRu, nameEn: category.nameEn, iconKey: category.iconKey, isActive: category.isActive });
  }
  function move(category: AdminCategory, direction: -1 | 1) {
    const index = categories.findIndex((item) => item.id === category.id);
    const target = index + direction;
    if (target < 0 || target >= categories.length) return;
    const next = [...categories]; [next[index], next[target]] = [next[target], next[index]];
    reorderMutation.mutate(next.map((item, sortOrder) => ({ id: item.id, sortOrder })));
  }

  const columns: ColumnDef<AdminCategory>[] = [
    { header: "Category", cell: ({ row }) => { const Icon = resolveCategoryIcon(row.original.iconKey); return <div className="flex items-center gap-3"><div className="rounded-md bg-primary/10 p-2"><Icon className="h-5 w-5 text-primary" /></div><div><div className="font-medium">{row.original.nameUz}</div><div className="text-xs text-muted-foreground">{row.original.slug}</div></div></div>; } },
    { header: "RU / EN", cell: ({ row }) => <div className="text-sm"><div>{row.original.nameRu}</div><div className="text-muted-foreground">{row.original.nameEn}</div></div> },
    { header: "Status", cell: ({ row }) => <Badge variant={row.original.isActive ? "success" : "secondary"}>{row.original.isActive ? "Active" : "Inactive"}</Badge> },
    { header: "References", cell: ({ row }) => <span title={`Workers: ${row.original.references.workers}, Orders: ${row.original.references.orders}, Banners: ${row.original.references.banners}`}>{row.original.referenceCount}</span> },
    { header: "Actions", cell: ({ row }) => { const index = categories.findIndex((item) => item.id === row.original.id); return <div className="flex flex-wrap gap-2">
      <Button disabled={!canManage || index === 0 || reorderMutation.isPending} onClick={() => move(row.original, -1)} size="icon" variant="outline"><ArrowUp className="h-4 w-4" /></Button>
      <Button disabled={!canManage || index === categories.length - 1 || reorderMutation.isPending} onClick={() => move(row.original, 1)} size="icon" variant="outline"><ArrowDown className="h-4 w-4" /></Button>
      <Button disabled={!canManage} onClick={() => toggleMutation.mutate(row.original)} size="sm" variant="outline">{row.original.isActive ? "Deactivate" : "Activate"}</Button>
      <Button disabled={!canManage} onClick={() => edit(row.original)} size="icon" variant="outline"><Pencil className="h-4 w-4" /></Button>
      <Button disabled={!canManage || row.original.referenceCount > 0} onClick={() => { if (window.confirm(`Delete ${row.original.nameUz}?`)) deleteMutation.mutate(row.original.id); }} size="icon" variant="outline" title={row.original.referenceCount ? "Referenced categories must be deactivated" : "Delete"}><Trash2 className="h-4 w-4" /></Button>
    </div>; } }
  ];
  const PreviewIcon = resolveCategoryIcon(draft.iconKey);

  return <div className="space-y-6">
    {message ? <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">{message}</div> : null}
    {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
    {canManage ? <Card><CardHeader><CardTitle>{editingId ? "Edit category" : "Create category"}</CardTitle></CardHeader><CardContent>
      <form className="grid gap-4 md:grid-cols-3" onSubmit={submit}>
        <label className="space-y-1 text-sm">Slug<Input disabled={Boolean(editingId)} onChange={(e) => setDraft((v) => ({ ...v, slug: e.target.value }))} required value={draft.slug} /></label>
        <label className="space-y-1 text-sm">Name UZ<Input onChange={(e) => setDraft((v) => ({ ...v, nameUz: e.target.value }))} required value={draft.nameUz} /></label>
        <label className="space-y-1 text-sm">Name RU<Input onChange={(e) => setDraft((v) => ({ ...v, nameRu: e.target.value }))} required value={draft.nameRu} /></label>
        <label className="space-y-1 text-sm">Name EN<Input onChange={(e) => setDraft((v) => ({ ...v, nameEn: e.target.value }))} required value={draft.nameEn} /></label>
        <label className="space-y-1 text-sm">Icon<div className="flex gap-2"><select className="h-10 flex-1 rounded-md border bg-card px-3 text-sm" onChange={(e) => setDraft((v) => ({ ...v, iconKey: e.target.value }))} value={draft.iconKey}>{data.iconKeys.map((key) => <option key={key} value={key}>{key}</option>)}</select><div className="flex h-10 w-10 items-center justify-center rounded-md border"><PreviewIcon className="h-5 w-5" /></div></div></label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm"><input checked={draft.isActive} onChange={(e) => setDraft((v) => ({ ...v, isActive: e.target.checked }))} type="checkbox" />Active</label>
        <div className="flex gap-2 md:col-span-3"><Button disabled={saveMutation.isPending} type="submit">{editingId ? "Save" : "Create"}</Button>{editingId ? <Button onClick={() => { setEditingId(null); setDraft(emptyDraft); }} type="button" variant="outline">Cancel</Button> : null}</div>
      </form>
    </CardContent></Card> : null}
    <DataTable columns={columns} data={categories} emptyDescription="Create the first category." emptyTitle="No categories" />
  </div>;
}
