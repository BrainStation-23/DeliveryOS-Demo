-- AlterTable: gateway refund tracking columns
ALTER TABLE "payments" ADD COLUMN "refund_id" VARCHAR(100);
ALTER TABLE "payments" ADD COLUMN "refunded_at" TIMESTAMPTZ;
