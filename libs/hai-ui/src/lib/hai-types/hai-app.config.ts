export interface HaiAboutConfig {
  appId: string;
  appName: string;
  appTagline: string;
  appDescription: string;
  appUrl?: string;
  logoSrc?: string;
}

export interface HaiAppLink {
  appId: string;
  name: string;
  tagline: string;
  href: string;
  logoSrc?: string;
}
