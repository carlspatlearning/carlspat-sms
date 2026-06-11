import dotenv from "dotenv";
dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const isTest = process.env.NODE_ENV === "test";

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd: process.env.NODE_ENV === "production",
  isTest,
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: isTest ? process.env.DATABASE_URL ?? "" : required("DATABASE_URL"),
  jwt: {
    accessSecret: isTest ? "test-access-secret-test-access-secret!!" : required("JWT_ACCESS_SECRET"),
    refreshSecret: isTest ? "test-refresh-secret-test-refresh-secret" : required("JWT_REFRESH_SECRET"),
    accessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
    refreshTtl: process.env.JWT_REFRESH_TTL ?? "7d",
  },
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:3000").split(",").map((s) => s.trim()),
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
    apiKey: process.env.CLOUDINARY_API_KEY ?? "",
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
    get enabled() {
      return Boolean(this.cloudName && this.apiKey && this.apiSecret);
    },
  },
  paystackSecret: process.env.PAYSTACK_SECRET_KEY ?? "",
  flutterwave: {
    secret: process.env.FLUTTERWAVE_SECRET_KEY ?? "",
    webhookHash: process.env.FLUTTERWAVE_WEBHOOK_HASH ?? "",
  },
  paymentCallbackUrl: process.env.PAYMENT_CALLBACK_URL ?? "http://localhost:3000/dashboard/fees",
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY ?? "",
    from: process.env.SENDGRID_FROM_EMAIL ?? "carlspatprivateschool@outlook.com",
  },
  twilio: {
    sid: process.env.TWILIO_ACCOUNT_SID ?? "",
    token: process.env.TWILIO_AUTH_TOKEN ?? "",
    from: process.env.TWILIO_FROM_NUMBER ?? "",
  },
};
