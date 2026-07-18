-- Keep the agreed payment plan and credited incentive with the booking itself.
-- The sales executive is always the owner of the converted lead, never the admin who created the booking.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS installment_count INTEGER NOT NULL DEFAULT 1 CHECK (installment_count > 0),
  ADD COLUMN IF NOT EXISTS installment_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS first_installment_due_date DATE,
  ADD COLUMN IF NOT EXISTS incentive_amount NUMERIC(14,2) NOT NULL DEFAULT 0;
