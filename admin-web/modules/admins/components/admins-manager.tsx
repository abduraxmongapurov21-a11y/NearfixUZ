"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, LockKeyhole, Pencil, Plus, Save, ShieldCheck, ShieldX, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminLabel } from "@/lib/admin-labels";
import { hasPermission, isSuperAdmin, type AdminPermission } from "@/shared/auth/permissions";
import { DataTable } from "@/shared/components/data-table";
import { useAdminSessionStore } from "@/stores/admin-session-store";
import { useAdmins } from "../hooks/use-admins";
import {
  createAdmin,
  getAdminErrorMessage,
  replaceAdminPermissions,
  resetAdminPassword,
  setAdminEnabled,
  updateAdmin
} from "../services/admins-service";
import type { AdminAccountRole, AdminAccountStatus, ManagedAdmin } from "../types/admin";

type ModalMode = "create" | "edit" | "permissions" | "reset-password";

const permissionGroups: { title: string; permissions: AdminPermission[] }[] = [
  { title: "Tahlil", permissions: ["analytics.read"] },
  { title: "Foydalanuvchilar", permissions: ["users.read", "users.manage"] },
  { title: "Ustalar", permissions: ["workers.read", "workers.manage"] },
  { title: "Buyurtmalar", permissions: ["orders.read", "orders.manage"] },
  { title: "Sharhlar", permissions: ["reviews.read", "reviews.manage"] },
  { title: "Shikoyatlar", permissions: ["reports.read", "reports.manage"] },
  { title: "Yordam", permissions: ["support.read", "support.manage"] },
  { title: "Kontent", permissions: ["content.read", "content.manage"] },
  { title: "Bildirishnomalar", permissions: ["notifications.read", "notifications.manage"] },
  { title: "Amallar tarixi", permissions: ["audit.read"] },
  { title: "Adminlar", permissions: ["admins.read", "admins.manage", "super_admin.manage"] }
];

const permissionLabels: Record<AdminPermission, string> = {
  "analytics.read": "Tahlilni ko'rish",
  "users.read": "Foydalanuvchilarni ko'rish",
  "users.manage": "Foydalanuvchilarni boshqarish",
  "workers.read": "Ustalarni ko'rish",
  "workers.manage": "Ustalarni boshqarish",
  "orders.read": "Buyurtmalarni ko'rish",
  "orders.manage": "Buyurtmalarni boshqarish",
  "reviews.read": "Sharhlarni ko'rish",
  "reviews.manage": "Sharhlarni boshqarish",
  "reports.read": "Shikoyatlarni ko'rish",
  "reports.manage": "Shikoyatlarni boshqarish",
  "support.read": "Murojaatlarni ko'rish",
  "support.manage": "Murojaatlarni boshqarish",
  "content.read": "Kontentni ko'rish",
  "content.manage": "Kontentni boshqarish",
  "notifications.read": "Bildirishnomalarni ko'rish",
  "notifications.manage": "Bildirishnomalarni boshqarish",
  "audit.read": "Amallar tarixini ko'rish",
  "admins.read": "Adminlarni ko'rish",
  "admins.manage": "Adminlarni boshqarish",
  "super_admin.manage": "Bosh adminlarni boshqarish"
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("uz-UZ");
}

function permissionLabel(permission: AdminPermission) {
  return permissionLabels[permission];
}

function validateAdminInput(username: string, password: string, name?: string) {
  const trimmedUsername = username.trim();
  const trimmedName = name?.trim() || "";
  const normalizedPassword = password.toLowerCase();
  const trivialPasswords = new Set(["admin321", "password", "password123", "12345678", "1234567890", "qwerty123"]);

  if (trimmedUsername.length < 3) return "Foydalanuvchi nomi kamida 3 ta belgidan iborat bo'lishi kerak.";
  if (trimmedName && trimmedName.length < 2) return "Ism kamida 2 ta belgidan iborat bo'lishi kerak.";
  if (password.length < 10) return "Vaqtinchalik parol kamida 10 ta belgidan iborat bo'lishi kerak.";
  if (trivialPasswords.has(normalizedPassword)) return "Vaqtinchalik parol juda oddiy.";
  if (normalizedPassword.includes(trimmedUsername.toLowerCase())) {
    return "Vaqtinchalik parol foydalanuvchi nomi bilan bir xil bo'lmasin va uni o'z ichiga olmasin.";
  }

  return null;
}

