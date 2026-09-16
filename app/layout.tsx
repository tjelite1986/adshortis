import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getSession, handleFor } from "@/lib/auth";
import { loginUrl, ssoConfigured } from "@/lib/sso";
import { getBooleanSetting, getBooleanSettings } from "@/lib/app-settings";
import { AppSettingsProvider } from "@/components/app-settings-context";
import BottomNav from "@/components/bottom-nav";
import SignedOut from "@/components/signed-out";
import PwaRegister from "@/components/pwa-register";
import InstallBanner from "@/components/install-banner";

export const metadata: Metadata = {
  title: "Adshortis",
  description: "A vertical short-video library.",
  manifest: "/manifest.webmanifest",
  applicationName: "Adshortis",
  appleWebApp: {
    capable: true,
    title: "Adshortis",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/favicon-32.png?v=1",
    apple: "/apple-touch-icon.png?v=1",
  },
};

export const viewport: Viewport = {
  themeColor: "#121212",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Every page needs the session, and the session comes from a network call to
// elite-v2 — so it is resolved once here rather than in each page.
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  // Both addresses are gated on a setting an admin flips in Settings > Links:
  // run this app on its own and neither link leads anywhere you want to go, so
  // the menu should be able to drop them without the address having to go too
  // (the handover still needs MAIN_APP_URL's neighbour to exist).
  const eliteUrl = getBooleanSetting("show_elite_link")
    ? process.env.ELITE_APP_URL || null
    : null;
  // The main shorts library. Read here, not as NEXT_PUBLIC_: it is a deployment
  // fact, and baking it into the client bundle would publish the address of a
  // neighbouring app to anyone who opens the JS.
  const mainUrl = getBooleanSetting("show_main_library_link")
    ? process.env.MAIN_APP_URL || null
    : null;
  // The rest of the flags travel to the client tree, where a clip's 3-dot menu
  // reads them.
  const appSettings = getBooleanSettings();

  // Two custom properties, adopted from the site the login comes from so the
  // app does not announce itself as somewhere else on every visit. Both values
  // are re-validated in lib/sso.ts before they reach this style block; signed
  // out, the defaults in globals.css stand.
  const appearance = session?.appearance;
  const themeCss = appearance
    ? `:root{--accent:${appearance.accent};--app-bg:${appearance.bg}}`
    : "";

  return (
    <html lang="en" className="dark">
      <body className="overflow-x-hidden bg-[#121212]">
        {themeCss && <style dangerouslySetInnerHTML={{ __html: themeCss }} />}
        <AppSettingsProvider value={appSettings}>
          <div
            className="relative min-h-[100dvh] w-full"
            style={{ background: "var(--app-bg)" }}
          >
            {session ? (
              <BottomNav
                isAdmin={session.role === "admin"}
                handle={handleFor({
                  username: session.username,
                  email: session.email,
                })}
                eliteUrl={eliteUrl}
                mainUrl={mainUrl}
              >
                {children}
                <InstallBanner />
              </BottomNav>
            ) : (
              // Not a redirect. The sign-in page belongs to another host, and a
              // server-side redirect there would make every cold load bounce
              // through it — including the ones where elite-v2 is simply
              // unreachable, which is a different problem and deserves to say so.
              <SignedOut
                loginHref={loginUrl("/")}
                configured={ssoConfigured()}
              />
            )}
          </div>
        </AppSettingsProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
