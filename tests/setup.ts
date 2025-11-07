import { beforeAll, afterAll } from 'vitest';
import { config } from 'dotenv';

import { prisma } from '../src/config/prisma';

// Load .env file before anything else
config();

// Ensure NODE_ENV is set to test
if (process.env.NODE_ENV !== 'test') {
  process.env.NODE_ENV = 'test';
}

beforeAll(async () => {
  // Verify required environment variables
  if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
    throw new Error('❌ JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set in .env file');
  }

  // Verify test database connection
  const dbUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

  console.log(
    `🔗 Connecting to test database: ${dbUrl?.replace(/:[^:@]+@/, ':****@') || 'using DATABASE_URL'}`,
  );

  try {
    await prisma.$connect();

    console.log('✅ Connected to test database');
  } catch (error) {
    console.error('❌ Failed to connect to test database:', error);

    console.error('💡 Make sure DATABASE_URL_TEST is set in your .env file');
    throw error;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});
