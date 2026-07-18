import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CheckCircle2, Gift, Search, Sparkles, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/incentives")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: role } = await supabase.rpc("get_primary_role", { _user_id: data.user.id });
    if (role !== "admin" && role !== "super_admin" && role !== "manager") throw redirect({ to: "/dashboard" });
  },
  component: IncentivesPage,
});

type IncentiveGrant = { id: string; booking_id: string; amount: number; granted_at: string; notes: string | null };
type IncentiveBooking = { id: string; customer_name: string; booking_date: string; incentive_amount: number | null; sales_executive_id: string | null; plots: { plot_number: string; projects: { name: string } | null } | null; incentive_grants: IncentiveGrant[] };
const money = (amount: number) => `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

function IncentivesPage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<IncentiveBooking | null>(null);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "awaiting" | "granted">("all");

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["incentive-bookings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("bookings").select("id, customer_name, booking_date, incentive_amount, sales_executive_id, status, plots(plot_number, projects(name))").not("sales_executive_id", "is", null).order("booking_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as IncentiveBooking[];
    },
  });
  const bookingIds = useMemo(() => bookings.map((booking) => booking.id), [bookings]);
  const { data: grants = [] } = useQuery({
    queryKey: ["incentive-grants", bookingIds], enabled: bookingIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("incentive_grants").select("id, booking_id, amount, granted_at, notes").in("booking_id", bookingIds);
      if (error) throw error;
      return (data ?? []) as IncentiveGrant[];
    },
  });
  const rewardBookings = useMemo(() => {
    const grantsByBooking = new Map(grants.map((grant) => [grant.booking_id, grant]));
    return bookings.map((booking) => ({ ...booking, incentive_grants: grantsByBooking.has(booking.id) ? [grantsByBooking.get(booking.id)!] : [] }));
  }, [bookings, grants]);
  const executiveIds = useMemo(() => [...new Set(rewardBookings.map((b) => b.sales_executive_id).filter(Boolean))], [rewardBookings]);
  const { data: profiles = [] } = useQuery({
    queryKey: ["incentive-profiles", executiveIds], enabled: executiveIds.length > 0,
    queryFn: async () => { const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", executiveIds as string[]); if (error) throw error; return data ?? []; },
  });
  const profileNames = new Map(profiles.map((p) => [p.id, p.full_name || "Unassigned employee"]));
  const grant = useMutation({
    mutationFn: async () => {
      if (!selected || Number(amount) <= 0) throw new Error("Enter a valid incentive amount.");
      const { data: existing, error: lookupError } = await (supabase as any).from("incentive_grants").select("id").eq("booking_id", selected.id).maybeSingle();
      if (lookupError) throw lookupError;
      if (existing) throw new Error("This booking already has a granted incentive.");
      const { error } = await (supabase as any).from("incentive_grants").insert({ booking_id: selected.id, employee_id: selected.sales_executive_id, amount: Number(amount), notes: notes.trim() || null, granted_by: user.id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Incentive granted and added to the vault."); setSelected(null); queryClient.invalidateQueries({ queryKey: ["incentive-bookings"] }); queryClient.invalidateQueries({ queryKey: ["incentive-grants"] }); },
    onError: (error: Error) => toast.error(error.message || "Unable to grant incentive"),
  });
  const openGrant = (booking: IncentiveBooking) => { setSelected(booking); setAmount(String(booking.incentive_amount ?? "")); setNotes(""); };
  const granted = rewardBookings.filter((b) => b.incentive_grants.length).length;
  const pending = rewardBookings.length - granted;
  const totalGranted = rewardBookings.reduce((sum, b) => sum + Number(b.incentive_grants[0]?.amount ?? 0), 0);
  const filteredBookings = rewardBookings.filter((b) => {
    const isGranted = Boolean(b.incentive_grants?.length);
    const statusMatches = statusFilter === "all" || (statusFilter === "granted" ? isGranted : !isGranted);
    const terms = [profileNames.get(b.sales_executive_id ?? ""), b.customer_name, b.plots?.plot_number, b.plots?.projects?.name].filter(Boolean).join(" ").toLowerCase();
    return statusMatches && terms.includes(search.trim().toLowerCase());
  });

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Recognition control room</p><h1 className="mt-1 text-display text-4xl">Incentive Vault</h1><p className="mt-2 text-sm text-muted-foreground">Reward every plot conversion with a clear, auditable record.</p></div><div className="rounded-xl border bg-card px-4 py-3 text-right"><p className="text-xs text-muted-foreground">Awaiting recognition</p><p className="text-2xl text-display text-terracotta">{pending}</p></div></div>
    <div className="grid gap-4 sm:grid-cols-3"><Metric icon={Sparkles} label="Eligible conversions" value={rewardBookings.length} tone="text-foreground" /><Metric icon={Gift} label="Already granted" value={granted} tone="text-emerald-700" /><Metric icon={WalletCards} label="Value rewarded" value={money(totalGranted)} tone="text-terracotta" /></div>
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="font-semibold">Conversion rewards</h2><p className="mt-1 text-xs text-muted-foreground">Search a person, customer, project, or plot — then reward the win.</p></div><p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">{filteredBookings.length}</span> shown</p></div>
      <div className="mt-5 flex flex-col gap-3 border-y py-4 lg:flex-row lg:items-center lg:justify-between"><div className="relative w-full lg:max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" placeholder="Search rewards..." /></div><div className="flex flex-wrap gap-2">{([ ["all", "All rewards", rewardBookings.length], ["awaiting", "Awaiting grant", pending], ["granted", "Granted", granted] ] as const).map(([value, label, count]) => <Button key={value} size="sm" variant={statusFilter === value ? "default" : "outline"} onClick={() => setStatusFilter(value)} className={statusFilter === value ? "bg-terracotta text-accent-foreground hover:bg-terracotta/90" : ""}>{label}<span className="ml-1.5 rounded-full bg-background/20 px-1.5 py-0.5 text-[10px]">{count}</span></Button>)}</div></div>
      {isLoading ? <p className="py-12 text-center text-sm text-muted-foreground">Loading conversions…</p> : bookings.length === 0 ? <EmptyState title="No approved plot bookings yet" description="Rewards will appear here as soon as a booking is approved." /> : filteredBookings.length === 0 ? <EmptyState title="No rewards match those filters" description="Try another search term or choose a different reward status." /> : <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{filteredBookings.map((booking) => {
        const grantRecord = booking.incentive_grants?.[0]; const suggested = Number(booking.incentive_amount ?? 0);
        return <article key={booking.id} className={`flex min-h-70 flex-col rounded-2xl border p-4 transition-shadow hover:shadow-md ${grantRecord ? "border-emerald-200 bg-emerald-50/30" : "bg-background"}`}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-semibold">{profileNames.get(booking.sales_executive_id ?? "")}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{booking.plots?.projects?.name ?? "Project"}</p></div><Status granted={Boolean(grantRecord)} /></div><div className="mt-5 rounded-xl bg-muted/60 p-3"><p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Plot conversion</p><p className="mt-1 font-medium">Plot {booking.plots?.plot_number ?? "—"}</p><p className="mt-1 truncate text-sm text-muted-foreground">{booking.customer_name}</p></div><div className="mt-4"><p className="text-xs text-muted-foreground">{grantRecord ? "Reward granted" : "Suggested reward"}</p><p className="mt-1 text-2xl text-display">{money(Number(grantRecord?.amount ?? suggested))}</p><p className="mt-1 text-xs text-muted-foreground">{grantRecord ? `Granted ${new Date(grantRecord.granted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : `Booked ${new Date(`${booking.booking_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}</p></div><div className="mt-auto pt-5">{grantRecord ? <div className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Granted</div> : <Button className="w-full bg-terracotta text-accent-foreground hover:bg-terracotta/90" onClick={() => openGrant(booking)}><Gift className="mr-2 h-4 w-4" /> Grant incentive</Button>}</div></article>;
      })}</div>}
    </section>
    <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}><DialogContent><DialogHeader><DialogTitle>Grant conversion reward</DialogTitle><DialogDescription>Confirm the reward for {selected && profileNames.get(selected.sales_executive_id ?? "")} for Plot {selected?.plots?.plot_number}.</DialogDescription></DialogHeader><div className="space-y-4"><div className="rounded-xl border border-terracotta/20 bg-terracotta/[0.07] p-4"><p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Recognition moment</p><p className="mt-1 font-medium">This will mark the incentive as granted and keep it in the permanent reward history.</p></div><div className="space-y-2"><Label htmlFor="incentive-amount">Incentive amount</Label><Input id="incentive-amount" type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Enter amount" /></div><div className="space-y-2"><Label htmlFor="incentive-note">Note (optional)</Label><Input id="incentive-note" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. July conversion bonus" /></div></div><DialogFooter><Button variant="outline" onClick={() => setSelected(null)}>Not now</Button><Button disabled={grant.isPending || Number(amount) <= 0} onClick={() => grant.mutate()} className="bg-terracotta text-accent-foreground hover:bg-terracotta/90">{grant.isPending ? "Granting…" : "Confirm & grant"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Sparkles; label: string; value: string | number; tone: string }) { return <div className="rounded-2xl border bg-card p-5"><Icon className={`h-5 w-5 ${tone}`} /><p className="mt-4 text-sm text-muted-foreground">{label}</p><p className={`mt-1 text-2xl text-display ${tone}`}>{value}</p></div>; }
function Status({ granted = false }: { granted?: boolean }) { return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${granted ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{granted ? "Granted" : "Awaiting grant"}</span>; }
function EmptyState({ title, description }: { title: string; description: string }) { return <div className="py-12 text-center"><Sparkles className="mx-auto mb-3 h-7 w-7 text-muted-foreground" /><p className="font-medium">{title}</p><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>; }
