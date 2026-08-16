/**
 * Creates the platform owner account — the login for the subscription console.
 *
 * This exists as a script rather than a screen on purpose. No route in the
 * system can create a PLATFORM_OWNER: a school admin who could mint one would
 * be able to promote themselves to seeing every school on the platform. So the
 * first (and normally only) platform account is made here, by someone with
 * access to the server.
 *
 * Run:
 *   npm run platform:owner
 *
 * Reads PLATFORM_EMAIL (required) and optionally PLATFORM_FIRST_NAME,
 * PLATFORM_LAST_NAME and PLATFORM_PASSWORD. When no password is given a strong
 * one is generated and printed once — which is safer than typing a password on
 * a command line, where it lands in shell history.
 */
import { randomBytes } from "crypto";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/** A readable but strong password: 4 groups of 5 url-safe characters. */
function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(20);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return [0, 5, 10, 15].map((i) => chars.slice(i, i + 5).join("")).join("-");
}

async function main() {
  const email = process.env.PLATFORM_EMAIL?.trim().toLowerCase();
  if (!email) {
    console.error(
      "\nPLATFORM_EMAIL is required.\n\n" +
        "  PowerShell:  $env:PLATFORM_EMAIL=\"you@example.com\"; npm run platform:owner\n" +
        "  bash:        PLATFORM_EMAIL=you@example.com npm run platform:owner\n"
    );
    process.exit(1);
  }

  const firstName = process.env.PLATFORM_FIRST_NAME?.trim() || "Platform";
  const lastName = process.env.PLATFORM_LAST_NAME?.trim() || "Owner";
  const supplied = process.env.PLATFORM_PASSWORD?.trim();
  if (supplied && supplied.length < 8) {
    console.error("PLATFORM_PASSWORD must be at least 8 characters.");
    process.exit(1);
  }
  const password = supplied || generatePassword();

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing && existing.role !== Role.PLATFORM_OWNER) {
    // Never silently promote a school account: that would hand whoever uses it
    // visibility of every school on the platform.
    console.error(
      `\nRefusing: ${email} already exists as ${existing.role}.\n` +
        "Use a different address for the platform account.\n"
    );
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  if (existing) {
    // Re-running resets the password, which is the realistic reason to run this
    // twice. tokenVersion is bumped so any existing session is signed out.
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash, isActive: true, tokenVersion: { increment: 1 } },
    });
    console.log(`\nPlatform owner already existed — password reset for ${email}.`);
  } else {
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: Role.PLATFORM_OWNER,
        firstName,
        lastName,
        // A platform account belongs to no school. This is the only account in
        // the system permitted a null schoolId.
        schoolId: null,
      },
    });
    console.log(`\nPlatform owner created: ${email}`);
  }

  if (!supplied) {
    console.log("\n  Password (shown once — save it now):\n");
    console.log(`      ${password}\n`);
  }
  console.log("Sign in at /login, then open /platform.\n");
}

main()
  .catch((e) => {
    console.error("Failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
