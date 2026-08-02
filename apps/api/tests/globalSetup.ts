import 'dotenv/config';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

function testDatabaseUrl(): URL {
  const value = process.env.TEST_DATABASE_URL;
  if (!value) throw new Error('TEST_DATABASE_URL testlar uchun sozlanishi kerak.');
  const url = new URL(value);
  const databaseName = url.pathname.slice(1);
  if (!databaseName.endsWith('_test')) throw new Error('Test database nomi _test bilan tugashi shart.');
  if (!/^[A-Za-z0-9_]+$/.test(databaseName)) throw new Error('Test database nomi xavfsiz formatda emas.');
  return url;
}

export default async function setup() {
  const target = testDatabaseUrl();
  const databaseName = target.pathname.slice(1);
  const adminUrl = new URL(target);
  adminUrl.pathname = '/postgres';
  adminUrl.search = '';
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
  if (exists.rowCount === 0) await admin.query(`CREATE DATABASE "${databaseName}"`);
  await admin.end();

  const database = new pg.Client({ connectionString: target.toString() });
  await database.connect();
  await database.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  const migrationsPath = path.resolve('prisma/migrations');
  const migrations = (await readdir(migrationsPath, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const migration of migrations) {
    const sql = await readFile(path.join(migrationsPath, migration, 'migration.sql'), 'utf8');
    await database.query(sql);
  }
  await database.end();
}
