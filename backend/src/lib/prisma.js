import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { env } from '../config/env.js';

const needsRelaxedSsl =
  env.databaseUrl.includes('render.com')
  || env.databaseUrl.includes('postgres.database.azure.com')
  || env.databaseUrl.includes('azure.com');

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: needsRelaxedSsl ? { rejectUnauthorized: false } : undefined,
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
