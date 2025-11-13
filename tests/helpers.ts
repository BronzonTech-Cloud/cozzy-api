import bcrypt from 'bcryptjs';
import type { Express } from 'express';
import request, { type Response } from 'supertest';

import { prisma } from '../src/config/prisma';

// Configurable retry settings via environment variables (useful for CI tuning)
const VERIFICATION_TIMEOUT_MS = parseInt(process.env.TEST_VERIFICATION_TIMEOUT_MS || '30000', 10); // 30 seconds default
const LOGIN_MAX_RETRIES = parseInt(process.env.TEST_LOGIN_MAX_RETRIES || '10', 10);
const CATEGORY_VERIFICATION_MAX_RETRIES = parseInt(
  process.env.TEST_CATEGORY_VERIFICATION_MAX_RETRIES || '15',
  10,
);

/**
 * Helper to create a test user and get their auth token
 * Ensures user exists and login succeeds before returning token
 */
export async function createTestUserAndLogin(
  app: Express,
  email: string,
  role: 'USER' | 'ADMIN' = 'USER',
): Promise<{ user: Awaited<ReturnType<typeof createTestUser>>; token: string }> {
  // Create user first
  const user = await createTestUser(email, role);

  // Verify user was created
  if (!user || !user.id) {
    throw new Error(`Failed to create test user: ${email}`);
  }

  // CRITICAL: Wait for user to be visible in database WITH PASSWORD HASH before attempting login
  // The login endpoint queries by email and requires password hash, so we must ensure both are visible
  // This prevents "User exists: false" and "Invalid credentials" errors in CI
  const visibilityStartTime = Date.now();
  const visibilityTimeoutMs = VERIFICATION_TIMEOUT_MS; // Use same timeout as other verifications (90000ms in CI)
  let userVisibleByEmail = false;
  let userHasPasswordHash = false;
  const maxVisibilityAttempts = 30; // Increased attempts for CI reliability

  // Get password hash from user object (should be set by createTestUser)
  const expectedPasswordHash = user.passwordHash;

  for (let attempt = 0; attempt < maxVisibilityAttempts; attempt++) {
    // Check timeout
    if (Date.now() - visibilityStartTime > visibilityTimeoutMs) {
      break;
    }

    if (attempt > 0) {
      // Exponential backoff: 200ms, 400ms, 600ms, etc. (increased for CI)
      await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
    }

    // Force connection refresh before each check
    await prisma.$executeRaw`SELECT 1`;

    try {
      // CRITICAL: Use regular queries (not transactions) for verification
      // This matches how the actual application queries work (login endpoint doesn't use transactions)

      // Strategy 1: Try Prisma findUnique by email (same as login endpoint)
      const prismaEmailCheck = await prisma.user.findUnique({
        where: { email },
      });
      if (prismaEmailCheck && prismaEmailCheck.id === user.id) {
        userVisibleByEmail = true;
        if (prismaEmailCheck.passwordHash) {
          userHasPasswordHash = true;
          break;
        } else {
          // Password hash missing - try to update it
          const hashToUse = expectedPasswordHash || (await bcrypt.hash('password123', 10));
          await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: hashToUse },
          });
          // Small delay after update
          await new Promise((resolve) => setTimeout(resolve, 200));
          // Re-check after update
          const recheck = await prisma.user.findUnique({
            where: { email },
          });
          if (recheck && recheck.passwordHash) {
            userHasPasswordHash = true;
            break;
          }
        }
      }

      // Strategy 2: Try raw SQL query by email (bypasses some caching)
      if (!userVisibleByEmail || !userHasPasswordHash) {
        const emailCheck = await prisma.$queryRaw<
          Array<{ id: string; email: string; passwordHash: string | null }>
        >`
          SELECT id, email, "passwordHash" FROM "User" WHERE email = ${email} LIMIT 1
        `;

        if (emailCheck && emailCheck.length > 0 && emailCheck[0].id === user.id) {
          userVisibleByEmail = true;
          // CRITICAL: Also check password hash is present
          if (emailCheck[0].passwordHash) {
            userHasPasswordHash = true;
            break;
          } else {
            // Password hash missing - try to update it
            const hashToUse = expectedPasswordHash || (await bcrypt.hash('password123', 10));
            await prisma.$executeRaw`
              UPDATE "User" SET "passwordHash" = ${hashToUse} WHERE id = ${user.id}
            `;
            // Small delay after update
            await new Promise((resolve) => setTimeout(resolve, 200));
            // Re-check after update
            const recheck = await prisma.$queryRaw<
              Array<{ id: string; email: string; passwordHash: string | null }>
            >`
              SELECT id, email, "passwordHash" FROM "User" WHERE email = ${email} LIMIT 1
            `;
            if (recheck && recheck.length > 0 && recheck[0].passwordHash) {
              userHasPasswordHash = true;
              break;
            }
          }
        }
      }
    } catch {
      // Continue to next attempt
    }
  }

  // If user still not visible or password hash missing, add extra delay and try one more time
  // CRITICAL: Throw error if still not visible before attempting login to avoid wasted retries
  if (!userVisibleByEmail || !userHasPasswordHash) {
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Force connection refresh
    await prisma.$executeRaw`SELECT 1`;

    // Final check and update if needed - try all strategies using regular queries
    let finalCheckPassed = false;
    try {
      // Strategy 1: Try Prisma findUnique by email
      const finalPrismaCheck = await prisma.user.findUnique({
        where: { email },
      });
      if (finalPrismaCheck && finalPrismaCheck.id === user.id) {
        userVisibleByEmail = true;
        if (finalPrismaCheck.passwordHash) {
          userHasPasswordHash = true;
          finalCheckPassed = true;
        } else {
          // Update password hash one more time
          const hashToUse = expectedPasswordHash || (await bcrypt.hash('password123', 10));
          await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: hashToUse },
          });
          // Small delay after update
          await new Promise((resolve) => setTimeout(resolve, 300));
          // Re-check after update
          const recheck = await prisma.user.findUnique({
            where: { email },
          });
          if (recheck && recheck.passwordHash) {
            userHasPasswordHash = true;
            finalCheckPassed = true;
          }
        }
      }

      // Strategy 2: Try raw SQL if Prisma didn't work
      if (!finalCheckPassed) {
        const finalEmailCheck = await prisma.$queryRaw<
          Array<{ id: string; email: string; passwordHash: string | null }>
        >`
          SELECT id, email, "passwordHash" FROM "User" WHERE email = ${email} LIMIT 1
        `;

        if (finalEmailCheck && finalEmailCheck.length > 0 && finalEmailCheck[0].id === user.id) {
          userVisibleByEmail = true;
          if (finalEmailCheck[0].passwordHash) {
            userHasPasswordHash = true;
            finalCheckPassed = true;
          } else {
            // Update password hash one more time
            const hashToUse = expectedPasswordHash || (await bcrypt.hash('password123', 10));
            await prisma.$executeRaw`
              UPDATE "User" SET "passwordHash" = ${hashToUse} WHERE id = ${user.id}
            `;
            // Small delay after update
            await new Promise((resolve) => setTimeout(resolve, 300));
            // Re-check after update
            const recheck = await prisma.$queryRaw<
              Array<{ id: string; email: string; passwordHash: string | null }>
            >`
              SELECT id, email, "passwordHash" FROM "User" WHERE email = ${email} LIMIT 1
            `;
            if (recheck && recheck.length > 0 && recheck[0].passwordHash) {
              userHasPasswordHash = true;
              finalCheckPassed = true;
            }
          }
        }
      }
    } catch {
      // Will throw error below
    }

    // CRITICAL: Throw error if user is not visible before login attempts
    // This prevents wasting time on login retries that will fail
    if (!finalCheckPassed) {
      throw new Error(
        `createTestUserAndLogin failed: User ${email} (ID: ${user.id}) is not visible or missing password hash before login. ` +
          `Visible by email: ${userVisibleByEmail}, Has password hash: ${userHasPasswordHash}. ` +
          `This indicates a database visibility issue that must be fixed in the helper.`,
      );
    }
  }

  // Retry login with exponential backoff (handles timing issues in CI)
  // Add timeout to prevent infinite loops
  const loginStartTime = Date.now();
  const loginTimeoutMs = VERIFICATION_TIMEOUT_MS; // Use same timeout as verification
  let loginRes: Response | null = null;
  const loginMaxRetries = LOGIN_MAX_RETRIES;

  for (let attempt = 0; attempt < loginMaxRetries; attempt++) {
    // Check timeout
    if (Date.now() - loginStartTime > loginTimeoutMs) {
      throw new Error(`Login timeout after ${loginTimeoutMs}ms for ${email}`);
    }
    if (attempt > 0) {
      // Exponential backoff: 200ms, 400ms, 600ms, 800ms, 1000ms, etc. (increased for CI)
      await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
    }

    loginRes = await request(app).post('/api/v1/auth/login').send({
      email,
      password: 'password123',
    });

    if (loginRes.status === 200 && loginRes.body.accessToken) {
      break;
    }
  }

  // Verify login succeeded
  if (!loginRes || loginRes.status !== 200) {
    // Additional debugging: check if user exists using raw query (by email, same as login)
    const debugResult = await prisma.$queryRaw<
      Array<{ id: string; email: string; passwordHash: string | null }>
    >`
      SELECT id, email, "passwordHash" FROM "User" WHERE email = ${email} LIMIT 1
    `;
    const debugUser = debugResult && debugResult.length > 0 ? debugResult[0] : null;

    // More detailed error message
    const errorDetails = {
      status: loginRes?.status || 'no response',
      body: loginRes?.body || {},
      userExists: !!debugUser,
      userId: user.id,
      userEmail: email,
      userHasPassword: !!debugUser?.passwordHash,
      userVisibleByEmail: userVisibleByEmail,
      userHasPasswordHash: userHasPasswordHash,
    };

    throw new Error(
      `Login failed for ${email}: ${loginRes?.status || 'no response'} - ${JSON.stringify(loginRes?.body || {})}. Debug: ${JSON.stringify(errorDetails)}`,
    );
  }

  if (!loginRes.body.accessToken) {
    throw new Error(`No access token in login response for ${email}`);
  }

  // Final verification: ensure user is visible in database before returning
  // This prevents 404 errors in controllers that do user lookups
  // CRITICAL: This function MUST guarantee visibility - throw error if not visible
  const finalVerificationStartTime = Date.now();
  const finalVerificationTimeoutMs = 10000; // 10 seconds for final verification
  const finalVerificationMaxAttempts = 20; // More attempts for reliability
  let finalUserCheck = false;

  for (let attempt = 0; attempt < finalVerificationMaxAttempts; attempt++) {
    // Check timeout
    if (Date.now() - finalVerificationStartTime > finalVerificationTimeoutMs) {
      break;
    }

    if (attempt > 0) {
      // Exponential backoff: 200ms, 400ms, 600ms, etc. (increased for CI)
      await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
    }

    // Force connection refresh before each check
    await prisma.$executeRaw`SELECT 1`;

    try {
      // CRITICAL: Use regular queries (not transactions) for verification
      // This matches how the actual application queries work

      // Strategy 1: Try Prisma findUnique by ID and email
      const finalCheckById = await prisma.user.findUnique({
        where: { id: user.id },
      });
      const finalCheckByEmail = await prisma.user.findUnique({
        where: { email },
      });

      // User must be visible by both ID and email, with password hash
      if (
        finalCheckById &&
        finalCheckById.id === user.id &&
        finalCheckById.passwordHash &&
        finalCheckByEmail &&
        finalCheckByEmail.id === user.id &&
        finalCheckByEmail.passwordHash
      ) {
        finalUserCheck = true;
        break;
      }

      // Strategy 2: Try raw SQL if Prisma didn't work
      if (!finalUserCheck) {
        const finalCheckByIdRaw = await prisma.$queryRaw<
          Array<{ id: string; passwordHash: string | null }>
        >`
          SELECT id, "passwordHash" FROM "User" WHERE id = ${user.id} LIMIT 1
        `;

        const finalCheckByEmailRaw = await prisma.$queryRaw<
          Array<{ id: string; email: string; passwordHash: string | null }>
        >`
          SELECT id, email, "passwordHash" FROM "User" WHERE email = ${email} LIMIT 1
        `;

        if (
          finalCheckByIdRaw &&
          finalCheckByIdRaw.length > 0 &&
          finalCheckByIdRaw[0].id === user.id &&
          finalCheckByIdRaw[0].passwordHash &&
          finalCheckByEmailRaw &&
          finalCheckByEmailRaw.length > 0 &&
          finalCheckByEmailRaw[0].id === user.id &&
          finalCheckByEmailRaw[0].passwordHash
        ) {
          finalUserCheck = true;
          break;
        }
      }
    } catch (error) {
      // Continue to next attempt
      if (attempt === finalVerificationMaxAttempts - 1) {
        // Last attempt failed - log for debugging
        console.warn(`Final verification attempt ${attempt + 1} failed:`, error);
      }
    }
  }

  // CRITICAL: Throw error if user is not visible - this function must guarantee visibility
  if (!finalUserCheck) {
    // One final attempt with delay - increased for CI
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await prisma.$executeRaw`SELECT 1`;

    let visibleByIdRaw = false;
    let visibleByEmailRaw = false;

    try {
      // CRITICAL: Use regular queries (not transactions) for verification
      // Strategy 1: Try Prisma findUnique
      const lastCheckById = await prisma.user.findUnique({
        where: { id: user.id },
      });
      const lastCheckByEmail = await prisma.user.findUnique({
        where: { email },
      });

      const visibleById = lastCheckById && lastCheckById.passwordHash;
      const visibleByEmail = lastCheckByEmail && lastCheckByEmail.passwordHash;

      if (visibleById && visibleByEmail) {
        visibleByIdRaw = true;
        visibleByEmailRaw = true;
      } else {
        // Strategy 2: Try raw SQL if Prisma didn't work
        const lastCheckByIdRaw = await prisma.$queryRaw<
          Array<{ id: string; passwordHash: string | null }>
        >`
          SELECT id, "passwordHash" FROM "User" WHERE id = ${user.id} LIMIT 1
        `;

        const lastCheckByEmailRaw = await prisma.$queryRaw<
          Array<{ id: string; email: string; passwordHash: string | null }>
        >`
          SELECT id, email, "passwordHash" FROM "User" WHERE email = ${email} LIMIT 1
        `;

        visibleByIdRaw =
          lastCheckByIdRaw && lastCheckByIdRaw.length > 0 && lastCheckByIdRaw[0].passwordHash
            ? true
            : false;
        visibleByEmailRaw =
          lastCheckByEmailRaw &&
          lastCheckByEmailRaw.length > 0 &&
          lastCheckByEmailRaw[0].passwordHash
            ? true
            : false;
      }
    } catch {
      // Will throw error below if still not visible
    }

    if (!visibleByIdRaw || !visibleByEmailRaw) {
      throw new Error(
        `createTestUserAndLogin failed: User ${email} (ID: ${user.id}) is not fully visible after login. ` +
          `Visible by ID: ${visibleByIdRaw}, Visible by Email: ${visibleByEmailRaw}. ` +
          `This indicates a database visibility issue that must be fixed in the helper, not with defensive checks in tests.`,
      );
    }
  }

  return {
    user,
    token: loginRes.body.accessToken,
  };
}

