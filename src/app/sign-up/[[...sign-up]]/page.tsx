import { SignUp } from "@clerk/nextjs";
import { SiteHeader } from "@/components/site-header";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="mx-auto flex max-w-7xl justify-center px-4 py-10 sm:px-6 lg:px-8">
        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          fallbackRedirectUrl="/account"
        />
      </main>
    </div>
  );
}
