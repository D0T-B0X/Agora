import { redirect } from "next/navigation";
import {
  auth,
  isGoogleOAuthConfigured,
  isLocalDevAuthEnabled,
  signIn,
} from "../../../auth";
import { prisma } from "../../../lib/prisma";

export default async function JoinPage() {
  const session = await auth();

  // Only redirect if the user still exists — otherwise a deleted-user session loops between /join and /apply.
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { status: true },
    });

    if (user) {
      redirect(user.status === "ACTIVE" ? "/dashboard" : "/apply");
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="section-label">Join ShardUp</p>
        <h1>Start with your account.</h1>
        <p>
          Signing in creates your ShardUp identity. Full member access is granted
          after your application is reviewed.
        </p>
        <div className="auth-actions-list">
          {isGoogleOAuthConfigured ? (
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/dashboard" });
              }}
            >
              <button className="button" type="submit">
                Continue with Google
              </button>
            </form>
          ) : !isLocalDevAuthEnabled ? (
            <div className="form-message error">
              Google sign-in is not configured yet. Add <code>AUTH_GOOGLE_ID</code> and{" "}
              <code>AUTH_GOOGLE_SECRET</code> to this environment, then redeploy.
            </div>
          ) : null}

          {isLocalDevAuthEnabled ? (
            <>
              <a
                className={isGoogleOAuthConfigured ? "secondary-button" : "button"}
                href="/dev-login?role=member"
              >
                Continue as applicant (dev)
              </a>
              <a className="secondary-button" href="/dev-login?role=admin">
                Continue as admin (dev)
              </a>
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}