export async function createTestUser(email: string, role: 'USER' | 'ADMIN' = 'USER') {
  // Use upsert to atomically create or update user, avoiding unique constraint violations
  // This is more reliable than delete-then-create, especially in CI environments
  const passwordHash = await bcrypt.hash('password123', 10);

  // Ensure password hash is valid
  if (!passwordHash || passwordHash.length === 0) {
    throw new Error(`Failed to generate password hash for user ${email}`);
  }

  try {
    // Use transaction with ReadCommitted isolation to ensure visibility
    // This ensures the create and verification happen in a way that guarantees visibility
    const user = await prisma.$transaction(
      async (tx) => {
        // Upsert user
        const upsertedUser = await tx.user.upsert({
          where: { email },
          update: {
            // Update role and password in case user already exists with different values
            role,
            passwordHash, // Ensure password hash is always set
            name: 'Test User',
          },
          create: {
            email,
            name: 'Test User',
            passwordHash, // Ensure password hash is always set
            role,
          },
        });

        // Verify user was created/updated
        if (!upsertedUser || !upsertedUser.id) {
          throw new Error(`Failed to create/update user with email ${email}`);
        }

        // CRITICAL: Verify password hash was set correctly within transaction
        if (!upsertedUser.passwordHash) {
          // If password hash is missing, update it explicitly
          const updatedUser = await tx.user.update({
            where: { id: upsertedUser.id },
            data: { passwordHash },
          });
          if (!updatedUser.passwordHash) {
            throw new Error(`Password hash not set for user ${email} (ID: ${upsertedUser.id})`);
          }
          // Verify user is visible by email within transaction
          const verifyInTx = await tx.user.findUnique({
            where: { email },
          });
          if (!verifyInTx || verifyInTx.id !== updatedUser.id || !verifyInTx.passwordHash) {
            throw new Error(`User ${email} not fully visible within transaction after update`);
          }
          return updatedUser;
        }

        // CRITICAL: Verify user is visible by email within transaction (same query as login)
        const verifyInTx = await tx.user.findUnique({
          where: { email },
        });
        if (!verifyInTx || verifyInTx.id !== upsertedUser.id || !verifyInTx.passwordHash) {
          throw new Error(`User ${email} not fully visible within transaction after upsert`);
        }

        return upsertedUser;
      },
      {
        isolationLevel: 'ReadCommitted',
        timeout: 20000, // 20 second timeout (increased for CI with verification logic)
      },
    );

    // Ensure passwordHash is always set in the returned user object
    if (!user.passwordHash) {
      user.passwordHash = passwordHash;
    }

    // CRITICAL: Force transaction commit and wait for it to be visible
    // Execute a simple query to ensure the transaction connection is released
    await prisma.$executeRaw`SELECT 1`;
    
    // Delay to ensure commit is visible - transaction commits, but connection pool may cache
    // Increased delay for CI environments where connection pool visibility can be slower
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // CRITICAL: Verify user is visible by email (same query as login endpoint)
    // This ensures the user can be found when login attempts to query by email
    // Use transaction with ReadCommitted isolation to ensure we see committed data
    let verifyUser: { id: string; email: string; passwordHash: string } | null = null;
    let verifyUserByEmail: { id: string; email: string; passwordHash: string } | null = null;
    const quickVerificationAttempts = 20; // Increased for CI reliability

    for (let attempt = 0; attempt < quickVerificationAttempts; attempt++) {
      if (attempt > 0) {
        // Exponential backoff - increased delays for CI reliability
        await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
      }

      // Force connection refresh before each verification attempt
      await prisma.$executeRaw`SELECT 1`;

      try {
        // CRITICAL: Use regular queries (not transactions) for verification
        // This matches how the actual application queries work (login endpoint doesn't use transactions)
        // Transactions can use different connections that may not see committed data immediately

        // Strategy 1: Try Prisma findUnique by ID first
        const prismaCheckById = await prisma.user.findUnique({
          where: { id: user.id },
        });
        if (prismaCheckById && prismaCheckById.id === user.id && prismaCheckById.passwordHash) {
          verifyUser = {
            id: prismaCheckById.id,
            email: prismaCheckById.email,
            passwordHash: prismaCheckById.passwordHash,
          };
        }

        // Strategy 2: Try Prisma findUnique by email (same as login endpoint)
        const prismaCheckByEmail = await prisma.user.findUnique({
          where: { email },
        });
        if (
          prismaCheckByEmail &&
          prismaCheckByEmail.id === user.id &&
          prismaCheckByEmail.passwordHash
        ) {
          verifyUserByEmail = {
            id: prismaCheckByEmail.id,
            email: prismaCheckByEmail.email,
            passwordHash: prismaCheckByEmail.passwordHash,
          };
        }

        // Strategy 3: Try raw SQL query by ID (bypasses some caching)
        if (!verifyUser) {
          const idResult = await prisma.$queryRaw<
            Array<{ id: string; email: string; passwordHash: string | null }>
          >`
            SELECT id, email, "passwordHash" FROM "User" WHERE id = ${user.id} LIMIT 1
          `;

          if (idResult && idResult.length > 0 && idResult[0].passwordHash) {
            verifyUser = {
              id: idResult[0].id,
              email: idResult[0].email,
              passwordHash: idResult[0].passwordHash as string,
            };
          }
        }

        // Strategy 4: Try raw SQL query by email (same as login endpoint)
        if (!verifyUserByEmail) {
          const emailResult = await prisma.$queryRaw<
            Array<{ id: string; email: string; passwordHash: string | null }>
          >`
            SELECT id, email, "passwordHash" FROM "User" WHERE email = ${email} LIMIT 1
          `;

          if (
            emailResult &&
            emailResult.length > 0 &&
            emailResult[0].id === user.id &&
            emailResult[0].passwordHash
          ) {
            verifyUserByEmail = {
              id: emailResult[0].id,
              email: emailResult[0].email,
              passwordHash: emailResult[0].passwordHash as string,
            };
          }
        }

        // If password hash is missing, update it
        if (verifyUserByEmail && !verifyUserByEmail.passwordHash) {
          await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash },
          });
          // Small delay after update
          await new Promise((resolve) => setTimeout(resolve, 200));
          // Re-query to get updated user
          const recheck = await prisma.user.findUnique({
            where: { email },
          });
          if (recheck && recheck.passwordHash) {
            verifyUserByEmail = {
              id: recheck.id,
              email: recheck.email,
              passwordHash: recheck.passwordHash,
            };
          }
        }

        // If both verifications pass with password hash, we're good
        if (
          verifyUser &&
          verifyUser.passwordHash &&
          verifyUserByEmail &&
          verifyUserByEmail.passwordHash
        ) {
          break;
        }
      } catch (error) {
        // Continue to next attempt
        if (process.env.NODE_ENV === 'development') {
          console.warn(`Verification attempt ${attempt + 1} failed for ${email}:`, error);
        }
      }
    }

    // If verification failed, add extra delay and try one more time with all strategies
    if (!verifyUserByEmail || !verifyUserByEmail.passwordHash) {
      // Force connection refresh
      await prisma.$executeRaw`SELECT 1`;
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Final attempt: try all strategies one more time
      try {
        // Strategy 1: Try Prisma findUnique by email
        const finalPrismaCheck = await prisma.user.findUnique({
          where: { email },
        });
        if (finalPrismaCheck && finalPrismaCheck.id === user.id) {
          if (finalPrismaCheck.passwordHash) {
            verifyUserByEmail = {
              id: finalPrismaCheck.id,
              email: finalPrismaCheck.email,
              passwordHash: finalPrismaCheck.passwordHash,
            };
          } else {
            // Update password hash
            await prisma.user.update({
              where: { id: user.id },
              data: { passwordHash },
            });
            // Re-check
            const recheck = await prisma.user.findUnique({
              where: { email },
            });
            if (recheck && recheck.passwordHash) {
              verifyUserByEmail = {
                id: recheck.id,
                email: recheck.email,
                passwordHash: recheck.passwordHash,
              };
            }
          }
        }

        // Strategy 2: Try raw SQL if Prisma didn't work
        if (!verifyUserByEmail || !verifyUserByEmail.passwordHash) {
          const finalCheckRaw = await prisma.$queryRaw<
            Array<{ id: string; email: string; passwordHash: string | null }>
          >`
            SELECT id, email, "passwordHash" FROM "User" WHERE id = ${user.id} LIMIT 1
          `;

          if (finalCheckRaw && finalCheckRaw.length > 0) {
            const finalUser = finalCheckRaw[0];
            if (!finalUser.passwordHash) {
              // Update password hash using raw SQL
              await prisma.$executeRaw`
                UPDATE "User" SET "passwordHash" = ${passwordHash} WHERE id = ${user.id}
              `;
              // Re-check after update
              await new Promise((resolve) => setTimeout(resolve, 300));
              const recheckRaw = await prisma.$queryRaw<
                Array<{ id: string; email: string; passwordHash: string | null }>
              >`
                SELECT id, email, "passwordHash" FROM "User" WHERE email = ${email} LIMIT 1
              `;
              if (recheckRaw && recheckRaw.length > 0 && recheckRaw[0].passwordHash) {
                verifyUserByEmail = {
                  id: recheckRaw[0].id,
                  email: recheckRaw[0].email,
                  passwordHash: recheckRaw[0].passwordHash as string,
                };
              }
            } else if (finalUser.passwordHash) {
              verifyUserByEmail = {
                id: finalUser.id,
                email: finalUser.email,
                passwordHash: finalUser.passwordHash,
              };
            }
          } else {
            // User not visible yet, but upsert succeeded - ensure password hash is set anyway
            try {
              await prisma.$executeRaw`
                UPDATE "User" SET "passwordHash" = ${passwordHash} WHERE id = ${user.id}
              `;
            } catch {
              // If update fails, user might not be visible yet - this is OK, upsert already set it
              if (process.env.NODE_ENV === 'development') {
                console.warn(
                  `Could not verify/update password hash for ${email} (ID: ${user.id}), but upsert succeeded`,
                );
              }
            }
          }
        }
      } catch {
        // Verification failed, but upsert succeeded - trust the upsert result
        // The user exists, just not visible to this connection yet
        if (process.env.NODE_ENV === 'development') {
          console.warn(
            `User ${email} (ID: ${user.id}) verification failed, but upsert succeeded - trusting upsert result`,
          );
        }
      }
    }

    // CRITICAL: Trust the upsert result - if upsert returned a user, it exists
    // Connection pool visibility issues in CI can cause verification to fail,
    // but the user is still there and will be visible to subsequent queries
    return user;
  } catch (error) {
    console.error(`Error creating test user ${email}:`, error);
    throw error;
  }
}

