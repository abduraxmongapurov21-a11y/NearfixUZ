import { z } from "zod";

const optionalCoordinate = (minimum: number, maximum: number) =>
  z.preprocess(
    (value) => (value === null || (typeof value === "string" && value.trim() === "") ? undefined : value),
    z.coerce.number().min(minimum).max(maximum).optional()
  );

const addressPayloadShape = z.object({
  title: z.string().min(2).max(60).optional(),
  address: z.string().min(4).max(240).optional(),
  lat: optionalCoordinate(-90, 90),
  lng: optionalCoordinate(-180, 180),
  isDefault: z.boolean().optional(),
  label: z.string().min(2).max(60).optional(),
  cityId: z.string().min(2).max(80).optional(),
  district: z.string().max(80).optional(),
  addressText: z.string().min(4).max(240).optional()
}).superRefine((payload, context) => {
  const hasLatitude = payload.lat !== undefined;
  const hasLongitude = payload.lng !== undefined;
  if (hasLatitude !== hasLongitude) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "lat and lng must be provided together",
      path: hasLatitude ? ["lng"] : ["lat"]
    });
  }
});

export const createAddressSchema = addressPayloadShape
  .refine((payload) => payload.title || payload.label, {
    message: "Address title is required",
    path: ["title"]
  })
  .refine((payload) => payload.address || payload.addressText, {
    message: "Address text is required",
    path: ["address"]
  })
  .transform((payload) => ({
    title: payload.title || payload.label!,
    address: payload.address || payload.addressText!,
    lat: payload.lat,
    lng: payload.lng,
    isDefault: payload.isDefault || false,
    cityId: payload.cityId || "tashkent",
    district: payload.district
  }));

export const updateAddressSchema = addressPayloadShape.transform((payload) => ({
  ...(payload.title || payload.label ? { title: payload.title || payload.label } : {}),
  ...(payload.address || payload.addressText ? { address: payload.address || payload.addressText } : {}),
  ...(payload.lat !== undefined ? { lat: payload.lat } : {}),
  ...(payload.lng !== undefined ? { lng: payload.lng } : {}),
  ...(payload.isDefault !== undefined ? { isDefault: payload.isDefault } : {}),
  ...(payload.cityId !== undefined ? { cityId: payload.cityId } : {}),
  ...(payload.district !== undefined ? { district: payload.district } : {})
}));
