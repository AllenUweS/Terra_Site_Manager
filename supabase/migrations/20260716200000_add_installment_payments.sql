-- A payment ledger lets finance track every installment separately instead of
-- overwriting a single paid-total field on the booking.
CREATE TABLE public.installment_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  due_date DATE,
  paid_on DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT,
  reference_number TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX installment_payments_booking_id_idx ON public.installment_payments(booking_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.installment_payments TO authenticated;
GRANT ALL ON public.installment_payments TO service_role;
ALTER TABLE public.installment_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage installment payments" ON public.installment_payments
  FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

-- Existing advances become their first ledger entries, keeping historical
-- bookings and new bookings on the same accounting model.
INSERT INTO public.installment_payments (booking_id, amount, paid_on, payment_method, notes, created_by)
SELECT id, advance_paid, booking_date, payment_method, 'Opening booking payment', created_by
FROM public.bookings
WHERE advance_paid > 0;

CREATE OR REPLACE FUNCTION public.capture_booking_advance_payment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.advance_paid > 0 THEN
    INSERT INTO public.installment_payments (booking_id, amount, paid_on, payment_method, notes, created_by)
    VALUES (NEW.id, NEW.advance_paid, NEW.booking_date, NEW.payment_method, 'Opening booking payment', NEW.created_by);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_capture_booking_advance
AFTER INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.capture_booking_advance_payment();

CREATE OR REPLACE FUNCTION public.refresh_booking_payment_progress()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_booking UUID := COALESCE(NEW.booking_id, OLD.booking_id);
  paid_total NUMERIC(14,2);
  agreed_total NUMERIC(14,2);
  target_plot UUID;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO paid_total FROM public.installment_payments WHERE booking_id = target_booking;
  SELECT total_price, plot_id INTO agreed_total, target_plot FROM public.bookings WHERE id = target_booking;
  UPDATE public.bookings SET advance_paid = paid_total, updated_at = now() WHERE id = target_booking;
  IF paid_total >= agreed_total THEN
    UPDATE public.plots SET status = 'sold', updated_at = now() WHERE id = target_plot;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_refresh_booking_payment_progress
AFTER INSERT OR UPDATE OR DELETE ON public.installment_payments
FOR EACH ROW EXECUTE FUNCTION public.refresh_booking_payment_progress();
