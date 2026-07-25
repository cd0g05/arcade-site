import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Discord from 'next-auth/providers/discord';
import { eq } from 'drizzle-orm';
import { db } from './db/client';
import { users } from './db/schema';

// Google is the primary identity provider (FR-1.1). Discord is configured here so the
// account-linking step (FR-1.2) can reuse Auth.js's provider-linking flow, but the actual
// "link a Discord account after Google login" UX is built in feat/site-integration —
// this file only wires the provider, it does not implement the linking screen.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== 'google' || !user.email) return false;

      const googleId = account.providerAccountId;
      const existing = await db.query.users.findFirst({
        where: eq(users.googleId, googleId),
      });

      if (!existing) {
        await db.insert(users).values({
          googleId,
          email: user.email,
          displayName: user.name ?? user.email,
        });
      } else {
        await db
          .update(users)
          .set({ lastActiveAt: new Date() })
          .where(eq(users.id, existing.id));
      }

      return true;
    },
    async session({ session }) {
      if (!session.user?.email) return session;
      const record = await db.query.users.findFirst({
        where: eq(users.email, session.user.email),
      });
      if (record) {
        (session.user as { id?: string; isAdmin?: boolean }).id = record.id;
        (session.user as { id?: string; isAdmin?: boolean }).isAdmin = record.isAdmin;
      }
      return session;
    },
  },
});

// Bot service-key auth lives in lib/bot-key.ts — it shares nothing with Auth.js, and
// keeping it here forced `next-auth` into any context that only needed to check a key.
