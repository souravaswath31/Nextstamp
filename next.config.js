// Baseline security headers for every route. A full Content-Security-Policy is deliberately not
// here yet: it has to allow Supabase (https + wss), MapTiler tiles, Vercel analytics and Stripe,
// and a wrong one breaks sign-in or maps silently. Add it behind Content-Security-Policy-Report-Only first.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
