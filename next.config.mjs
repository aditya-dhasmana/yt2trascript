/** @type {import('next').NextConfig} */
const isHostedProduction = process.env.VERCEL_ENV === "production";
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";

if (isHostedProduction && (!backendUrl || /localhost|127\.0\.0\.1/.test(backendUrl))) {
  throw new Error(
    "NEXT_PUBLIC_BACKEND_URL must point to the deployed backend for a production Vercel build.",
  );
}

const nextConfig = {
  /* config options here */
};

export default nextConfig;
