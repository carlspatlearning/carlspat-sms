-- Add PromotionType enum and type column to Promotion
CREATE TYPE "PromotionType" AS ENUM ('PROMOTED', 'REPEATED', 'GRADUATED');
ALTER TABLE "Promotion" ADD COLUMN "type" "PromotionType" NOT NULL DEFAULT 'PROMOTED';
