import { execSync } from 'child_process';
import { config } from 'dotenv';

// Load .env file
config();

const testDbUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

if (!testDbUrl) {
  console.error('❌ DATABASE_URL_TEST or DATABASE_URL must be set in .env');
  process.exit(1);
}

console.log(`🔗 Preparing test database: ${testDbUrl.replace(/:[^:@]+@/, ':****@')}`);

// Set DATABASE_URL to test database URL and run migrations
process.env.DATABASE_URL = testDbUrl;

try {
  execSync('prisma migrate deploy', {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: testDbUrl,
    },
  });
  console.log('✅ Test database prepared successfully');
} catch (error) {
  console.error('❌ Failed to prepare test database');
  process.exit(1);
}
