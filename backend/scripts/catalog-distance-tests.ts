import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { PrismaClient, UserRole, WorkerAvailabilityStatus, WorkerProfileStatus } from "@prisma/client";
import { prisma } from "../src/db/prisma.js";
import { createApp } from "../src/http/app.js";
import { createAccessToken } from "../src/modules/auth/session.js";
import { promoteProviderSchema } from "../src/modules/admin/admin.contracts.js";
import { haversineDistanceMeters } from "../src/modules/workers/distance.js";

const suffix = String(Date.now()).slice(-7);
const cityId = `distance-test-${suffix}`;
const profession = `Distance Test ${suffix}`;
const phones = [
  `+99895${suffix}`,
  `+99896${suffix}`,
  `+99897${suffix}`,
  `+99898${suffix}`,
  `+99899${suffix}`,
  `+99894${suffix}`
];

async function cleanup() {
  await prisma.user.deleteMany({ where: { phone: { in: phones } } });
}

async function accessTokenFor(user: { id: string; sessionVersion: number }) {
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken: `catalog-distance-${suffix}-${user.id}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    }
  });

  return createAccessToken({
    userId: user.id,
    sessionId: session.id,
    sessionVersion: user.sessionVersion
  });
}

async function main() {
  assert.equal(haversineDistanceMeters({ lat: 41.311081, lng: 69.240562 }, { lat: 41.311081, lng: 69.240562 }), 0);
  const oneDegreeAtEquator = haversineDistanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
  assert.ok(Number.isInteger(oneDegreeAtEquator));
  assert.ok(oneDegreeAtEquator >= 111_100 && oneDegreeAtEquator <= 111_300);
  assert.throws(
    () => haversineDistanceMeters({ lat: Number.NaN, lng: 0 }, { lat: 0, lng: 0 }),
    RangeError
  );
  assert.throws(
    () => haversineDistanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: Number.POSITIVE_INFINITY }),
    RangeError
  );
  assert.equal(promoteProviderSchema.safeParse({ serviceLat: 41.3 }).success, false);
  assert.equal(promoteProviderSchema.safeParse({ serviceLat: 41.3, serviceLng: 69.2 }).success, true);

  await cleanup();

  const [client, otherClient, locatedProvider, unlocatedProvider, fartherProvider, draftProvider] = await Promise.all([
    prisma.user.create({ data: { phone: phones[0], name: "Distance Client", role: UserRole.CLIENT, cityId } }),
    prisma.user.create({ data: { phone: phones[1], name: "Other Client", role: UserRole.CLIENT, cityId } }),
    prisma.user.create({ data: { phone: phones[2], name: "Located Provider", role: UserRole.PROVIDER, cityId } }),
    prisma.user.create({ data: { phone: phones[3], name: "Unlocated Provider", role: UserRole.PROVIDER, cityId } }),
    prisma.user.create({ data: { phone: phones[4], name: "Farther Provider", role: UserRole.PROVIDER, cityId } }),
    prisma.user.create({ data: { phone: phones[5], name: "Draft Provider", role: UserRole.PROVIDER, cityId } })
  ]);

  const initialLocationTimestamp = new Date(Date.now() - 1000);
  const [locatedWorker, unlocatedWorker, fartherWorker] = await Promise.all([
    prisma.workerProfile.create({
      data: {
        userId: locatedProvider.id,
        status: WorkerProfileStatus.APPROVED,
        profession,
        professions: [profession],
        experienceYears: 5,
        profileImageUrl: "https://example.com/located-worker.png",
        bio: "Located worker profile for catalog distance integration tests.",
        basePrice: 100_000,
        ratingAvg: 4.9,
        serviceLat: 41.3205,
        serviceLng: 69.251,
        serviceLocationUpdatedAt: initialLocationTimestamp
      }
    }),
    prisma.workerProfile.create({
      data: {
        userId: unlocatedProvider.id,
        status: WorkerProfileStatus.APPROVED,
        profession,
        professions: [profession],
        experienceYears: 4,
        profileImageUrl: "https://example.com/unlocated-worker.png",
        bio: "Unlocated worker profile for catalog distance integration tests.",
        basePrice: 90_000,
        ratingAvg: 4.7
      }
    }),
    prisma.workerProfile.create({
      data: {
        userId: fartherProvider.id,
        status: WorkerProfileStatus.APPROVED,
        profession,
        professions: [profession],
        experienceYears: 8,
        profileImageUrl: "https://example.com/farther-worker.png",
        bio: "Farther worker with a higher rating for global nearest sorting tests.",
        basePrice: 80_000,
        ratingAvg: 5,
        serviceLat: 41.4,
        serviceLng: 69.35,
        serviceLocationUpdatedAt: initialLocationTimestamp
      }
    })
  ]);

  const draftWorker = await prisma.workerProfile.create({
    data: {
      userId: draftProvider.id,
      status: WorkerProfileStatus.DRAFT,
      profession: "Draft profession",
      professions: ["Draft profession"],
      moderationReason: "Preserve this moderation note"
    }
  });

  await Promise.all([
    prisma.workerAvailability.create({
      data: { workerId: locatedWorker.id, status: WorkerAvailabilityStatus.AVAILABLE }
    }),
    prisma.workerAvailability.create({
      data: { workerId: unlocatedWorker.id, status: WorkerAvailabilityStatus.AVAILABLE }
    }),
    prisma.workerAvailability.create({
      data: { workerId: fartherWorker.id, status: WorkerAvailabilityStatus.AVAILABLE }
    })
  ]);

  const [originAddress, otherAddress, addressWithoutCoordinates, addressWithInvalidCoordinates] = await Promise.all([
    prisma.address.create({
      data: {
        userId: client.id,
        label: "Origin",
        cityId,
        addressText: "Distance test origin",
        lat: 41.311081,
        lng: 69.240562
      }
    }),
    prisma.address.create({
      data: {
        userId: otherClient.id,
        label: "Other origin",
        cityId,
        addressText: "Other client address",
        lat: 41.315,
        lng: 69.245
      }
    }),
    prisma.address.create({
      data: {
        userId: client.id,
        label: "No coordinates",
        cityId,
        addressText: "Address without coordinates"
      }
    }),
    prisma.address.create({
      data: {
        userId: client.id,
        label: "Invalid persisted coordinates",
        cityId,
        addressText: "Invalid persisted origin",
        lat: 91,
        lng: 69.24
      }
    })
  ]);

  const [clientToken, providerToken, draftProviderToken] = await Promise.all([
    accessTokenFor(client),
    accessTokenFor(locatedProvider),
    accessTokenFor(draftProvider)
  ]);

  const server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  async function request(path: string, options: { token?: string; method?: string; body?: unknown } = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method,
      headers: {
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...(options.body ? { "Content-Type": "application/json" } : {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  }

  try {
    const catalogQuery = `cityId=${encodeURIComponent(cityId)}&profession=${encodeURIComponent(profession)}`;
    const existingCatalog = await request(`/workers/catalog?${catalogQuery}`);
    assert.equal(existingCatalog.response.status, 200);
    assert.equal(existingCatalog.payload.workers.length, 3);
    assert.equal(existingCatalog.payload.workers[0].id, fartherWorker.id);
    assert.ok(existingCatalog.payload.workers.every((worker: any) => worker.distanceMeters === null));

    const filteredCatalog = await request(
      `/workers/catalog?cityId=${encodeURIComponent(cityId)}&profession=${encodeURIComponent("Different profession")}`
    );
    assert.equal(filteredCatalog.response.status, 200);
    assert.equal(filteredCatalog.payload.workers.length, 0);

    const ignoredPagination = await request(`/workers/catalog?${catalogQuery}&limit=1&page=2`);
    assert.equal(ignoredPagination.response.status, 200);
    assert.equal(ignoredPagination.payload.workers.length, 3);

    const catalogWithDistance = await request(
      `/workers/catalog?${catalogQuery}&originAddressId=${encodeURIComponent(originAddress.id)}`,
      { token: clientToken }
    );
    assert.equal(catalogWithDistance.response.status, 200);
    const locatedResult = catalogWithDistance.payload.workers.find((worker: any) => worker.id === locatedWorker.id);
    const unlocatedResult = catalogWithDistance.payload.workers.find((worker: any) => worker.id === unlocatedWorker.id);
    assert.ok(Number.isInteger(locatedResult.distanceMeters));
    assert.ok(locatedResult.distanceMeters > 0);
    assert.equal(unlocatedResult.distanceMeters, null);
    for (const worker of catalogWithDistance.payload.workers) {
      assert.equal("serviceLat" in worker, false);
      assert.equal("serviceLng" in worker, false);
      assert.equal("serviceLocationUpdatedAt" in worker, false);
    }

    const nearestCatalog = await request(
      `/workers/catalog?${catalogQuery}&originAddressId=${encodeURIComponent(originAddress.id)}&sort=nearest`,
      { token: clientToken }
    );
    assert.equal(nearestCatalog.response.status, 200);
    assert.deepEqual(
      nearestCatalog.payload.workers.map((worker: any) => worker.id),
      [locatedWorker.id, fartherWorker.id, unlocatedWorker.id]
    );
    assert.ok(nearestCatalog.payload.workers[0].distanceMeters < nearestCatalog.payload.workers[1].distanceMeters);
    assert.equal(nearestCatalog.payload.workers[2].distanceMeters, null);

    const nearestWithIgnoredPagination = await request(
      `/workers/catalog?${catalogQuery}&originAddressId=${encodeURIComponent(originAddress.id)}&sort=nearest&limit=1&page=2`,
      { token: clientToken }
    );
    assert.deepEqual(
      nearestWithIgnoredPagination.payload.workers.map((worker: any) => worker.id),
      [locatedWorker.id, fartherWorker.id, unlocatedWorker.id]
    );

    const nearestWithoutOrigin = await request(`/workers/catalog?${catalogQuery}&sort=nearest`);
    assert.equal(nearestWithoutOrigin.response.status, 400);
    assert.equal(nearestWithoutOrigin.payload.code, "ORIGIN_ADDRESS_REQUIRED_FOR_NEAREST");

    const firstDefault = await request("/addresses", {
      token: clientToken,
      method: "POST",
      body: { title: "Default one", address: "First default", lat: 41.31, lng: 69.24, isDefault: true }
    });
    assert.equal(firstDefault.response.status, 201);
    assert.equal(firstDefault.payload.address.isDefault, true);

    const secondDefault = await request("/addresses", {
      token: clientToken,
      method: "POST",
      body: { title: "Default two", address: "Second default", lat: 41.32, lng: 69.25, isDefault: true }
    });
    assert.equal(secondDefault.response.status, 201);
    const addressList = await request("/addresses", { token: clientToken });
    assert.equal(addressList.response.status, 200);
    assert.deepEqual(
      addressList.payload.addresses.filter((item: any) => item.isDefault).map((item: any) => item.id),
      [secondDefault.payload.address.id]
    );

    const invalidAddressLatitude = await request("/addresses", {
      token: clientToken,
      method: "POST",
      body: { title: "Invalid", address: "Invalid", lat: 90.1, lng: 69.24 }
    });
    assert.equal(invalidAddressLatitude.response.status, 400);

    const invalidAddressLongitude = await request("/addresses", {
      token: clientToken,
      method: "POST",
      body: { title: "Invalid", address: "Invalid", lat: 41.31, lng: 181 }
    });
    assert.equal(invalidAddressLongitude.response.status, 400);

    const addressLatitudeOnly = await request("/addresses", {
      token: clientToken,
      method: "POST",
      body: { title: "Invalid pair", address: "Invalid pair", lat: 41.31 }
    });
    assert.equal(addressLatitudeOnly.response.status, 400);

    const updateAddressLatitudeOnly = await request(`/addresses/${originAddress.id}`, {
      token: clientToken,
      method: "PATCH",
      body: { lat: 41.32 }
    });
    assert.equal(updateAddressLatitudeOnly.response.status, 400);

    const updateAddressOutOfRange = await request(`/addresses/${originAddress.id}`, {
      token: clientToken,
      method: "PATCH",
      body: { lat: 41.32, lng: 181 }
    });
    assert.equal(updateAddressOutOfRange.response.status, 400);

    const unauthenticatedOrigin = await request(
      `/workers/catalog?${catalogQuery}&originAddressId=${encodeURIComponent(originAddress.id)}`
    );
    assert.equal(unauthenticatedOrigin.response.status, 401);

    const foreignAddress = await request(
      `/workers/catalog?${catalogQuery}&originAddressId=${encodeURIComponent(otherAddress.id)}`,
      { token: clientToken }
    );
    assert.equal(foreignAddress.response.status, 403);
    assert.equal(foreignAddress.payload.code, "ADDRESS_ACCESS_DENIED");

    const missingAddress = await request(`/workers/catalog?${catalogQuery}&originAddressId=missing-${suffix}`, {
      token: clientToken
    });
    assert.equal(missingAddress.response.status, 404);
    assert.equal(missingAddress.payload.code, "ADDRESS_NOT_FOUND");

    const missingCoordinates = await request(
      `/workers/catalog?${catalogQuery}&originAddressId=${encodeURIComponent(addressWithoutCoordinates.id)}`,
      { token: clientToken }
    );
    assert.equal(missingCoordinates.response.status, 400);
    assert.equal(missingCoordinates.payload.code, "ADDRESS_COORDINATES_REQUIRED");

    const invalidPersistedCoordinates = await request(
      `/workers/catalog?${catalogQuery}&originAddressId=${encodeURIComponent(addressWithInvalidCoordinates.id)}`,
      { token: clientToken }
    );
    assert.equal(invalidPersistedCoordinates.response.status, 400);
    assert.equal(invalidPersistedCoordinates.payload.code, "ORIGIN_COORDINATES_INVALID");

    const invalidLatitude = await request("/workers/me/profile", {
      token: providerToken,
      method: "PATCH",
      body: { serviceLat: 90.1, serviceLng: 69.24 }
    });
    assert.equal(invalidLatitude.response.status, 400);
    assert.equal(invalidLatitude.payload.code, "VALIDATION_ERROR");

    const invalidLongitude = await request("/workers/me/profile", {
      token: providerToken,
      method: "PATCH",
      body: { serviceLat: 41.31, serviceLng: 180.1 }
    });
    assert.equal(invalidLongitude.response.status, 400);

    const latitudeOnly = await request("/workers/me/profile", {
      token: providerToken,
      method: "PATCH",
      body: { serviceLat: 41.31 }
    });
    assert.equal(latitudeOnly.response.status, 400);

    const longitudeOnly = await request("/workers/me/profile", {
      token: providerToken,
      method: "PATCH",
      body: { serviceLng: 69.24 }
    });
    assert.equal(longitudeOnly.response.status, 400);

    const clientLocationUpdate = await request("/workers/me/profile", {
      token: clientToken,
      method: "PATCH",
      body: { serviceLat: 41.31, serviceLng: 69.24 }
    });
    assert.equal(clientLocationUpdate.response.status, 403);

    const defaultWorkerResult = await prisma.workerProfile.findUniqueOrThrow({ where: { id: locatedWorker.id } });
    assert.equal("serviceLat" in defaultWorkerResult, false);
    assert.equal("serviceLng" in defaultWorkerResult, false);

    const validLocationUpdate = await request("/workers/me/service-location", {
      token: providerToken,
      method: "PATCH",
      body: { serviceLat: 41.312, serviceLng: 69.242 }
    });
    assert.equal(validLocationUpdate.response.status, 200);
    assert.equal(Number(validLocationUpdate.payload.worker.serviceLat), 41.312);
    assert.equal(Number(validLocationUpdate.payload.worker.serviceLng), 69.242);
    const updatedWorker = await prisma.workerProfile.findUniqueOrThrow({
      where: { id: locatedWorker.id },
      omit: { serviceLat: false, serviceLng: false, serviceLocationUpdatedAt: false }
    });
    assert.equal(Number(updatedWorker.serviceLat), 41.312);
    assert.equal(Number(updatedWorker.serviceLng), 69.242);
    assert.ok(updatedWorker.serviceLocationUpdatedAt);
    assert.ok(updatedWorker.serviceLocationUpdatedAt!.getTime() > initialLocationTimestamp.getTime());

    const draftBeforeLocation = await prisma.workerProfile.findUniqueOrThrow({ where: { id: draftWorker.id } });
    const draftLocationUpdate = await request("/workers/me/service-location", {
      token: draftProviderToken,
      method: "PATCH",
      body: { serviceLat: 41.313, serviceLng: 69.243 }
    });
    assert.equal(draftLocationUpdate.response.status, 200);
    const draftAfterLocation = await prisma.workerProfile.findUniqueOrThrow({
      where: { id: draftWorker.id },
      omit: { serviceLat: false, serviceLng: false, serviceLocationUpdatedAt: false }
    });
    assert.equal(Number(draftAfterLocation.serviceLat), 41.313);
    assert.equal(Number(draftAfterLocation.serviceLng), 69.243);
    assert.ok(draftAfterLocation.serviceLocationUpdatedAt);
    assert.equal(draftAfterLocation.status, WorkerProfileStatus.DRAFT);
    assert.equal(draftAfterLocation.submittedAt, draftBeforeLocation.submittedAt);
    assert.equal(draftAfterLocation.moderationReason, draftBeforeLocation.moderationReason);

    const clientDedicatedLocationUpdate = await request("/workers/me/service-location", {
      token: clientToken,
      method: "PATCH",
      body: { serviceLat: 41.31, serviceLng: 69.24 }
    });
    assert.equal(clientDedicatedLocationUpdate.response.status, 403);

    const dedicatedLatitudeOnly = await request("/workers/me/service-location", {
      token: draftProviderToken,
      method: "PATCH",
      body: { serviceLat: 41.31 }
    });
    assert.equal(dedicatedLatitudeOnly.response.status, 400);

    const dedicatedOutOfRange = await request("/workers/me/service-location", {
      token: draftProviderToken,
      method: "PATCH",
      body: { serviceLat: -91, serviceLng: 69.24 }
    });
    assert.equal(dedicatedOutOfRange.response.status, 400);

    const quietPrisma = new PrismaClient();
    try {
      await assert.rejects(
        quietPrisma.workerProfile.update({ where: { id: locatedWorker.id }, data: { serviceLng: null } }),
        /constraint|check/i
      );
    } finally {
      await quietPrisma.$disconnect();
    }

    console.log(
      JSON.stringify({
        haversine: "pass",
        catalogDistance: "pass",
        addressOwnership: "pass",
        workerLocationValidation: "pass",
        catalogPrivacy: "pass",
        catalogRegression: "pass",
        nearestGlobalOrdering: "pass",
        addressDefault: "pass",
        persistedOriginDefense: "pass",
        draftLocationModerationIsolation: "pass",
        dedicatedLocationAuthorization: "pass"
      })
    );
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await cleanup();
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await cleanup().catch(() => undefined);
  await prisma.$disconnect();
  process.exitCode = 1;
});
