import { prisma } from "./prisma";

// Phase 1 is single-user by design (see project brief). There's no login —
// every table already carries a userId so Phase 2 auth drops in without a
// schema migration. Until then, this is the one seeded user.
export async function getCurrentUser() {
  const user = await prisma.user.findUnique({
    where: { email: "sourav@nextstamp.local" },
    include: { heldDocuments: true },
  });

  if (!user) {
    throw new Error(
      "No seeded user found. Run `npm run seed` before starting the app."
    );
  }

  return user;
}
