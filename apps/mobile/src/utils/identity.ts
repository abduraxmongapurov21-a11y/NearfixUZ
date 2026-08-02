import type { UserIdentity } from '../types';

export function identityTitle(identity: UserIdentity): string {
  return identity.displayName?.trim() || identity.phoneNumber;
}

export function identityInitials(identity: UserIdentity): string {
  const name = identity.displayName?.trim();
  if (name) {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toLocaleUpperCase())
      .join('');
  }
  return identity.phoneNumber.replace(/\D/g, '').slice(-2);
}