export async function createTestCategory(name: string, slug?: string) {
  const categorySlug = slug || name.toLowerCase();

  // Categories have unique constraints on both name and slug
  // Use upsert to atomically create or update category, avoiding unique constraint violations
  // This is safer than delete-then-create because:
  // 1. Categories may have products referencing them (foreign key constraint)
  // 2. cleanupDatabase() already handles proper deletion order
  // 3. Upsert is atomic and doesn't violate foreign key constraints
  try {
    // Use transaction with ReadCommitted isolation to ensure visibility
    const category = await prisma.$transaction(
      async (tx) => {
        // Upsert category
        const upsertedCategory = await tx.category.upsert({
          where: { slug: categorySlug },
          update: {
            // Update name in case slug matches but name is different
            name,
          },
          create: {
            name,
            slug: categorySlug,
          },
        });

        // Verify category was created/updated
        if (!upsertedCategory || !upsertedCategory.id) {
          throw new Error(`Failed to create/update category with slug ${categorySlug}`);
        }

        // CRITICAL: Verify category is visible within transaction
        const verifyInTx = await tx.category.findUnique({
          where: { id: upsertedCategory.id },
        });
        if (!verifyInTx || verifyInTx.id !== upsertedCategory.id) {
          throw new Error(`Category ${name} not visible within transaction after upsert`);
        }

        return upsertedCategory;
      },
      {
        isolationLevel: 'ReadCommitted',
        timeout: 20000, // 20 second timeout (increased for CI with verification logic)
      },
    );

    // CRITICAL: Force transaction commit and wait for it to be visible
    await prisma.$executeRaw`SELECT 1`;
    
    // Delay to ensure commit is visible
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // CRITICAL: Verify category is visible - this function must guarantee visibility
    // This prevents FK violations when creating products that reference this category
    // Use transaction with ReadCommitted isolation to ensure we see committed data
    const verificationStartTime = Date.now();
    const verificationTimeoutMs = 15000; // 15 seconds for verification (increased for CI)
    const verificationMaxAttempts = 25; // Increased for CI reliability
    let verifyCategory: { id: string; name: string; slug: string } | null = null;

    for (let attempt = 0; attempt < verificationMaxAttempts; attempt++) {
      // Check timeout
      if (Date.now() - verificationStartTime > verificationTimeoutMs) {
        break;
      }

      if (attempt > 0) {
        // Exponential backoff - increased delays for CI reliability
        await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
      }

      // Force connection refresh before each check
      await prisma.$executeRaw`SELECT 1`;

      try {
        // CRITICAL: Use regular queries (not transactions) for verification
        // This matches how the actual application queries work

        // Strategy 1: Try Prisma findUnique first (uses connection pool)
        const prismaCheck = await prisma.category.findUnique({
          where: { id: category.id },
        });
        if (prismaCheck && prismaCheck.id === category.id) {
          verifyCategory = {
            id: prismaCheck.id,
            name: prismaCheck.name,
            slug: prismaCheck.slug,
          };
          break;
        }

        // Strategy 2: Try raw SQL query (bypasses some caching)
        const idResult = await prisma.$queryRaw<Array<{ id: string; name: string; slug: string }>>`
          SELECT id, name, slug FROM "Category" WHERE id = ${category.id} LIMIT 1
        `;

        if (idResult && idResult.length > 0 && idResult[0].id === category.id) {
          verifyCategory = {
            id: idResult[0].id,
            name: idResult[0].name,
            slug: idResult[0].slug,
          };
          break;
        }

        // Strategy 3: Try findFirst by slug as fallback
        const slugCheck = await prisma.category.findFirst({
          where: { slug: categorySlug },
        });
        if (slugCheck && slugCheck.id === category.id) {
          verifyCategory = {
            id: slugCheck.id,
            name: slugCheck.name,
            slug: slugCheck.slug,
          };
          break;
        }
      } catch (error) {
        // Continue to next attempt
        if (attempt === verificationMaxAttempts - 1) {
          console.warn(`Category verification attempt ${attempt + 1} failed:`, error);
        }
      }
    }

    // CRITICAL: Throw error if category is not visible - this function must guarantee visibility
    if (!verifyCategory) {
      // One final attempt with longer delay and all strategies using transaction
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await prisma.$executeRaw`SELECT 1`;

      try {
        // CRITICAL: Use regular queries (not transactions) for verification
        // Try all strategies one more time
        const finalPrismaCheck = await prisma.category.findUnique({
          where: { id: category.id },
        });
        if (finalPrismaCheck && finalPrismaCheck.id === category.id) {
          verifyCategory = {
            id: finalPrismaCheck.id,
            name: finalPrismaCheck.name,
            slug: finalPrismaCheck.slug,
          };
        } else {
          const lastCheck = await prisma.$queryRaw<
            Array<{ id: string; name: string; slug: string }>
          >`
            SELECT id, name, slug FROM "Category" WHERE id = ${category.id} LIMIT 1
          `;

          if (lastCheck && lastCheck.length > 0 && lastCheck[0].id === category.id) {
            verifyCategory = {
              id: lastCheck[0].id,
              name: lastCheck[0].name,
              slug: lastCheck[0].slug,
            };
          }
        }
      } catch {
        // Will throw error below if still not found
      }

      if (!verifyCategory) {
        throw new Error(
          `createTestCategory failed: Category ${name} (ID: ${category.id}, slug: ${categorySlug}) is not visible after creation. ` +
            `This indicates a database visibility issue that must be fixed in the helper.`,
        );
      }
    }

    return category;
  } catch (error) {
    console.error(`Error creating test category ${name} (slug: ${categorySlug}):`, error);
    throw error;
  }
}

