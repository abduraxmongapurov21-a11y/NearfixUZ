import type { PrismaClient } from '../generated/prisma/client.js';
import { normalizePhoneNumber } from '../auth/phone.js';
import type { DiscoveredUser } from './types.js';

function publicUser(user: DiscoveredUser): DiscoveredUser {
  return {
    id: user.id,
    phoneNumber: user.phoneNumber,
    displayName: user.displayName,
    username: user.username,
    avatarUrl: user.avatarUrl,
  };
}

export class UserDiscoveryService {
  constructor(private readonly prisma: PrismaClient) {}

  async search(currentUserId: string, rawQuery: string, limit: number): Promise<DiscoveredUser[]> {
    const query = rawQuery.trim();
    const normalizedPhone = normalizePhoneNumber(query);
    if (normalizedPhone) {
      const user = await this.prisma.user.findFirst({
        where: { id: { not: currentUserId }, phoneNumber: normalizedPhone },
        select: { id: true, phoneNumber: true, displayName: true, username: true, avatarUrl: true },
      });
      return user ? [publicUser(user)] : [];
    }

    const text = query.replace(/^@/, '').toLocaleLowerCase('en-US');
    const users = await this.prisma.user.findMany({
      where: {
        id: { not: currentUserId },
        OR: [
          { displayName: { startsWith: text, mode: 'insensitive' } },
          { username: { startsWith: text, mode: 'insensitive' } },
        ],
      },
      select: { id: true, phoneNumber: true, displayName: true, username: true, avatarUrl: true },
      orderBy: [{ displayName: 'asc' }, { username: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    return users.map(publicUser);
  }
}
