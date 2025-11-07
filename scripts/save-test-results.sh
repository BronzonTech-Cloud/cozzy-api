#!/bin/bash
# Create tests-results directory if it doesn't exist
mkdir -p tests-results

# Run tests and save output to file
cross-env NODE_ENV=test vitest run --coverage --reporter=verbose > tests-results/tests.txt 2>&1

echo "✅ Test results saved to tests-results/tests.txt"

