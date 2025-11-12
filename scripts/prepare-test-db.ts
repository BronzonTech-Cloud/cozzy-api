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

// Set DATABASE_URL to test database URL
process.env.DATABASE_URL = testDbUrl;

try {
  // Use db push for test databases (faster, no migration history needed)
  // This ensures the schema matches prisma/schema.prisma exactly
  // --accept-data-loss: allows dropping tables/columns if schema changed
  // --skip-generate: skips Prisma Client generation (already done)
  execSync('prisma db push --accept-data-loss --skip-generate', {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: testDbUrl,
    },
  });
  console.log('✅ Test database prepared successfully');
} catch {
  console.error('❌ Failed to prepare test database');
  console.error('💡 If you see migration errors, try resetting the database:');
  console.error('   bunx prisma migrate reset --force --skip-seed');
  process.exit(1);
}
