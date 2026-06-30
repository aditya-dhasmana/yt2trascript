export default function robots() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.yt2trascript.in";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