function Modal({
  children,
  onClose,
  title
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function PermissionList({
  disabled,
  onToggle,
  selected,
  showSuperAdminManage
}: {
  disabled?: boolean;
  onToggle: (permission: AdminPermission) => void;
  selected: AdminPermission[];
  showSuperAdminManage: boolean;
}) {
  return (
    <div className="space-y-3">
      {permissionGroups.map((group) => {
        const permissions = group.permissions.filter(
          (permission) => permission !== "super_admin.manage" || showSuperAdminManage
        );
        if (!permissions.length) return null;

        return (
          <div className="rounded-md border p-3" key={group.title}>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.title}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {permissions.map((permission) => (
                <label className="flex items-center gap-2 text-sm" key={permission}>
                  <input
                    checked={selected.includes(permission)}
                    disabled={disabled}
                    onChange={() => onToggle(permission)}
                    type="checkbox"
                  />
                  {permissionLabel(permission)}
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AdminsManager() {
  const { data = [], isLoading } = useAdmins();
  const queryClient = useQueryClient();
  const session = useAdminSessionStore((state) => state.session);
  const canManageAdmins = isSuperAdmin(session) || hasPermission(session, "admins.manage");
  const canManageSuperAdmins = isSuperAdmin(session);

  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [activeAdmin, setActiveAdmin] = useState<ManagedAdmin | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [createUsername, setCreateUsername] = useState("");
  const [createName, setCreateName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState<AdminAccountRole>("ADMIN");
  const [createPermissions, setCreatePermissions] = useState<AdminPermission[]>([]);

  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<AdminAccountRole>("ADMIN");
  const [editStatus, setEditStatus] = useState<AdminAccountStatus>("ACTIVE");
  const [editPermissions, setEditPermissions] = useState<AdminPermission[]>([]);
  const [resetPasswordValue, setResetPasswordValue] = useState("");

  function clearModalState() {
    setModalMode(null);
    setActiveAdmin(null);
    setCreateUsername("");
    setCreateName("");
    setCreatePassword("");
    setCreateRole("ADMIN");
    setCreatePermissions([]);
    setEditName("");
    setEditRole("ADMIN");
    setEditStatus("ACTIVE");
    setEditPermissions([]);
    setResetPasswordValue("");
  }

  function openCreateModal() {
    setMessage(null);
    setErrorMessage(null);
    clearModalState();
    setModalMode("create");
  }

  function openEditModal(admin: ManagedAdmin) {
    setMessage(null);
    setErrorMessage(null);
    setActiveAdmin(admin);
    setEditName(admin.name || "");
    setEditRole(admin.role);
    setEditStatus(admin.status);
    setModalMode("edit");
  }

  function openPermissionsModal(admin: ManagedAdmin) {
    setMessage(null);
    setErrorMessage(null);
    setActiveAdmin(admin);
    setEditPermissions(admin.permissions);
    setModalMode("permissions");
  }

  function openResetPasswordModal(admin: ManagedAdmin) {
    setMessage(null);
    setErrorMessage(null);
    setActiveAdmin(admin);
    setResetPasswordValue("");
    setModalMode("reset-password");
  }

  async function refreshAdmins() {
    await queryClient.invalidateQueries({ queryKey: ["admins"] });
  }

  const createMutation = useMutation({
    mutationFn: createAdmin,
    onError: (error) => setErrorMessage(getAdminErrorMessage(error, "Admin yaratilmadi.")),
    onSuccess: async () => {
      setMessage("Admin endi foydalanuvchi nomi va paroli bilan tizimga kira oladi.");
      clearModalState();
      await refreshAdmins();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ adminId, input }: { adminId: string; input: Parameters<typeof updateAdmin>[1] }) =>
      updateAdmin(adminId, input),
    onError: (error) => setErrorMessage(getAdminErrorMessage(error, "Admin ma'lumotlari saqlanmadi.")),
    onSuccess: async () => {
      setMessage("Admin ma'lumotlari saqlandi.");
      clearModalState();
      await refreshAdmins();
    }
  });

  const statusMutation = useMutation({
    mutationFn: ({ adminId, enabled }: { adminId: string; enabled: boolean }) => setAdminEnabled(adminId, enabled),
    onError: (error) => setErrorMessage(getAdminErrorMessage(error, "Admin statusi saqlanmadi.")),
    onSuccess: async (admin) => {
      setMessage(admin.status === "ACTIVE" ? "Admin faollashtirildi." : "Admin o'chirildi.");
      await refreshAdmins();
    }
  });

  const permissionsMutation = useMutation({
    mutationFn: ({ adminId, permissions }: { adminId: string; permissions: AdminPermission[] }) =>
      replaceAdminPermissions(adminId, { permissions }),
    onError: (error) => setErrorMessage(getAdminErrorMessage(error, "Ruxsatlar saqlanmadi.")),
    onSuccess: async () => {
      setMessage("Ruxsatlar saqlandi.");
      clearModalState();
      await refreshAdmins();
    }
  });

  const passwordMutation = useMutation({
    mutationFn: ({ adminId, password }: { adminId: string; password: string }) =>
      resetAdminPassword(adminId, { password }),
    onError: (error) => setErrorMessage(getAdminErrorMessage(error, "Parol yangilanmadi.")),
    onSuccess: async () => {
      setMessage("Parol tiklandi. Admin yangi parol bilan qayta kirishi kerak.");
      clearModalState();
      await refreshAdmins();
    }
  });

  function toggleCreatePermission(permission: AdminPermission) {
    setCreatePermissions((current) =>
      current.includes(permission) ? current.filter((item) => item !== permission) : [...current, permission]
    );
  }

  function toggleEditPermission(permission: AdminPermission) {
    setEditPermissions((current) =>
      current.includes(permission) ? current.filter((item) => item !== permission) : [...current, permission]
    );
  }

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateAdminInput(createUsername, createPassword, createName);
    if (validationError) {
      setMessage(null);
      setErrorMessage(validationError);
      return;
    }

    createMutation.mutate({
      username: createUsername.trim(),
      password: createPassword,
      name: createName.trim() || undefined,
      role: createRole,
      permissions: createPermissions
    });
  }

  function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeAdmin) return;

    updateMutation.mutate({
      adminId: activeAdmin.id,
      input: {
        name: editName.trim() || null,
        role: editRole,
        status: editStatus
      }
    });
  }

  function handlePermissionsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeAdmin) return;
    permissionsMutation.mutate({ adminId: activeAdmin.id, permissions: editPermissions });
  }

  function handlePasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeAdmin) return;
    const validationError = validateAdminInput(activeAdmin.username, resetPasswordValue);
    if (validationError) {
      setMessage(null);
      setErrorMessage(validationError);
      return;
    }

    passwordMutation.mutate({ adminId: activeAdmin.id, password: resetPasswordValue });
  }

  function handleToggleStatus(admin: ManagedAdmin) {
    if (admin.status === "ACTIVE" && !window.confirm(`“${admin.username}” admini o'chirilsinmi?`)) return;
    statusMutation.mutate({ adminId: admin.id, enabled: admin.status !== "ACTIVE" });
  }

  const modalTitle =
    modalMode === "create"
      ? "Admin qo'shish"
      : modalMode === "edit"
        ? "Adminni tahrirlash"
        : modalMode === "permissions"
          ? "Ruxsatlarni tahrirlash"
          : "Parolni tiklash";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {data.length} ta admin hisobi
        </div>
        {canManageAdmins ? (
          <Button onClick={openCreateModal} type="button">
            <Plus className="mr-2 h-4 w-4" />
            Admin qo'shish
          </Button>
        ) : null}
      </div>

      {message ? (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {message}
        </div>
      ) : null}
      {errorMessage ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {errorMessage}
        </div>
      ) : null}
      {isLoading ? <div className="rounded-md border bg-card p-4 text-sm">Adminlar yuklanmoqda...</div> : null}

      <DataTable
        columns={[
          {
            accessorKey: "name",
            header: "Ism",
            cell: ({ row }) => <div className="font-medium">{row.original.name || "-"}</div>
          },
          {
            accessorKey: "username",
            header: "Foydalanuvchi nomi",
            cell: ({ row }) => <div className="font-medium">{row.original.username}</div>
          },
          {
            accessorKey: "role",
            header: "Rol",
            cell: ({ row }) => <Badge variant="secondary">{adminLabel(row.original.role)}</Badge>
          },
          {
            accessorKey: "status",
            header: "Holat",
            cell: ({ row }) => (
              <Badge variant={row.original.status === "ACTIVE" ? "success" : "danger"}>
                {row.original.status === "ACTIVE" ? "Faol" : "O'chirilgan"}
              </Badge>
            )
          },
          {
            accessorKey: "permissions",
            header: "Ruxsatlar",
            cell: ({ row }) =>
              row.original.role === "SUPER_ADMIN" ? (
                <Badge>Barcha ruxsatlar</Badge>
              ) : (
                <div className="max-w-56 text-sm text-muted-foreground">
                  {row.original.permissions.length ? `${row.original.permissions.length} ta ruxsat` : "Ruxsatlar yo'q"}
                </div>
              )
          },
          {
            accessorKey: "lastLoginAt",
            header: "Oxirgi kirish",
            cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDate(row.original.lastLoginAt)}</span>
          },
          {
            accessorKey: "createdAt",
            header: "Yaratilgan",
            cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDate(row.original.createdAt)}</span>
          },
          {
            id: "actions",
            header: "Amallar",
            cell: ({ row }) => (
              <div className="flex flex-wrap gap-2">
                {canManageAdmins ? (
                  <>
                    <Button onClick={() => openEditModal(row.original)} size="sm" type="button" variant="outline">
                      <Pencil className="mr-2 h-4 w-4" />
                      Tahrirlash
                    </Button>
                    <Button onClick={() => openPermissionsModal(row.original)} size="sm" type="button" variant="outline">
                      <LockKeyhole className="mr-2 h-4 w-4" />
                      Ruxsatlar
                    </Button>
                    <Button onClick={() => openResetPasswordModal(row.original)} size="sm" type="button" variant="outline">
                      <KeyRound className="mr-2 h-4 w-4" />
                      Parolni tiklash
                    </Button>
                    <Button
                      disabled={statusMutation.isPending}
                      onClick={() => handleToggleStatus(row.original)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {row.original.status === "ACTIVE" ? (
                        <>
                          <ShieldX className="mr-2 h-4 w-4" />
                          O'chirish
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="mr-2 h-4 w-4" />
                          Faollashtirish
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">Faqat ko'rish uchun</span>
                )}
              </div>
            )
          }
        ]}
        data={data}
        emptyDescription="Hali admin hisobi yo'q."
        emptyTitle="Adminlar yo'q"
      />

      {modalMode ? (
        <Modal onClose={clearModalState} title={modalTitle}>
          {modalMode === "create" ? (
            <form className="space-y-4" onSubmit={handleCreate}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Foydalanuvchi nomi</label>
                  <Input autoComplete="username" onChange={(event) => setCreateUsername(event.target.value)} required value={createUsername} />
                </div>
                <div>
                  <label className="text-sm font-medium">Ism</label>
                  <Input onChange={(event) => setCreateName(event.target.value)} value={createName} />
                </div>
                <div>
                  <label className="text-sm font-medium">Vaqtinchalik parol</label>
                  <Input
                    autoComplete="new-password"
                    onChange={(event) => setCreatePassword(event.target.value)}
                    required
                    type="password"
                    value={createPassword}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Rol</label>
                  <select
                    className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                    onChange={(event) => setCreateRole(event.target.value as AdminAccountRole)}
                    value={createRole}
                  >
                    <option value="ADMIN">Admin</option>
                    {canManageSuperAdmins ? <option value="SUPER_ADMIN">Bosh admin</option> : null}
                  </select>
                </div>
              </div>
              <PermissionList
                selected={createPermissions}
                onToggle={toggleCreatePermission}
                showSuperAdminManage={canManageSuperAdmins}
              />
              <div className="flex justify-end gap-2 border-t pt-4">
                <Button onClick={clearModalState} type="button" variant="outline">Bekor qilish</Button>
                <Button disabled={createMutation.isPending || !createUsername || !createPassword} type="submit">
                  {createMutation.isPending ? "Yaratilmoqda..." : "Yaratish"}
                </Button>
              </div>
            </form>
          ) : null}

          {modalMode === "edit" && activeAdmin ? (
            <form className="space-y-4" onSubmit={handleUpdate}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Foydalanuvchi nomi</label>
                  <Input disabled value={activeAdmin.username} />
                </div>
                <div>
                  <label className="text-sm font-medium">Ism</label>
                  <Input onChange={(event) => setEditName(event.target.value)} value={editName} />
                </div>
                <div>
                  <label className="text-sm font-medium">Rol</label>
                  <select
                    className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                    disabled={!canManageSuperAdmins && activeAdmin.role === "SUPER_ADMIN"}
                    onChange={(event) => setEditRole(event.target.value as AdminAccountRole)}
                    value={editRole}
                  >
                    <option value="ADMIN">Admin</option>
                    {canManageSuperAdmins || activeAdmin.role === "SUPER_ADMIN" ? (
                      <option value="SUPER_ADMIN">Bosh admin</option>
                    ) : null}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Holat</label>
                  <select
                    className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                    onChange={(event) => setEditStatus(event.target.value as AdminAccountStatus)}
                    value={editStatus}
                  >
                    <option value="ACTIVE">Faol</option>
                    <option value="DISABLED">O'chirilgan</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t pt-4">
                <Button onClick={clearModalState} type="button" variant="outline">Bekor qilish</Button>
                <Button disabled={updateMutation.isPending} type="submit">
                  <Save className="mr-2 h-4 w-4" />
                  Saqlash
                </Button>
              </div>
            </form>
          ) : null}

          {modalMode === "permissions" && activeAdmin ? (
            activeAdmin.role === "SUPER_ADMIN" ? (
              <div className="space-y-4">
                <Badge>Barcha ruxsatlar</Badge>
                <div className="flex justify-end border-t pt-4">
                  <Button onClick={clearModalState} type="button" variant="outline">Yopish</Button>
                </div>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handlePermissionsSubmit}>
                <PermissionList
                  selected={editPermissions}
                  onToggle={toggleEditPermission}
                  showSuperAdminManage={canManageSuperAdmins}
                />
                <div className="flex justify-end gap-2 border-t pt-4">
                  <Button onClick={clearModalState} type="button" variant="outline">Bekor qilish</Button>
                  <Button disabled={permissionsMutation.isPending} type="submit">
                    <Save className="mr-2 h-4 w-4" />
                    Ruxsatlarni saqlash
                  </Button>
                </div>
              </form>
            )
          ) : null}

          {modalMode === "reset-password" && activeAdmin ? (
            <form className="space-y-4" onSubmit={handlePasswordReset}>
              <div>
                <label className="text-sm font-medium">Yangi vaqtinchalik parol</label>
                <Input
                  autoComplete="new-password"
                  onChange={(event) => setResetPasswordValue(event.target.value)}
                  required
                  type="password"
                  value={resetPasswordValue}
                />
              </div>
              <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
                Admin yangi parol bilan qayta kirishi kerak.
              </div>
              <div className="flex justify-end gap-2 border-t pt-4">
                <Button onClick={clearModalState} type="button" variant="outline">Bekor qilish</Button>
                <Button disabled={passwordMutation.isPending || !resetPasswordValue} type="submit" variant="outline">
                  <KeyRound className="mr-2 h-4 w-4" />
                  Parolni tiklash
                </Button>
              </div>
            </form>
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}
