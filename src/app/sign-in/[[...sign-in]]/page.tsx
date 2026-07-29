import { SignIn } from "@clerk/nextjs";
import { SiteHeader } from "@/components/site-header";

function safeRedirectPath(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  // Must be a relative same-origin path; reject schemes, protocol-relative,
  // backslash-prefixed paths (browsers normalize `/\evil.com` to `//evil.com`),
  // and any `:` (would turn into a scheme on some platforms).
  if (!raw.startsWith("/")) return undefined;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return undefined;
  if (raw.includes("\\")) return undefined;
  if (raw.includes(":")) return undefined;
  if (raw.length > 200) return undefined;
  return raw;
}

export default async function SignInPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ redirect_url?: string }>;
}>) {
  const sp = await searchParams;
  const next = safeRedirectPath(sp.redirect_url);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="mx-auto flex max-w-7xl justify-center px-4 py-10 sm:px-6 lg:px-8">
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/account"
          {...(next ? { forceRedirectUrl: next } : {})}
        />
      </main>
    </div>
  );
}
