import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// Allowed users - read from environment variable (comma-separated emails)
// Fallback to empty array if not set
const ALLOWED_USERS = process.env.ALLOWED_USERS 
  ? process.env.ALLOWED_USERS.split(',').map(email => email.trim())
  : [];

const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "select_account", // Force account selection every time
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Check if user email is in allowed list
      if (user.email && ALLOWED_USERS.includes(user.email)) {
        return true;
      }
      // Deny access if not in allowed list
      return false;
    },
    async session({ session }) {
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

