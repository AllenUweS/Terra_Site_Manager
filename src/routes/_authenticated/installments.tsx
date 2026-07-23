import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Calendar, CalendarDays, CheckCircle2, Clock, Edit2, Lock, Plus, Search, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/installments")({ component: InstallmentsPage });

const money = (value: number) => `₹${Number(value ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const localDate = (value: string) => { const [year, month, day] = value.split("-").map(Number); return new Date(year, month - 1, day); };
const addMonths = (date: Date, months: number) => new Date(date.getFullYear(), date.getMonth() + months, date.getDate());

function paymentHealth(booking: any, ledger: any[]) {
  const totalPrice = Number(booking.total_price ?? 0);
  const paid = Number(booking.advance_paid ?? 0);
  const remaining = Math.max(0, totalPrice - paid);
  const plannedInstallments = Math.max(1, Number(booking.installment_count ?? 1));
  const recordedCount = ledger.length;

  // 1. FULLY PAID / COMPLETED (remaining <= 0)
  if (remaining <= 0) {
    return {
      overdue: 0,
      dueCount: plannedInstallments,
      expected: totalPrice,
      nextDue: null,
      scheduled: true,
      planExhausted: true,
      recordedCount,
      status: "fully_paid",
      statusLabel: "Fully paid",
      subtext: "All payments received · Plot fully paid"
    };
  }

  const dueValue = booking.first_installment_due_date as string | null;
  const installmentAmount = Number(booking.installment_amount ?? 0) || (totalPrice / plannedInstallments);

  // 2. NO SCHEDULE / DUE DATE SET YET
  if (!dueValue) {
    if (recordedCount >= plannedInstallments) {
      return {
        overdue: remaining,
        dueCount: plannedInstallments,
        expected: totalPrice,
        nextDue: null,
        scheduled: false,
        planExhausted: true,
        recordedCount,
        status: "overdue",
        statusLabel: "Payment overdue",
        subtext: `All ${plannedInstallments} planned installments recorded · ${money(remaining)} balance is overdue`
      };
    }
    return {
      overdue: 0,
      dueCount: recordedCount,
      expected: paid,
      nextDue: null,
      scheduled: false,
      planExhausted: false,
      recordedCount,
      status: "on_track",
      statusLabel: "On track",
      subtext: `${recordedCount} of ${plannedInstallments} installments paid · ${money(remaining)} remaining`
    };
  }

  // 3. SCHEDULED DUE DATES EVALUATION
  const firstDue = localDate(dueValue);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let monthsElapsed = (today.getFullYear() - firstDue.getFullYear()) * 12 + (today.getMonth() - firstDue.getMonth());
  if (today.getDate() < firstDue.getDate()) {
    monthsElapsed -= 1;
  }

  const dueCountByDate = Math.max(0, Math.min(plannedInstallments, monthsElapsed + 1));
  const expectedByToday = Math.min(totalPrice, dueCountByDate * installmentAmount);
  const planExhausted = recordedCount >= plannedInstallments || (dueCountByDate >= plannedInstallments && paid < expectedByToday);
  const nextDue = !planExhausted && recordedCount < plannedInstallments ? addMonths(firstDue, recordedCount) : null;

  // Target due date for calculating days late
  const targetDueDate = planExhausted || recordedCount >= plannedInstallments
    ? addMonths(firstDue, plannedInstallments - 1)
    : addMonths(firstDue, recordedCount);
  
  const diffMs = today.getTime() - targetDueDate.getTime();
  const daysOverdue = diffMs > 0 ? Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24))) : 0;
  const daysText = daysOverdue > 0 ? `${daysOverdue} day${daysOverdue === 1 ? "" : "s"} late` : "Due today";

  // Scenario A: Plan Exhausted / All installments completed but balance remains!
  if (planExhausted || recordedCount >= plannedInstallments) {
    return {
      overdue: remaining,
      dueCount: plannedInstallments,
      expected: totalPrice,
      nextDue: null,
      scheduled: true,
      planExhausted: true,
      recordedCount,
      daysOverdue,
      status: "overdue",
      statusLabel: `Payment overdue · ${daysText}`,
      subtext: `Overdue by ${daysOverdue > 0 ? `${daysOverdue} day${daysOverdue === 1 ? "" : "s"}` : "today"} · All ${plannedInstallments} installments completed`
    };
  }

  // Scenario B: Mid-plan behind schedule (paid < expectedByToday AND recordedCount < dueCountByDate)
  if (paid < expectedByToday && recordedCount < dueCountByDate) {
    const overdueAmt = Math.min(remaining, Math.max(0, expectedByToday - paid));
    const overdueInstallments = Math.max(1, dueCountByDate - recordedCount);
    return {
      overdue: overdueAmt,
      dueCount: dueCountByDate,
      expected: expectedByToday,
      nextDue,
      scheduled: true,
      planExhausted: false,
      recordedCount,
      daysOverdue,
      status: "overdue",
      statusLabel: `Payment overdue · ${daysText}`,
      subtext: `Overdue by ${daysOverdue > 0 ? `${daysOverdue} day${daysOverdue === 1 ? "" : "s"}` : "today"} · ${overdueInstallments} installment${overdueInstallments > 1 ? "s" : ""} overdue`
    };
  }

  // Scenario C: Mid-plan ON TRACK!
  return {
    overdue: 0,
    dueCount: dueCountByDate,
    expected: expectedByToday,
    nextDue,
    scheduled: true,
    planExhausted: false,
    recordedCount,
    daysOverdue: 0,
    status: "on_track",
    statusLabel: "On track",
    subtext: `${recordedCount} of ${plannedInstallments} installments paid · ${money(remaining)} remaining`
  };
}

function InstallmentsPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [activeBooking, setActiveBooking] = useState<any | null>(null);
  const [payment, setPayment] = useState({
    amount: "",
    paid_on: new Date().toISOString().slice(0, 10),
    payment_method: "UPI",
    reference_number: ""
  });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "overdue" | "on_track" | "fully_paid" | "schedule_needed">("all");

  // Reschedule due date state
  const [rescheduleBooking, setRescheduleBooking] = useState<any | null>(null);
  const [newDueDate, setNewDueDate] = useState<string>("");
  const [rescheduleNote, setRescheduleNote] = useState<string>("");

  const getPresetDate = (type: "15d" | "1m" | "2m" | "today") => {
    const base = new Date();
    if (type === "15d") base.setDate(base.getDate() + 15);
    else if (type === "1m") base.setMonth(base.getMonth() + 1);
    else if (type === "2m") base.setMonth(base.getMonth() + 2);
    return base.toISOString().slice(0, 10);
  };

  const openReschedule = (booking: any) => {
    setRescheduleBooking(booking);
    setNewDueDate(booking.first_installment_due_date || getPresetDate("1m"));
    setRescheduleNote("");
  };

  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      if (!rescheduleBooking || !newDueDate) throw new Error("Please select a valid date");

      const existingRemarks = rescheduleBooking.remarks ?? "";
      const noteText = rescheduleNote.trim()
        ? `[Rescheduled on ${new Date().toLocaleDateString("en-IN")}] New Due Date: ${newDueDate}. Reason: ${rescheduleNote.trim()}`
        : `[Rescheduled on ${new Date().toLocaleDateString("en-IN")}] New Due Date: ${newDueDate}`;

      const newRemarks = existingRemarks ? `${existingRemarks}\n\n${noteText}` : noteText;

      const { error } = await (supabase as any)
        .from("bookings")
        .update({
          first_installment_due_date: newDueDate,
          remarks: newRemarks,
        })
        .eq("id", rescheduleBooking.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Installment due date updated successfully!");
      setRescheduleBooking(null);
      setNewDueDate("");
      setRescheduleNote("");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to reschedule due date"),
  });

  const { data: role } = useQuery({
    queryKey: ["role", user.id],
    queryFn: async () => ((await supabase.rpc("get_primary_role", { _user_id: user.id })).data as string) ?? "employee"
  });
  const isAdmin = role === "admin" || role === "super_admin";

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["installment-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, plots(plot_number, projects(name, code))")
        .in("status", ["pending", "approved", "on_hold"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    }
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["installment-payments"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("installment_payments")
        .select("*")
        .order("paid_on", { ascending: false });
      if (error) throw error;
      return data ?? [];
    }
  });

  const paymentsByBooking = useMemo(() => {
    const map = new Map<string, any[]>();
    payments.forEach((item: any) => map.set(item.booking_id, [...(map.get(item.booking_id) ?? []), item]));
    return map;
  }, [payments]);

  const recordPayment = useMutation({
    mutationFn: async () => {
      if (!activeBooking) return;
      const amountNum = Number(payment.amount);
      if (isNaN(amountNum) || amountNum <= 0) throw new Error("Please enter a valid payment amount");

      // 1. Insert installment payment row
      const { error: pError } = await (supabase as any).from("installment_payments").insert({
        booking_id: activeBooking.id,
        amount: amountNum,
        paid_on: payment.paid_on,
        payment_method: payment.payment_method,
        reference_number: payment.reference_number || null,
        created_by: user.id
      });
      if (pError) throw pError;

      // 2. Update booking advance_paid & status if fully paid
      const currentPaid = Number(activeBooking.advance_paid ?? 0);
      const newAdvancePaid = currentPaid + amountNum;
      const totalPrice = Number(activeBooking.total_price ?? 0);
      const isFullyPaid = newAdvancePaid >= totalPrice;

      const bookingUpdate: any = {
        advance_paid: newAdvancePaid,
      };
      if (isFullyPaid) {
        bookingUpdate.status = "approved";
      }

      const { error: bError } = await supabase
        .from("bookings")
        .update(bookingUpdate)
        .eq("id", activeBooking.id);
      if (bError) throw bError;

      // 3. Mark plot sold if fully paid
      if (isFullyPaid && activeBooking.plot_id) {
        await supabase
          .from("plots")
          .update({ status: "sold" })
          .eq("id", activeBooking.plot_id);
      }

      // 4. Send notification to lead owner
      if (activeBooking.sales_executive_id) {
        const plotInfo = activeBooking.plots?.plot_number ? ` (Plot ${activeBooking.plots.plot_number})` : "";
        await (supabase as any).from("user_notifications").insert({
          user_id: activeBooking.sales_executive_id,
          title: "💳 Payment Recorded",
          message: `${money(amountNum)} installment payment recorded for ${activeBooking.customer_name}${plotInfo}.`,
          type: "payment_received",
          link: "/installments",
        });
      }
    },
    onSuccess: () => {
      toast.success("Payment recorded successfully. Progress updated.");
      setActiveBooking(null);
      setPayment({ amount: "", paid_on: new Date().toISOString().slice(0, 10), payment_method: "UPI", reference_number: "" });
      qc.invalidateQueries();
    },
    onError: (error: any) => toast.error(error.message ?? "Could not record payment")
  });

  const openRecord = (booking: any) => {
    setActiveBooking(booking);
    const rem = Math.max(Number(booking.total_price) - Number(booking.advance_paid), 0);
    const inst = Number(booking.installment_amount ?? 0) || (Number(booking.total_price) / Math.max(1, Number(booking.installment_count ?? 1)));
    setPayment((current) => ({
      ...current,
      amount: String(Math.min(inst, rem))
    }));
  };

  const totalCollected = bookings.reduce((total: number, b: any) => total + Number(b.advance_paid), 0);
  const outstanding = bookings.reduce((total: number, b: any) => total + Math.max(Number(b.total_price) - Number(b.advance_paid), 0), 0);
  const totalOverdue = bookings.reduce((total: number, b: any) => total + paymentHealth(b, paymentsByBooking.get(b.id) ?? []).overdue, 0);

  const filteredBookings = bookings.filter((booking: any) => {
    const health = paymentHealth(booking, paymentsByBooking.get(booking.id) ?? []);
    const isFullyPaid = Number(booking.total_price) - Number(booking.advance_paid) <= 0 || health.status === "fully_paid";

    const matchesFilter =
      filter === "all" ||
      (filter === "overdue" && health.overdue > 0 && !isFullyPaid) ||
      (filter === "on_track" && health.status === "on_track" && health.overdue <= 0 && !isFullyPaid) ||
      (filter === "fully_paid" && isFullyPaid) ||
      (filter === "schedule_needed" && !health.scheduled && !isFullyPaid);

    const terms = `${booking.customer_name} ${booking.customer_phone} ${booking.plots?.projects?.name ?? ""} ${booking.plots?.plot_number ?? ""}`.toLowerCase();
    return matchesFilter && terms.includes(search.trim().toLowerCase());
  });

  const activeRemaining = activeBooking ? Math.max(Number(activeBooking.total_price) - Number(activeBooking.advance_paid), 0) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Finance control room</p>
          <h1 className="text-display text-4xl mt-1">Installments</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Track collections, catch late payments early, and close a plot automatically when it is fully paid.
          </p>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3 text-right">
          <p className="text-xs text-muted-foreground">Active payment plans</p>
          <p className="text-xl text-display">{bookings.length}</p>
        </div>
      </div>

      {!isAdmin && (
        <div className="flex items-center gap-2.5 p-3.5 px-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] text-amber-800 dark:text-amber-300 text-xs font-medium">
          <Lock className="h-4 w-4 text-amber-500 shrink-0" />
          <span>
            <strong>Employee View-Only Mode:</strong> You can view installment progress, payment health, and due dates for your leads. Recording payments and changing due dates are managed by Admins.
          </span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Collected" value={money(totalCollected)} tone="text-emerald-700" />
        <Metric label="Outstanding" value={money(outstanding)} tone="text-terracotta" />
        <Metric label="Overdue now" value={money(totalOverdue)} tone={totalOverdue > 0 ? "text-destructive" : "text-emerald-700"} />
        <Metric label="Fully paid" value={`${bookings.filter((b: any) => Number(b.advance_paid) >= Number(b.total_price)).length} plots`} tone="text-foreground" />
      </div>

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b p-5">
          <div className="flex items-center gap-2">
            <WalletCards className="h-5 w-5 text-terracotta" />
            <div>
              <h2 className="font-semibold">Payment plans</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Overdue is the amount that should have been collected by today based on the agreed schedule.
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{filteredBookings.length}</span> plans shown
          </p>
        </div>

        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
              placeholder="Search customer, phone, project or plot…"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", "All", bookings.length],
                ["overdue", "Overdue", bookings.filter((b: any) => {
                  const isPaid = Number(b.total_price) - Number(b.advance_paid) <= 0;
                  return !isPaid && paymentHealth(b, paymentsByBooking.get(b.id) ?? []).overdue > 0;
                }).length],
                ["on_track", "On track", bookings.filter((b: any) => {
                  const isPaid = Number(b.total_price) - Number(b.advance_paid) <= 0;
                  const health = paymentHealth(b, paymentsByBooking.get(b.id) ?? []);
                  return !isPaid && health.status === "on_track" && health.overdue <= 0;
                }).length],
                ["fully_paid", "Fully paid", bookings.filter((b: any) => Number(b.advance_paid) >= Number(b.total_price)).length],
                ["schedule_needed", "Needs schedule", bookings.filter((b: any) => {
                  const isPaid = Number(b.total_price) - Number(b.advance_paid) <= 0;
                  return !isPaid && !paymentHealth(b, paymentsByBooking.get(b.id) ?? []).scheduled;
                }).length]
              ] as const
            ).map(([value, label, count]) => (
              <Button
                key={value}
                size="sm"
                variant={filter === value ? "default" : "outline"}
                onClick={() => setFilter(value)}
                className={filter === value ? "bg-terracotta text-accent-foreground hover:bg-terracotta/90" : ""}
              >
                {label}
                <span className="ml-1.5 rounded-full bg-background/20 px-1.5 py-0.5 text-[10px]">{count}</span>
              </Button>
            ))}
          </div>
        </div>

        <div className="divide-y">
          {isLoading ? (
            <p className="p-8 text-sm text-muted-foreground">Loading payment plans…</p>
          ) : (
            filteredBookings.map((booking: any) => {
              const ledger = paymentsByBooking.get(booking.id) ?? [];
              const paid = Number(booking.advance_paid);
              const total = Number(booking.total_price);
              const remaining = Math.max(total - paid, 0);
              const progress = total ? Math.min((paid / total) * 100, 100) : 0;
              const completed = remaining <= 0;
              const health = paymentHealth(booking, ledger);

              return (
                <div key={booking.id} className="p-5">
                  <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr_0.8fr_auto] lg:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{booking.customer_name}</p>
                        {completed && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" /> Sold / Fully Paid
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {booking.plots?.projects?.name} · Plot {booking.plots?.plot_number} · {booking.customer_phone}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {ledger.length} payment{ledger.length === 1 ? "" : "s"} recorded · {booking.installment_count ?? 1} installments planned
                      </p>
                    </div>

                    <div>
                      <div className="mb-2 flex justify-between text-xs">
                        <span className="text-muted-foreground">{money(paid)} collected</span>
                        <span className="font-medium">{money(remaining)} left</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-terracotta transition-all" style={{ width: `${progress}%` }} />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5 text-terracotta" /> Next:{" "}
                          <span className="font-medium text-foreground">
                            {completed
                              ? "Complete"
                              : health.nextDue
                              ? health.nextDue.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                              : health.planExhausted
                              ? "Plan finished (Overdue)"
                              : "Due date not set"}
                          </span>
                        </div>
                        {isAdmin && !completed && (
                          <button
                            type="button"
                            onClick={() => openReschedule(booking)}
                            className="text-[11px] font-semibold text-terracotta hover:underline inline-flex items-center gap-1 shrink-0 ml-2"
                            title="Edit or set installment due date"
                          >
                            <Calendar className="h-3 w-3" /> {booking.first_installment_due_date ? "Edit Date" : "Set Date"}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className={`rounded-xl border p-3 flex flex-col justify-between ${health.overdue > 0 ? "border-destructive/30 bg-destructive/5" : "border-emerald-500/20 bg-emerald-500/5"}`}>
                      {health.overdue > 0 ? (
                        <>
                          <div>
                            <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {health.statusLabel}
                            </div>
                            <p className="mt-1 text-xl font-semibold text-destructive">{money(health.overdue)}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{health.subtext}</p>
                          </div>

                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openReschedule(booking)}
                              className="mt-3 text-xs border-destructive/30 text-destructive hover:bg-destructive/10 gap-1.5 h-7 w-full font-medium"
                            >
                              <Calendar className="h-3.5 w-3.5" /> Reschedule Due Date
                            </Button>
                          )}
                        </>
                      ) : (
                        <>
                          <div>
                            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Payment status
                            </div>
                            <p className="mt-1 text-base font-semibold text-emerald-700">{completed ? "Fully paid" : "On track"}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{health.subtext}</p>
                          </div>

                          {isAdmin && !completed && !health.scheduled && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openReschedule(booking)}
                              className="mt-3 text-xs border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 gap-1.5 h-7 w-full font-medium"
                            >
                              <Calendar className="h-3.5 w-3.5" /> Set Due Date
                            </Button>
                          )}
                        </>
                      )}
                    </div>

                    {isAdmin && !completed ? (
                      <div className="flex flex-col gap-2">
                        <Button onClick={() => openRecord(booking)} className="bg-terracotta text-accent-foreground hover:bg-terracotta/90 w-full">
                          <Plus className="mr-1 h-4 w-4" /> Record payment
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openReschedule(booking)} className="w-full text-xs text-muted-foreground hover:text-foreground gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-terracotta" /> Reschedule
                        </Button>
                      </div>
                    ) : (
                      <div className="text-right text-xs text-muted-foreground">{completed ? "All payments received" : "Admin access required"}</div>
                    )}
                  </div>

                  {ledger.length > 0 && (
                    <div className="mt-4 border-t pt-4">
                      <p className="mb-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">Payment history</p>
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {ledger.map((entry: any) => (
                          <div key={entry.id} className="rounded-lg bg-muted/50 px-3 py-2.5">
                            <div className="flex justify-between gap-2">
                              <span className="text-sm font-medium">{money(Number(entry.amount))}</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(`${entry.paid_on}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {entry.payment_method ?? "Payment"}
                              {entry.reference_number ? ` · Ref: ${entry.reference_number}` : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {!isLoading && filteredBookings.length === 0 && (
            <p className="p-12 text-center text-sm text-muted-foreground">No payment plans match these filters.</p>
          )}
        </div>
      </section>

      <Dialog open={!!activeBooking} onOpenChange={(open) => !open && setActiveBooking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record installment payment</DialogTitle>
            <DialogDescription>
              {activeBooking?.customer_name} · Plot {activeBooking?.plots?.plot_number}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-terracotta/20 bg-terracotta/[0.08] p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Remaining amount due</p>
            <p className="mt-1 text-3xl text-display">{money(activeRemaining)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Total price {money(Number(activeBooking?.total_price ?? 0))} · {money(Number(activeBooking?.advance_paid ?? 0))} collected
            </p>
          </div>

          <div className="grid gap-4">
            <Field label="Amount received">
              <Input
                type="number"
                min="1"
                max={activeRemaining}
                value={payment.amount}
                onChange={(e) => setPayment({ ...payment, amount: e.target.value })}
              />
            </Field>

            <Field label="Received on">
              <Input type="date" value={payment.paid_on} onChange={(e) => setPayment({ ...payment, paid_on: e.target.value })} />
            </Field>

            <Field label="Payment method">
              <Select value={payment.payment_method} onValueChange={(value) => setPayment({ ...payment, payment_method: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="Bank transfer">Bank transfer</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Reference number (optional)">
              <Input value={payment.reference_number} onChange={(e) => setPayment({ ...payment, reference_number: e.target.value })} />
            </Field>

            <Button
              disabled={recordPayment.isPending || Number(payment.amount) <= 0 || Number(payment.amount) > activeRemaining}
              onClick={() => recordPayment.mutate()}
              className="bg-terracotta text-accent-foreground hover:bg-terracotta/90"
            >
              {recordPayment.isPending ? "Recording…" : "Confirm payment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reschedule Installment Due Date Dialog */}
      <Dialog open={!!rescheduleBooking} onOpenChange={(open) => !open && setRescheduleBooking(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-terracotta" /> Reschedule Installment Due Date
            </DialogTitle>
            <DialogDescription>
              {rescheduleBooking?.customer_name} · Plot {rescheduleBooking?.plots?.plot_number} ({rescheduleBooking?.plots?.projects?.name})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Health Info Card */}
            {rescheduleBooking && (
              <div className="rounded-xl border p-3 bg-muted/20 space-y-1 text-xs">
                <p className="text-muted-foreground uppercase tracking-wider font-semibold text-[10px]">Current Schedule</p>
                <p className="font-semibold text-sm">
                  {rescheduleBooking.first_installment_due_date
                    ? `First Due: ${new Date(`${rescheduleBooking.first_installment_due_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
                    : "No due date currently set"}
                </p>
                <p className="text-muted-foreground">
                  {rescheduleBooking.installment_count ?? 1} installments of {money(Number(rescheduleBooking.installment_amount ?? 0))}
                </p>
              </div>
            )}

            {/* Quick Presets */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Quick Date Presets</Label>
              <div className="grid grid-cols-4 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-xs py-1 h-8"
                  onClick={() => setNewDueDate(getPresetDate("today"))}
                >
                  Today
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-xs py-1 h-8"
                  onClick={() => setNewDueDate(getPresetDate("15d"))}
                >
                  +15 Days
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-xs py-1 h-8"
                  onClick={() => setNewDueDate(getPresetDate("1m"))}
                >
                  +1 Month
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-xs py-1 h-8"
                  onClick={() => setNewDueDate(getPresetDate("2m"))}
                >
                  +2 Months
                </Button>
              </div>
            </div>

            {/* Custom Date Input */}
            <div>
              <Label className="text-xs text-muted-foreground">New Target / First Due Date</Label>
              <Input
                type="date"
                className="mt-1"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
              />
            </div>

            {/* Reason / Remarks */}
            <div>
              <Label className="text-xs text-muted-foreground">Reason for Rescheduling (Optional)</Label>
              <Input
                placeholder="e.g. Extended due to customer bank loan process"
                className="mt-1 text-xs"
                value={rescheduleNote}
                onChange={(e) => setRescheduleNote(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRescheduleBooking(null)}
              disabled={rescheduleMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => rescheduleMutation.mutate()}
              disabled={rescheduleMutation.isPending || !newDueDate}
              className="bg-terracotta hover:bg-terracotta/90 text-white"
            >
              {rescheduleMutation.isPending ? "Updating Date…" : "Save New Due Date"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl text-display ${tone}`}>{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