export async function createTestProduct(
  categoryId: string,
  data?: {
    title?: string;
    priceCents?: number;
    stock?: number;
    slug?: string;
    active?: boolean;
  },
) {
  // Validate category exists before creating product
  // Retry logic with exponential backoff to handle potential timing issues in CI
  // Use raw query to bypass Prisma's connection pool caching
  // Add timeout to prevent infinite loops
  // Increased retries and delays for CI reliability
  const verificationStartTime = Date.now();
  const categoryVerificationTimeoutMs = VERIFICATION_TIMEOUT_MS * 2; // Double timeout for category verification
  let category: { id: string; name: string; slug: string } | null = null;
  const maxRetries = CATEGORY_VERIFICATION_MAX_RETRIES * 2; // Double retries for category verification

  // Initial delay to give category time to be visible
  await new Promise((resolve) => setTimeout(resolve, 200));

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Check timeout
    if (Date.now() - verificationStartTime > categoryVerificationTimeoutMs) {
      // Don't throw - try to create product anyway and let database error if category really doesn't exist
      // This handles cases where verification fails due to connection pool issues but category actually exists
      break;
    }

    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 150 * attempt)); // Exponential backoff
    }

    // Try multiple query strategies to find the category
    // Query by ID first (if categoryId is provided), then try other methods
    try {
      // Force connection refresh
      await prisma.$executeRaw`SELECT 1`;

      // Query by ID
      const idResult = await prisma.$queryRaw<Array<{ id: string; name: string; slug: string }>>`
        SELECT id, name, slug FROM "Category" WHERE id = ${categoryId} LIMIT 1
      `;

      if (idResult && idResult.length > 0) {
        category = idResult[0];
        break;
      }
    } catch {
      // Continue to next retry
    }
  }

  // If category not found after retries, add extra delay and try one more time
  // This handles edge cases where category exists but isn't visible yet
  if (!category) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      const finalResult = await prisma.$queryRaw<Array<{ id: string; name: string; slug: string }>>`
        SELECT id, name, slug FROM "Category" WHERE id = ${categoryId} LIMIT 1
      `;
      if (finalResult && finalResult.length > 0) {
        category = finalResult[0];
      }
    } catch {
      // Will throw error below if still not found
    }
  }

  // Only throw error if category still not found after all retries and delays
  // This ensures we've given maximum time for visibility
  if (!category) {
    throw new Error(
      `Category with id ${categoryId} does not exist after ${maxRetries} retries and additional delays. Ensure category is created before creating products.`,
    );
  }

  // Generate unique slug to avoid unique constraint violations
  // Use timestamp + random number to ensure uniqueness across test runs
  const baseSlug = data?.slug || (data?.title || 'test-product').toLowerCase().replace(/\s+/g, '-');
  const uniqueSlug = `${baseSlug}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  // Use transaction with ReadCommitted isolation to ensure visibility
  const product = await prisma.$transaction(
    async (tx) => {
      // Create the product
      const createdProduct = await tx.product.create({
        data: {
          title: data?.title || 'Test Product',
          slug: uniqueSlug,
          description: 'Test product description',
          priceCents: data?.priceCents || 1000,
          currency: 'USD',
          images: [],
          active: data?.active !== undefined ? data.active : true,
          stock: data?.stock || 10,
          categoryId,
        },
      });

      // Verify product was created
      if (!createdProduct || !createdProduct.id) {
        throw new Error(`Failed to create product with slug ${uniqueSlug}`);
      }

      // CRITICAL: Verify product is visible within transaction
      const verifyInTx = await tx.product.findUnique({
        where: { id: createdProduct.id },
      });
      if (!verifyInTx || verifyInTx.id !== createdProduct.id) {
        throw new Error(`Product ${createdProduct.title} not visible within transaction after create`);
      }

      return createdProduct;
    },
    {
      isolationLevel: 'ReadCommitted',
      timeout: 20000, // 20 second timeout (increased for CI with verification logic)
    },
  );

  // Force connection refresh
  await prisma.$executeRaw`SELECT 1`;

  // Delay to ensure commit is visible - transaction commits, but connection pool may cache
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // CRITICAL: Verify product is visible - this function must guarantee visibility
  // This prevents FK violations when creating orders/reviews that reference this product
  // Use multiple verification strategies: raw SQL, Prisma findUnique, and findFirst
  const productVerificationStartTime = Date.now();
  const productVerificationTimeoutMs = 15000; // 15 seconds for verification (increased for CI)
    const productVerificationMaxAttempts = 25; // Increased for CI reliability
  let verifyProduct: { id: string; title: string; slug: string } | null = null;

  for (let attempt = 0; attempt < productVerificationMaxAttempts; attempt++) {
    // Check timeout
    if (Date.now() - productVerificationStartTime > productVerificationTimeoutMs) {
      break;
    }

    if (attempt > 0) {
      // Exponential backoff: 200ms, 400ms, 600ms, etc. (increased for CI)
      await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
    }

    // Force connection refresh before each check
    await prisma.$executeRaw`SELECT 1`;

    try {
      // CRITICAL: Use regular queries (not transactions) for verification
      // This matches how the actual application queries work

      // Strategy 1: Try Prisma findUnique first (uses connection pool)
      const prismaCheck = await prisma.product.findUnique({
        where: { id: product.id },
      });
      if (prismaCheck && prismaCheck.id === product.id) {
        verifyProduct = {
          id: prismaCheck.id,
          title: prismaCheck.title,
          slug: prismaCheck.slug,
        };
        break;
      }

      // Strategy 2: Try raw SQL query (bypasses some caching)
      const idResult = await prisma.$queryRaw<Array<{ id: string; title: string; slug: string }>>`
        SELECT id, title, slug FROM "Product" WHERE id = ${product.id} LIMIT 1
      `;

      if (idResult && idResult.length > 0 && idResult[0].id === product.id) {
        verifyProduct = {
          id: idResult[0].id,
          title: idResult[0].title,
          slug: idResult[0].slug,
        };
        break;
      }

      // Strategy 3: Try findFirst by slug as fallback
      const slugCheck = await prisma.product.findFirst({
        where: { slug: uniqueSlug },
      });
      if (slugCheck && slugCheck.id === product.id) {
        verifyProduct = {
          id: slugCheck.id,
          title: slugCheck.title,
          slug: slugCheck.slug,
        };
        break;
      }
    } catch (error) {
      // Continue to next attempt
      if (attempt === productVerificationMaxAttempts - 1) {
        console.warn(`Product verification attempt ${attempt + 1} failed:`, error);
      }
    }
  }

  // CRITICAL: Throw error if product is not visible - this function must guarantee visibility
  if (!verifyProduct) {
    // One final attempt with delay - increased for CI
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await prisma.$executeRaw`SELECT 1`;

    try {
      // CRITICAL: Use regular queries (not transactions) for verification
      // Try all strategies one more time
      const finalPrismaCheck = await prisma.product.findUnique({
        where: { id: product.id },
      });
      if (finalPrismaCheck && finalPrismaCheck.id === product.id) {
        verifyProduct = {
          id: finalPrismaCheck.id,
          title: finalPrismaCheck.title,
          slug: finalPrismaCheck.slug,
        };
      } else {
        const lastCheck = await prisma.$queryRaw<
          Array<{ id: string; title: string; slug: string }>
        >`
          SELECT id, title, slug FROM "Product" WHERE id = ${product.id} LIMIT 1
        `;

        if (lastCheck && lastCheck.length > 0 && lastCheck[0].id === product.id) {
          verifyProduct = {
            id: lastCheck[0].id,
            title: lastCheck[0].title,
            slug: lastCheck[0].slug,
          };
        }
      }
    } catch {
      // Will throw error below if still not found
    }

    if (!verifyProduct) {
      throw new Error(
        `createTestProduct failed: Product ${product.title} (ID: ${product.id}, slug: ${uniqueSlug}) is not visible after creation. ` +
          `This indicates a database visibility issue that must be fixed in the helper.`,
      );
    }
  }

  return product;
}

// Simple mutex to prevent concurrent TRUNCATE operations (prevents deadlocks)
let cleanupInProgress = false;
const cleanupQueue: Array<() => void> = [];

async function waitForCleanup(): Promise<void> {
  if (!cleanupInProgress) {
    return;
  }
  // Add timeout to prevent infinite waits (max 30 seconds)
  const timeout = 30000;
  const startTime = Date.now();

  return new Promise<void>((resolve, reject) => {
    const checkTimeout = () => {
      if (Date.now() - startTime > timeout) {
        reject(new Error(`waitForCleanup timed out after ${timeout}ms`));
        return;
      }
      if (!cleanupInProgress) {
        resolve();
        return;
      }
      // Check again after a short delay
      setTimeout(checkTimeout, 100);
    };

    cleanupQueue.push(() => {
      if (Date.now() - startTime <= timeout) {
        resolve();
      } else {
        reject(new Error(`waitForCleanup timed out after ${timeout}ms`));
      }
    });

    // Also check periodically in case queue notification fails
    checkTimeout();
  });
}

/**
 * Safely executes a delete operation, only suppressing "table does not exist" errors.
 * All other errors are logged as warnings so they can be investigated.
 *
 * @param tableName - Name of the table being deleted (for logging)
 * @param deleteFn - Function that performs the delete operation
 */
async function safeDelete(tableName: string, deleteFn: () => Promise<unknown>): Promise<void> {
  try {
    await deleteFn();
  } catch (error: unknown) {
    // Extract message and code safely
    const message =
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof error.message === 'string'
        ? error.message.toLowerCase()
        : '';
    const code =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
        ? error.code
        : '';

    // Only suppress actual "table/relation does not exist" errors
    // Use regex to require "table"/"relation" and "does not exist" to appear together
    // This prevents false positives like "update or delete on table 'X' violates foreign key constraint"
    const tableMissingRegex =
      /\b((table|relation)\b.*?\bdoes not exist|does not exist\b.*?\b(table|relation))\b/i;
    const isTableMissingError =
      code === 'P2021' || // Prisma: Table does not exist
      code === '42P01' || // PostgreSQL: relation does not exist
      tableMissingRegex.test(message) ||
      message.includes('no such table'); // SQLite

    if (isTableMissingError) {
      // Table doesn't exist - this is expected and can be safely ignored
      return;
    }

    // For all other errors, log a warning so they can be investigated
    // This includes connection errors, permission errors, constraint violations, etc.
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String(error.message)
          : String(error);

    const errorCode =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
        ? error.code
        : 'UNKNOWN';

    console.warn(`⚠️  Failed to delete from table "${tableName}": [${errorCode}] ${errorMessage}`);

    // Optionally rethrow if you want to fail fast on unexpected errors
    // For now, we log and continue to allow cleanup to proceed with other tables
    // Uncomment the line below if you want cleanup to fail on unexpected errors:
    // throw error;
  }
}

export async function cleanupDatabase() {
  // Add overall timeout for cleanup (max 45 seconds)
  const cleanupTimeout = 45000;
  const cleanupStartTime = Date.now();

  // Wait for any ongoing cleanup to complete (prevents deadlocks from concurrent TRUNCATE)
  // Wrap in try/catch to handle timeout errors
  try {
    await waitForCleanup();
  } catch (error) {
    // If waitForCleanup times out, log warning and proceed anyway
    // This prevents one stuck cleanup from blocking all tests
    console.warn('waitForCleanup timed out, proceeding with cleanup anyway:', error);
    cleanupInProgress = false; // Reset flag in case it was stuck
  }

  // CRITICAL: Add a delay after waiting for cleanup to ensure any previous
  // cleanup operations are fully committed and visible before starting new cleanup
  // This prevents race conditions where user creation happens before cleanup completes
  // Increased delay for CI environments
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Check if we've already exceeded timeout
  if (Date.now() - cleanupStartTime > cleanupTimeout) {
    throw new Error(
      `cleanupDatabase timeout: already exceeded ${cleanupTimeout}ms before starting`,
    );
  }

  cleanupInProgress = true;

  try {
    // Use TRUNCATE with CASCADE for robust, fast cleanup
    // This approach:
    // 1. Handles foreign key constraints automatically with CASCADE
    // 2. Resets auto-increment sequences with RESTART IDENTITY
    // 3. Is atomic and much faster than individual deleteMany() calls
    // 4. Prevents orphaned records and FK violations

    // Retry logic for deadlock handling (PostgreSQL deadlock code: 40P01)
    // Reduced retries and faster fallback to prevent timeouts
    const maxRetries = 3; // Reduced from 5 to fail faster
    let lastError: unknown = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Check timeout before each attempt
      if (Date.now() - cleanupStartTime > cleanupTimeout) {
        throw new Error(
          `cleanupDatabase timeout: exceeded ${cleanupTimeout}ms during TRUNCATE retries`,
        );
      }

      if (attempt > 0) {
        // Shorter exponential backoff: 25ms, 50ms, 100ms
        await new Promise((resolve) => setTimeout(resolve, 25 * Math.pow(2, attempt - 1)));
      }

      try {
        // Get all tables in the public schema (Postgres)
        // Exclude Prisma migration tables (_prisma_migrations)
        const tables: Array<{ tablename: string }> = (await prisma.$queryRawUnsafe(
          `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma_%' ORDER BY tablename;`,
        )) as Array<{ tablename: string }>;

        if (tables.length === 0) {
          // No tables found, nothing to clean
          return;
        }

        // Build TRUNCATE statement with all tables
        // CASCADE automatically handles foreign key dependencies
        // RESTART IDENTITY resets auto-increment sequences
        const tableNames = tables.map((t) => `"${t.tablename}"`).join(', ');

        await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE;`);

        // CRITICAL: Delay after TRUNCATE to ensure it's fully committed and visible
        // This prevents race conditions where user creation starts before cleanup is visible
        // Force connection refresh and add delay for CI
        await prisma.$executeRaw`SELECT 1`;
        await new Promise((resolve) => setTimeout(resolve, 400));

        // Success - break out of retry loop
        return;
      } catch (error: unknown) {
        lastError = error;

        // Check if it's a deadlock error (PostgreSQL error code 40P01)
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          (error.code === '40P01' || error.code === 'P2010')
        ) {
          // Deadlock detected - will retry
          if (attempt < maxRetries - 1) {
            continue;
          }
        }
        // If not a deadlock or max retries reached, fall through to fallback
        break;
      }
    }

    // If TRUNCATE failed after retries, fall back to deleteMany
    throw lastError;
  } catch (error) {
    // Check timeout before fallback
    if (Date.now() - cleanupStartTime > cleanupTimeout) {
      console.error('cleanupDatabase timeout: exceeded during fallback, releasing mutex');
      cleanupInProgress = false;
      const next = cleanupQueue.shift();
      if (typeof next === 'function') {
        try {
          next();
        } catch (e) {
          console.error('Error notifying cleanup queue:', e);
        }
      }
      throw new Error(`cleanupDatabase timeout: exceeded ${cleanupTimeout}ms`);
    }

    // If TRUNCATE fails, fall back to individual deleteMany calls
    // This provides a safety net if TRUNCATE is not available or fails
    console.warn('TRUNCATE failed, falling back to deleteMany:', error);

    // Fallback: delete in dependency order
    // Use safeDelete helper to only suppress expected "table does not exist" errors
    // All other errors (connection, permission, constraint violations) will be logged
    // Execute all deletes in parallel for speed (they're independent after TRUNCATE fails)
    await Promise.all([
      safeDelete('review', () => prisma.review.deleteMany()),
      safeDelete('wishlist', () => prisma.wishlist.deleteMany()),
      safeDelete('address', () => prisma.address.deleteMany()),
      safeDelete('productVariant', () => prisma.productVariant.deleteMany()),
      safeDelete('cartItem', () => prisma.cartItem.deleteMany()),
      safeDelete('cart', () => prisma.cart.deleteMany()),
      safeDelete('orderStatusHistory', () => prisma.orderStatusHistory.deleteMany()),
      safeDelete('orderItem', () => prisma.orderItem.deleteMany()),
      safeDelete('order', () => prisma.order.deleteMany()),
      safeDelete('coupon', () => prisma.coupon.deleteMany()),
      safeDelete('product', () => prisma.product.deleteMany()),
      safeDelete('category', () => prisma.category.deleteMany()),
      safeDelete('user', () => prisma.user.deleteMany()),
    ]);

    // Delay after fallback cleanup to ensure all deletes are committed
    await prisma.$executeRaw`SELECT 1`;
    await new Promise((resolve) => setTimeout(resolve, 400));
  } finally {
    // CRITICAL: Add delay before releasing mutex to ensure cleanup is fully committed
    // This prevents race conditions where user creation starts before cleanup is visible
    // Force connection refresh and add delay for CI
    await prisma.$executeRaw`SELECT 1`;
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Release mutex and notify waiting operations
    cleanupInProgress = false;
    // Process queue: notify next waiting operation
    const next = cleanupQueue.shift();
    if (typeof next === 'function') {
      try {
        next();
      } catch (error) {
        // Log but don't throw - queue notification errors shouldn't break cleanup
        console.error('Error notifying cleanup queue:', error);
      }
    }
  }
}

// Note: setupTestDatabase and teardownTestDatabase were removed as they were unused.
// If you need database setup/teardown, use cleanupDatabase() directly in beforeEach/afterEach hooks.
// The global Prisma connection is managed by tests/setup.ts (connects in beforeAll, disconnects in afterAll).
