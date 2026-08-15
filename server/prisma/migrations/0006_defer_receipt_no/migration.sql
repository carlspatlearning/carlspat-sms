-- Receipt numbers are now assigned when a payment is confirmed rather than when
-- an online checkout starts, so abandoned checkouts no longer burn a number.
-- Pending payments carry a NULL receiptNo; the unique index still holds because
-- Postgres allows multiple NULLs in a UNIQUE column.
ALTER TABLE "Payment" ALTER COLUMN "receiptNo" DROP NOT NULL;
