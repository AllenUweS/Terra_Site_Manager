import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { CheckCircle2, Gift, Sparkles, WalletCards, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/my-incentives")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: MyIncentivesPage,
});

type IncentiveGrant = {
  id: string;
  booking_id: string;
  amount: number;
  granted_at: string;
  notes: string | null;
};

type Booking = {
  id: string;
  customer_name: string;
  booking_date: string;
  incentive_amount: number | null;
  plots: {
    plot_number: string;
    projects: { name: string } | null;
  } | null;
};

type IncentiveWithGrant = Booking & { incentive_grant: IncentiveGrant | null };

const money = (amount: number) => `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

function MyIncentivesPage() {
  const { user } = Route.useRouteContext();

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ["my-bookings", user.id],
    queryFn: async () => {
      console.log("Fetching bookings for user:", user.id, user.email);
      const { data, error } = await (supabase as any)
        .from("bookings")
        .select("id, customer_name, booking_date, incentive_amount, sales_executive_id, status, plots(plot_number, projects(name))")
        .eq("sales_executive_id", user.id)
        .order("booking_date", { ascending: false });

      if (error) {
        console.error("Error fetching bookings:", error);
        throw error;
      }
      console.log("Bookings found:", data);
      return (data ?? []) as Booking[];
    },
  });

  const bookingIds = useMemo(() => bookings.map((b) => b.id), [bookings]);

  const { data: grants = [], isLoading: grantsLoading } = useQuery({
    queryKey: ["my-incentive-grants", bookingIds],
    queryFn: async () => {
      if (bookingIds.length === 0) return [];
      const { data, error } = await (supabase as any)
        .from("incentive_grants")
        .select("id, booking_id, amount, granted_at, notes")
        .in("booking_id", bookingIds);

      if (error) throw error;
      return (data ?? []) as IncentiveGrant[];
    },
    enabled: bookingIds.length > 0,
  });

  const incentivesWithGrants = useMemo(() => {
    const grantsByBooking = new Map(grants.map((g) => [g.booking_id, g]));
    return bookings.map((booking) => ({
      ...booking,
      incentive_grant: grantsByBooking.get(booking.id) || null,
    }));
  }, [bookings, grants]);

  const granted = incentivesWithGrants.filter((i) => i.incentive_grant);
  const pending = incentivesWithGrants.filter((i) => !i.incentive_grant);
  const totalEarned = granted.reduce((sum, i) => sum + Number(i.incentive_grant?.amount ?? 0), 0);
  const pendingAmount = pending.reduce((sum, i) => sum + Number(i.incentive_amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Your achievements
        </p>
        <h1 className="mt-1 text-display text-4xl">My Incentives</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Track the rewards you've earned and pending approvals for your successful plot conversions.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Clock} label="Pending approval" value={pending.length} tone="text-amber-700" />
        <Metric icon={Gift} label="Granted rewards" value={granted.length} tone="text-emerald-700" />
        <Metric icon={WalletCards} label="Total earned" value={money(totalEarned)} tone="text-terracotta" />
        <Metric icon={Sparkles} label="Pending amount" value={money(pendingAmount)} tone="text-amber-600" />
      </div>

      {/* Granted Incentives */}
      <section className="rounded-2xl border bg-card p-5">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-semibold">Granted incentives</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Rewards that have been approved and paid out.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{granted.length}</span> total
          </p>
        </div>

        {bookingsLoading || grantsLoading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Loading your incentives…
          </p>
        ) : granted.length === 0 ? (
          <div className="py-12 text-center">
            <Gift className="mx-auto mb-3 h-7 w-7 text-muted-foreground" />
            <p className="font-medium">No granted incentives yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Granted incentives will appear here once approved.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {granted.map((item) => {
              const incentive = item.incentive_grant!;
              return (
                <Card key={incentive.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="rounded-full bg-emerald-100 p-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Granted
                        </span>
                      </div>
                      <CardTitle className="text-lg text-terracotta">
                        {money(Number(incentive.amount))}
                      </CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                      {new Date(incentive.granted_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="rounded-lg bg-muted/60 p-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                        Plot conversion
                      </p>
                      <p className="mt-1 font-medium">
                        Plot {item.plots?.plot_number ?? "—"}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.customer_name ?? "Unknown customer"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.plots?.projects?.name ?? "Project"}
                      </p>
                    </div>
                    {incentive.notes && (
                      <p className="text-xs text-muted-foreground italic">
                        &quot;{incentive.notes}&quot;
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Pending Incentives */}
      <section className="rounded-2xl border bg-card p-5">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-semibold">Pending incentives</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Awaiting approval from your manager.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{pending.length}</span> total
          </p>
        </div>

        {pending.length === 0 ? (
          <div className="py-12 text-center">
            <Clock className="mx-auto mb-3 h-7 w-7 text-muted-foreground" />
            <p className="font-medium">No pending incentives</p>
            <p className="mt-1 text-sm text-muted-foreground">
              All your conversions have been processed.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pending.map((item) => (
              <Card key={item.id} className="overflow-hidden border-amber-200 bg-amber-50/30">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="rounded-full bg-amber-100 p-2">
                        <Clock className="h-4 w-4 text-amber-700" />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Pending
                      </span>
                    </div>
                    <CardTitle className="text-lg text-amber-700">
                      {money(Number(item.incentive_amount ?? 0))}
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs">
                    Booked {new Date(`${item.booking_date}T00:00:00`).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="rounded-lg bg-muted/60 p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      Plot conversion
                    </p>
                    <p className="mt-1 font-medium">
                      Plot {item.plots?.plot_number ?? "—"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.customer_name ?? "Unknown customer"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.plots?.projects?.name ?? "Project"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Sparkles;
  label: string;
  value: string | number;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <Icon className={`h-5 w-5 ${tone}`} />
      <p className="mt-4 text-sm text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl text-display ${tone}`}>{value}</p>
    </div>
  );
}
