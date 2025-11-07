import { mkdirSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

const resultsDir = join(process.cwd(), 'tests-results');
const resultsFile = join(resultsDir, 'tests.txt');

// Create directory if it doesn't exist
try {
  mkdirSync(resultsDir, { recursive: true });
} catch (error) {
  // Directory might already exist, ignore
}

console.log('🧪 Running tests and saving output...');

try {
  // Run tests and capture output
  const output = execSync('cross-env NODE_ENV=test vitest run --coverage --reporter=verbose', {
    encoding: 'utf-8',
    stdio: 'pipe',
  });

  // Save to file
  writeFileSync(resultsFile, output, 'utf-8');
  console.log(`✅ Test results saved to ${resultsFile}`);
} catch (error) {
  // Tests might have failed, but we still want to save the output
  const execError = error as { stdout?: string; stderr?: string; status?: number };
  if (execError.stdout) {
    writeFileSync(resultsFile, execError.stdout, 'utf-8');
  }
  if (execError.stderr) {
    writeFileSync(
      resultsFile,
      (execError.stdout || '') + '\n\nSTDERR:\n' + execError.stderr,
      'utf-8',
    );
  }
  console.log(`✅ Test results saved to ${resultsFile} (tests may have failed)`);
  process.exit(execError.status || 1);
}
