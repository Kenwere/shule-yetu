import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  preview: { realtime: { allowedOrigins: ["http://localhost:5173", "http://127.0.0.1:5173"] } },
  auth: true,
  functions: {
    hello: {
      name: "Hello World",
      source: "./src/neon-function.ts",
      env: {
        NEON_AUTH_BASE_URL: process.env.NEON_AUTH_BASE_URL,
        NEON_AUTH_JWKS_URL: process.env.NEON_AUTH_JWKS_URL,
        NEON_REALTIME_SECRET: process.env.NEON_REALTIME_SECRET,
        AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
        AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
        AWS_ENDPOINT_URL_S3: process.env.AWS_ENDPOINT_URL_S3,
        AWS_REGION: process.env.AWS_REGION,
      },
    },
  },
  buckets: { assets: { access: "private" } },
});
