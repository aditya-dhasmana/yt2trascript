export default function sitemap() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.yt2trascript.in";

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
    },
  ];
}
