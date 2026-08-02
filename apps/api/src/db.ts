import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from './generated/prisma/client.js';

export function createDatabase(databaseUrl: string) {
  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  return {
    prisma,
    close: async () => {
      await prisma.$disconnect();
      await pool.end();
    },
  };
}
