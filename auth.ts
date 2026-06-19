import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./lib/prisma";
import { ensureRegistrationRecords, syncUserAccess } from "./lib/access";

const isDevelopment = process.env.NODE_ENV !== "production";
export const isGoogleOAuthConfigured = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  secret:
    process.env.AUTH_SECRET ??
    (isDevelopment ? "shardup-development-only-auth-secret" : undefined),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/join",
  },
  providers: isGoogleOAuthConfigured
    ? [
        Google({
          clientId: process.env.AUTH_GOOGLE_ID ?? "",
          clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "",
          allowDangerousEmailAccountLinking: false,
        }),
      ]
    : [],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") {
        return false;
      }

      if (profile && "email_verified" in profile && profile.email_verified === false) {
        return false;
      }

      return true;
    },
    async jwt({ token, user }) {
      const userId =
        typeof user?.id === "string"
          ? user.id
          : typeof token.id === "string"
            ? token.id
            : undefined;
      const email =
        typeof user?.email === "string"
          ? user.email
          : typeof token.email === "string"
            ? token.email
            : undefined;

      if (userId) {
        const access = await syncUserAccess(userId, email);
        token.id = userId;
        token.role = access?.role ?? "MEMBER";
        token.status = access?.status ?? "PENDING";
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.id === "string") {
        session.user.id = token.id;
        session.user.role = token.role === "ADMIN" ? "ADMIN" : "MEMBER";
        session.user.status =
          token.status === "ACTIVE" ||
          token.status === "REJECTED" ||
          token.status === "SUSPENDED"
            ? token.status
            : "PENDING";
      }

      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (user.id) {
        await ensureRegistrationRecords(user.id, user.email);
      }
    },
  },
});
