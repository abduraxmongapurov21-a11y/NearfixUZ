import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { BannerTargetType, OrderUrgency, UserRole, WorkerAvailabilityStatus, WorkerProfileStatus } from "@prisma/client";
import { prisma } from "../src/db/prisma.js";
import { createApp } from "../src/http/app.js";
import { createCategory, deleteCategory, getActiveCategoriesByIds, listAdminCategories, listPublicCategories, reorderCategories, updateCategory } from "../src/modules/categories/category.service.js";
import { createOrder } from "../src/modules/orders/order.service.js";
import { updateOwnWorkerProfile } from "../src/modules/workers/worker.service.js";

const suffix = Date.now().toString(36);
const phone = `+99888${String(Date.now()).slice(-7)}`;
const clientPhone = `+99887${String(Date.now()).slice(-7)}`;
const aliasPhone = `+99886${String(Date.now()).slice(-7)}`;
let workerId: string | undefined;
let aliasWorkerId: string | undefined;
let referencedCategoryId: string | undefined;
let freeCategoryId: string | undefined;
let bannerId: string | undefined;
let plumbingOriginalName: string | undefined;

try {
  const referenced = await createCategory({ slug: `integration-${suffix}`, nameUz: "Sinov", nameRu: "Тест", nameEn: "Test", iconKey: "grid" });
  const free = await createCategory({ slug: `free-${suffix}`, nameUz: "Erkin", nameRu: "Свободная", nameEn: "Free", iconKey: "wrench" });
  referencedCategoryId = referenced.id;
  freeCategoryId = free.id;
  const plumbing = await prisma.category.findUniqueOrThrow({ where: { slug: "plumbing" } });
  const electric = await prisma.category.findUniqueOrThrow({ where: { slug: "electric" } });
  plumbingOriginalName = plumbing.nameUz;
  const user = await prisma.user.create({ data: { phone, name: "Category Test", role: UserRole.PROVIDER } });
  const worker = await prisma.workerProfile.create({ data: { userId: user.id, status: WorkerProfileStatus.APPROVED, profession: referenced.nameUz, professions: [referenced.nameUz], availability: { create: { status: WorkerAvailabilityStatus.AVAILABLE } } } });
  workerId = worker.id;
  await prisma.workerCategory.create({ data: { workerId: worker.id, categoryId: referenced.id, isPrimary: true } });
  const client = await prisma.user.create({ data: { phone: clientPhone, name: "Category Client", role: UserRole.CLIENT, cityId: "tashkent" } });
  const address = await prisma.address.create({ data: { userId: client.id, label: "Home", cityId: "tashkent", addressText: "Toshkent shahar markazi" } });

  const aliasUser = await prisma.user.create({ data: { phone: aliasPhone, name: "Legacy Alias Worker", role: UserRole.PROVIDER, cityId: "tashkent" } });
  const aliasWorker = await prisma.workerProfile.create({
    data: {
      userId: aliasUser.id,
      status: WorkerProfileStatus.APPROVED,
      profession: "Santexnik",
      professions: ["Santexnik", "Elektrik"],
      experienceYears: 5,
      profileImageUrl: "https://example.com/worker.jpg",
      bio: "Category integration worker",
      basePrice: 100000,
      availability: { create: { status: WorkerAvailabilityStatus.AVAILABLE } },
      categories: {
        create: [
          { categoryId: plumbing.id, sortOrder: 0, isPrimary: true },
          { categoryId: electric.id, sortOrder: 1, isPrimary: false }
        ]
      }
    }
  });
  aliasWorkerId = aliasWorker.id;

  await updateOwnWorkerProfile(aliasUser.id, { profession: "Elektrik" });
  let reconciled = await prisma.workerProfile.findUniqueOrThrow({ where: { id: aliasWorker.id }, include: { categories: { orderBy: { sortOrder: "asc" } } } });
  assert.deepEqual(reconciled.professions, ["Elektrik", "Santexnik"]);
  assert.deepEqual(reconciled.categories.map((item) => item.categoryId), [electric.id, plumbing.id]);

  await updateOwnWorkerProfile(aliasUser.id, { professions: ["Santexnik", "Maxsus xizmat"] });
  reconciled = await prisma.workerProfile.findUniqueOrThrow({ where: { id: aliasWorker.id }, include: { categories: true } });
  assert.equal(reconciled.profession, "Santexnik");
  assert.deepEqual(reconciled.professions, ["Santexnik", "Maxsus xizmat"]);
  assert.deepEqual(reconciled.categories.map((item) => item.categoryId), [plumbing.id]);

  await updateOwnWorkerProfile(aliasUser.id, { categoryIds: [electric.id, plumbing.id] });
  reconciled = await prisma.workerProfile.findUniqueOrThrow({ where: { id: aliasWorker.id }, include: { categories: { orderBy: { sortOrder: "asc" } } } });
  assert.equal(reconciled.profession, "Elektrik");
  assert.deepEqual(reconciled.professions, ["Elektrik", "Santexnik"]);
  assert.deepEqual(reconciled.categories.map((item) => item.categoryId), [electric.id, plumbing.id]);

  await updateCategory(plumbing.id, { nameUz: "Suv ustasi" });
  await updateOwnWorkerProfile(aliasUser.id, { professions: ["Santexnik", "Maxsus xizmat"] });
  const server = createApp().listen(0, "127.0.0.1");
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const addressInfo = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${addressInfo.port}/workers/catalog?cityId=tashkent&profession=Santexnik`);
    assert.equal(response.status, 200);
    const payload = await response.json() as { workers: { id: string }[] };
    assert.equal(payload.workers.some((item) => item.id === aliasWorker.id), true, "renaming must not break released profession filters");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }

  const legacyOrder = await createOrder(
    { id: client.id, phone: client.phone, name: client.name, role: "client", sessionId: "legacy-category-test", permissions: [], sessionVersion: client.sessionVersion },
    { workerId: aliasWorker.id, addressId: address.id, cityId: "tashkent", serviceType: "Santexnik", problemTitle: "Legacy alias order", urgency: OrderUrgency.FAST }
  );
  assert.equal(legacyOrder.categoryId, plumbing.id, "legacy serviceType must resolve after rename");
  const order = await createOrder(
    { id: client.id, phone: client.phone, name: client.name, role: "client", sessionId: "category-test", permissions: [], sessionVersion: client.sessionVersion },
    { workerId: worker.id, addressId: address.id, cityId: "tashkent", categoryId: referenced.id, problemTitle: "Category order test", urgency: OrderUrgency.FAST }
  );
  assert.equal(order.categoryId, referenced.id);
  assert.equal(order.serviceType, referenced.nameUz);

  await assert.rejects(() => deleteCategory(referenced.id), (error: any) => error?.code === "CATEGORY_IN_USE" && error?.status === 409);
  await updateCategory(referenced.id, { isActive: false });
  assert.equal((await listPublicCategories()).some((category) => category.id === referenced.id), false);
  await assert.rejects(() => getActiveCategoriesByIds([referenced.id]), (error: any) => error?.code === "CATEGORY_INACTIVE_OR_NOT_FOUND");

  const allCategories = await listAdminCategories();
  const forward = allCategories.map((category, sortOrder) => ({ id: category.id, sortOrder }));
  const reverse = [...allCategories].reverse().map((category, sortOrder) => ({ id: category.id, sortOrder }));
  await Promise.all([reorderCategories(forward), reorderCategories(reverse)]);
  const reordered = await listAdminCategories();
  assert.deepEqual(reordered.map((category) => category.sortOrder), reordered.map((_, index) => index));
  await assert.rejects(
    () => reorderCategories([...forward.slice(0, -1), { id: forward[0].id, sortOrder: forward.length - 1 }]),
    (error: any) => error?.code === "CATEGORY_REORDER_INVALID"
  );

  const banner = await prisma.banner.create({
    data: { title: "Legacy category banner", imageUrl: "https://example.com/banner.jpg", targetType: BannerTargetType.CATEGORY, targetValue: free.slug }
  });
  bannerId = banner.id;
  const freeWithReferences = (await listAdminCategories()).find((category) => category.id === free.id)!;
  assert.equal(freeWithReferences.bannerReferenceCount, 1);
  await assert.rejects(() => deleteCategory(free.id), (error: any) => error?.code === "CATEGORY_IN_USE" && error?.status === 409);
  await prisma.banner.delete({ where: { id: banner.id } });
  bannerId = undefined;
  await deleteCategory(free.id);
  freeCategoryId = undefined;
  assert.equal(await prisma.category.findUnique({ where: { id: free.id } }), null);
  console.log("Category DB integration tests passed.");
} finally {
  if (bannerId) await prisma.banner.deleteMany({ where: { id: bannerId } });
  await prisma.order.deleteMany({ where: { client: { phone: clientPhone } } });
  if (aliasWorkerId) await prisma.workerAvailability.deleteMany({ where: { workerId: aliasWorkerId } });
  if (aliasWorkerId) await prisma.workerCategory.deleteMany({ where: { workerId: aliasWorkerId } });
  if (aliasWorkerId) await prisma.workerProfile.deleteMany({ where: { id: aliasWorkerId } });
  if (workerId) await prisma.workerAvailability.deleteMany({ where: { workerId } });
  if (workerId) await prisma.workerCategory.deleteMany({ where: { workerId } });
  if (workerId) await prisma.workerProfile.deleteMany({ where: { id: workerId } });
  await prisma.address.deleteMany({ where: { user: { phone: clientPhone } } });
  await prisma.user.deleteMany({ where: { phone: { in: [phone, clientPhone, aliasPhone] } } });
  if (plumbingOriginalName) await prisma.category.updateMany({ where: { slug: "plumbing" }, data: { nameUz: plumbingOriginalName } });
  if (referencedCategoryId) await prisma.category.deleteMany({ where: { id: referencedCategoryId } });
  if (freeCategoryId) await prisma.category.deleteMany({ where: { id: freeCategoryId } });
  await prisma.$disconnect();
}
