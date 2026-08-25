type AddressDtoSource = {
  id: string;
  label: string;
  cityId: string;
  district: string | null;
  addressText: string;
  lat: unknown;
  lng: unknown;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function decimalToNumber(value: unknown) {
  return value === null || value === undefined ? null : Number(value);
}

export function toAddressDto(address: AddressDtoSource) {
  return {
    id: address.id,
    title: address.label,
    cityId: address.cityId,
    district: address.district,
    address: address.addressText,
    lat: decimalToNumber(address.lat),
    lng: decimalToNumber(address.lng),
    isDefault: Boolean(address.isDefault),
    createdAt: address.createdAt,
    updatedAt: address.updatedAt
  };
}
