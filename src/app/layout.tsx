import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import Link from "next/link";
import Script from "next/script";
import WalletButton from "./wallet-button";
import ZamaReadyBadge from "./zama-ready";
import SearchBox from "./search-box";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Confidential Token Factory - Create Confidential Tokens",
  description: "Create Zama confidential tokens effortlessly. Private transactions, secure and reliable.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Script id="zama-sdk-init" strategy="afterInteractive">
          {`
            (async () => {
              try {
                if (!window.ZamaRelayerSDK && !window.fhevm) {
                  const mod = await import('https://cdn.zama.org/relayer-sdk-js/0.3.0-5/relayer-sdk-js.js');
                  const { initSDK, createInstance, SepoliaConfig } = mod;
                  window.ZamaRelayerSDK = { initSDK, createInstance, SepoliaConfig };
                  console.log('Zama SDK loaded successfully');
                }
              } catch (e) {
                console.error('Failed to load Zama SDK:', e);
              }
            })();
          `}
        </Script>
        <Providers>
          <div className="min-h-dvh flex flex-col">
            <header className="w-full px-6 py-3">
              <div className="grid grid-cols-3 items-center">
                <div className="flex justify-start">
                  <Link href="/" className="flex items-center gap-2 text-base font-medium tracking-tight hover:opacity-80 transition-opacity">
                    <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <g transform="translate(8, 8)">
                        <rect x="7" y="0" width="2" height="2.5" fill="#FFDD00"/>
                        <rect x="12.5" y="1.5" width="2.5" height="2" transform="rotate(45 13.75 2.5)" fill="#FFDD00"/>
                        <rect x="14.5" y="7" width="2.5" height="2" fill="#FFDD00"/>
                        <rect x="12.5" y="12.5" width="2.5" height="2" transform="rotate(-45 13.75 13.5)" fill="#FFDD00"/>
                        <rect x="7" y="14.5" width="2" height="2.5" fill="#FFDD00"/>
                        <rect x="1" y="12.5" width="2.5" height="2" transform="rotate(45 2.25 13.5)" fill="#FFDD00"/>
                        <rect x="-1" y="7" width="2.5" height="2" fill="#FFDD00"/>
                        <rect x="1" y="1.5" width="2.5" height="2" transform="rotate(-45 2.25 2.5)" fill="#FFDD00"/>
                        <circle cx="8" cy="8" r="5.5" fill="#FFDD00"/>
                        <circle cx="8" cy="8" r="3" fill="#0A0A0A"/>
                        <circle cx="8" cy="8" r="1.5" fill="#FFDD00" opacity="0.6"/>
                      </g>
                      <g transform="translate(18, 18)">
                        <rect x="4.5" y="0" width="1.5" height="1.5" fill="#22C55E"/>
                        <rect x="8.5" y="2" width="1.5" height="1.5" transform="rotate(60 9.25 2.75)" fill="#22C55E"/>
                        <rect x="8.5" y="6.5" width="1.5" height="1.5" transform="rotate(-60 9.25 7.25)" fill="#22C55E"/>
                        <rect x="4.5" y="9" width="1.5" height="1.5" fill="#22C55E"/>
                        <rect x="0.5" y="6.5" width="1.5" height="1.5" transform="rotate(60 1.25 7.25)" fill="#22C55E"/>
                        <rect x="0.5" y="2" width="1.5" height="1.5" transform="rotate(-60 1.25 2.75)" fill="#22C55E"/>
                        <circle cx="5.5" cy="5.5" r="3.5" fill="#22C55E"/>
                        <circle cx="5.5" cy="5.5" r="2" fill="#0A0A0A"/>
                        <circle cx="5.5" cy="5.5" r="1" fill="#22C55E" opacity="0.6"/>
                      </g>
                    </svg>
                    <span>Confidential Token Factory</span>
                  </Link>
                </div>
                <div className="flex justify-center">
                  <SearchBox />
                </div>
                <div className="flex justify-end items-center gap-3">
                  <a
                    href="https://github.com/SaurabViena/confidential-token-factory"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-foreground/[0.05] transition-colors"
                    title="View on GitHub"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-foreground/80">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                  </a>
                  <ZamaReadyBadge />
                  <WalletButton />
                </div>
              </div>
            </header>
            <main className="flex-1">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
