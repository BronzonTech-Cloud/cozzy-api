import { execSync } from 'child_process';
import { config } from 'dotenv';

// Load .env file
config();

const testDbUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

if (!testDbUrl) {
  console.error('❌ DATABASE_URL_TEST or DATABASE_URL must be set in .env');
  process.exit(1);
}

console.log(`🌱 Seeding test database: ${testDbUrl.replace(/:[^:@]+@/, ':****@')}`);

// Set DATABASE_URL to test database URL and run seed
process.env.DATABASE_URL = testDbUrl;

try {
  execSync('ts-node prisma/seed.ts', {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: testDbUrl,
    },
  });
  console.log('✅ Test database seeded successfully');
} catch (error) {
  console.error('❌ Failed to seed test database');
  process.exit(1);
}
