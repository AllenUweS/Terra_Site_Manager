import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Landmark,
  ArrowRightLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Search,
  Wallet,
  TrendingUp,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  History,
  RotateCcw,
  Loader2,
  ShieldCheck,
  Coins,
  Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/treasury")({
  component: TreasuryPage,
});

const money = (val: number) =>
  `₹${Number(val || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export function TreasuryPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();

  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [repayModalOpen, setRepayModalOpen] = useState(false);
  const [activeTransfer, setActiveTransfer] = useState<any | null>(null);

  const [sourceProjectId, setSourceProjectId] = useState("");
  const [targetProjectId, setTargetProjectId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferPurpose, setTransferPurpose] = useState("");
  const [repaymentDueDate, setRepaymentDueDate] = useState("");

  const [repayAmount, setRepayAmount] = useState("");
  const [repayNotes, setRepayNotes] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "repaid">("all");

  // User role check
  const { data: role } = useQuery({
    queryKey: ["role", user.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_primary_role", { _user_id: user.id });
      return (data as string) ?? "employee";
    },
  });

  const isManagementOrAdmin =
    role === "admin" || role === "super_admin" || role === "management";

  // Fetch Profiles
  const { data: profiles = [] } = useQuery({
    queryKey: ["treasury-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch Projects
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
    queryKey: ["treasury-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, plots(id, price, status)")
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch Bookings
  const { data: bookings = [] } = useQuery({
    queryKey: ["treasury-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, plots(project_id)")
        .in("status", ["pending", "approved", "on_hold"]);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch Inter-Project Transfers
  const { data: rawTransfers = [], isLoading: isLoadingTransfers, error: transfersError } = useQuery({
    queryKey: ["project-fund-transfers"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("project_fund_transfers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Error fetching project_fund_transfers:", error);
        return [];
      }
      return data ?? [];
    },
  });

  // Fetch All Repayments to ensure 100% accurate live sum calculation
  const { data: allRepayments = [] } = useQuery({
    queryKey: ["project-transfer-repayments-all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("project_transfer_repayments")
        .select("*");
      if (error) return [];
      return data ?? [];
    },
  });

  // Map projects & profiles to transfers locally with dynamic repayment sums
  const transfers = useMemo(() => {
    const projectMap = new Map(projects.map((p: any) => [p.id, p]));
    const profileMap = new Map(profiles.map((pr: any) => [pr.id, pr]));

    // Map repayments by transfer_id
    const repaymentSums = new Map<string, number>();
    allRepayments.forEach((r: any) => {
      const current = repaymentSums.get(r.transfer_id) || 0;
      repaymentSums.set(r.transfer_id, current + Number(r.amount || 0));
    });

    return rawTransfers.map((t: any) => {
      const repaidFromTable = repaymentSums.get(t.id) || 0;
      const effectiveRepaid = Math.max(Number(t.repaid_amount || 0), repaidFromTable);
      const isFullyPaid = effectiveRepaid >= Number(t.amount || 0);

      return {
        ...t,
        repaid_amount: effectiveRepaid,
        status: isFullyPaid ? "repaid" : effectiveRepaid > 0 ? "partially_repaid" : (t.status || "active"),
        source_project: projectMap.get(t.source_project_id),
        target_project: projectMap.get(t.target_project_id),
        profile: profileMap.get(t.transferred_by),
      };
    });
  }, [rawTransfers, projects, profiles, allRepayments]);

  // Project Financial Metrics Computation
  const projectMetrics = useMemo(() => {
    return projects.map((p: any) => {
      const projectBookings = bookings.filter((b: any) => b.plots?.project_id === p.id);
      const totalAgreedRevenue = projectBookings.reduce(
        (sum: number, b: any) => sum + Number(b.total_price || 0),
        0
      );
      const totalCollected = projectBookings.reduce(
        (sum: number, b: any) => sum + Number(b.advance_paid || 0),
        0
      );
      const totalOutstanding = Math.max(0, totalAgreedRevenue - totalCollected);

      // Inter-project transfer & repayment calculations
      const initialOutgoing = transfers
        .filter((t: any) => t.source_project_id === p.id)
        .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);

      const initialIncoming = transfers
        .filter((t: any) => t.target_project_id === p.id)
        .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);

      const repaymentsRecoveredBack = transfers
        .filter((t: any) => t.source_project_id === p.id)
        .reduce((sum: number, t: any) => sum + Number(t.repaid_amount || 0), 0);

      const repaymentsReturnedOut = transfers
        .filter((t: any) => t.target_project_id === p.id)
        .reduce((sum: number, t: any) => sum + Number(t.repaid_amount || 0), 0);

      const netOutgoing = Math.max(0, initialOutgoing - repaymentsRecoveredBack);
      const netIncoming = Math.max(0, initialIncoming - repaymentsReturnedOut);

      const netCapitalShift = netIncoming - netOutgoing;
      const netAvailableTreasury = Math.max(0, totalCollected + netCapitalShift);

      return {
        ...p,
        totalAgreedRevenue,
        totalCollected,
        totalOutstanding,
        initialOutgoing,
        initialIncoming,
        repaymentsRecoveredBack,
        repaymentsReturnedOut,
        netOutgoing,
        netIncoming,
        netCapitalShift,
        netAvailableTreasury,
      };
    });
  }, [projects, bookings, transfers]);

  // Overall Portfolio Totals
  const portfolioStats = useMemo(() => {
    const totalAgreed = projectMetrics.reduce((sum, p) => sum + p.totalAgreedRevenue, 0);
    const totalCollected = projectMetrics.reduce((sum, p) => sum + p.totalCollected, 0);
    const totalOutstanding = projectMetrics.reduce((sum, p) => sum + p.totalOutstanding, 0);
    const activeTransfersAmount = transfers
      .filter((t: any) => t.status !== "repaid")
      .reduce((sum: number, t: any) => sum + (Number(t.amount) - Number(t.repaid_amount || 0)), 0);

    return {
      totalAgreed,
      totalCollected,
      totalOutstanding,
      activeTransfersAmount,
    };
  }, [projectMetrics, transfers]);

  // Create Fund Transfer Mutation
  const createTransferMutation = useMutation({
    mutationFn: async () => {
      const amt = Number(transferAmount);
      if (!sourceProjectId || !targetProjectId) throw new Error("Select both source and target projects");
      if (sourceProjectId === targetProjectId) throw new Error("Source and target projects cannot be the same");
      if (isNaN(amt) || amt <= 0) throw new Error("Enter a valid transfer amount");

      const { error } = await (supabase as any).from("project_fund_transfers").insert({
        source_project_id: sourceProjectId,
        target_project_id: targetProjectId,
        amount: amt,
        purpose: transferPurpose || null,
        repayment_due_date: repaymentDueDate || null,
        transferred_by: user.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Inter-project fund transfer recorded successfully!");
      setTransferModalOpen(false);
      setSourceProjectId("");
      setTargetProjectId("");
      setTransferAmount("");
      setTransferPurpose("");
      setRepaymentDueDate("");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to complete fund transfer"),
  });

  // Create Repayment Mutation
  const repayTransferMutation = useMutation({
    mutationFn: async () => {
      if (!activeTransfer) return;
      const amt = Number(repayAmount);
      const remaining = Number(activeTransfer.amount) - Number(activeTransfer.repaid_amount || 0);

      if (isNaN(amt) || amt <= 0) throw new Error("Enter a valid repayment amount");
      if (amt > remaining) throw new Error(`Repayment cannot exceed remaining balance of ${money(remaining)}`);

      // 1. Insert repayment record
      const { error: rErr } = await (supabase as any).from("project_transfer_repayments").insert({
        transfer_id: activeTransfer.id,
        amount: amt,
        repaid_by: user.id,
        notes: repayNotes || null,
      });
      if (rErr) throw rErr;

      // 2. Update transfer record
      const newRepaidTotal = Number(activeTransfer.repaid_amount || 0) + amt;
      const isFullyRepaid = newRepaidTotal >= Number(activeTransfer.amount);

      const { error: tErr } = await (supabase as any)
        .from("project_fund_transfers")
        .update({
          repaid_amount: newRepaidTotal,
          status: isFullyRepaid ? "repaid" : "partially_repaid",
          updated_at: new Date().toISOString(),
        })
        .eq("id", activeTransfer.id);

      if (tErr) throw tErr;
    },
    onSuccess: () => {
      toast.success("Fund repayment recorded successfully!");
      setRepayModalOpen(false);
      setActiveTransfer(null);
      setRepayAmount("");
      setRepayNotes("");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to record repayment"),
  });

  // Filtered Transfers
  const filteredTransfers = transfers.filter((t: any) => {
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && t.status !== "repaid") ||
      (statusFilter === "repaid" && t.status === "repaid");

    const searchTerms = `${t.source_project?.name || ""} ${t.target_project?.name || ""} ${t.purpose || ""}`.toLowerCase();
    return matchesStatus && searchTerms.includes(search.trim().toLowerCase());
  });

  if (!isManagementOrAdmin) {
    return (
      <div className="p-12 text-center space-y-4">
        <ShieldCheck className="h-12 w-12 text-muted-foreground mx-auto" />
        <h2 className="text-xl font-bold">Management Access Required</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          The Treasury & Inter-Project Fund Transfer hub is restricted to Executive Management and Admins.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Landmark className="h-3 w-3" /> Management Hub
            </span>
          </div>
          <h1 className="text-display text-4xl mt-2 font-bold tracking-tight">
            Treasury & Fund Transfers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time project revenue performance, treasury reserves, and inter-project capital reallocations.
          </p>
        </div>

        <Button
          onClick={() => setTransferModalOpen(true)}
          className="bg-purple-700 hover:bg-purple-800 text-white gap-2 font-medium shadow-md"
        >
          <ArrowRightLeft className="h-4 w-4" /> Transfer Funds Between Projects
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border bg-card p-5 space-y-1 shadow-xs">
          <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 font-medium">
            <Coins className="h-3.5 w-3.5 text-purple-500" /> Total Agreed Revenue
          </p>
          <p className="text-2xl text-display font-semibold">{money(portfolioStats.totalAgreed)}</p>
          <p className="text-xs text-muted-foreground">Booked revenue across all projects</p>
        </div>

        <div className="rounded-2xl border bg-card p-5 space-y-1 shadow-xs">
          <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 font-medium">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> Total Collections
          </p>
          <p className="text-2xl text-display font-semibold text-emerald-600 dark:text-emerald-400">
            {money(portfolioStats.totalCollected)}
          </p>
          <p className="text-xs text-muted-foreground">Realized cash in hand</p>
        </div>

        <div className="rounded-2xl border bg-card p-5 space-y-1 shadow-xs">
          <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 font-medium">
            <Wallet className="h-3.5 w-3.5 text-terracotta" /> Outstanding Receivables
          </p>
          <p className="text-2xl text-display font-semibold text-terracotta">
            {money(portfolioStats.totalOutstanding)}
          </p>
          <p className="text-xs text-muted-foreground">Pending installment payments</p>
        </div>

        <div className="rounded-2xl border bg-card p-5 space-y-1 shadow-xs">
          <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 font-medium">
            <ArrowRightLeft className="h-3.5 w-3.5 text-blue-500" /> Active Inter-Project Loans
          </p>
          <p className="text-2xl text-display font-semibold text-blue-600 dark:text-blue-400">
            {money(portfolioStats.activeTransfersAmount)}
          </p>
          <p className="text-xs text-muted-foreground">Reallocated capital pending repayment</p>
        </div>
      </div>

      {/* Projects Financial Revenue Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="h-5 w-5 text-purple-600" /> Project Treasury Balances
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live revenue performance and net capital availability for each development project.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projectMetrics.map((p) => {
            return (
              <div
                key={p.id}
                className="rounded-2xl border bg-card p-5 flex flex-col justify-between hover:border-purple-500/40 transition-all shadow-xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-border/50">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                        {p.code}
                      </span>
                      <h3 className="font-semibold text-base truncate">{p.name}</h3>
                    </div>
                    <Badge variant="outline" className="text-[11px] uppercase font-medium">
                      {p.plots?.length || 0} Plots
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 py-4 text-xs">
                    <div>
                      <p className="text-muted-foreground">Agreed Revenue</p>
                      <p className="font-semibold text-sm mt-0.5">{money(p.totalAgreedRevenue)}</p>
                    </div>

                    <div>
                      <p className="text-muted-foreground">Collected Cash</p>
                      <p className="font-semibold text-sm mt-0.5 text-emerald-600 dark:text-emerald-400">
                        {money(p.totalCollected)}
                      </p>
                    </div>

                    <div>
                      <p className="text-muted-foreground">Outstanding</p>
                      <p className="font-medium mt-0.5">{money(p.totalOutstanding)}</p>
                    </div>

                    <div>
                      <p className="text-muted-foreground">Net Inter-Project Capital</p>
                      <p
                        className={`font-semibold mt-0.5 flex items-center gap-0.5 ${
                          p.netCapitalShift > 0
                            ? "text-emerald-600"
                            : p.netCapitalShift < 0
                            ? "text-terracotta"
                            : "text-muted-foreground"
                        }`}
                      >
                        {p.netCapitalShift > 0 ? (
                          <>
                            <ArrowDownLeft className="h-3 w-3" /> +{money(p.netCapitalShift)}
                          </>
                        ) : p.netCapitalShift < 0 ? (
                          <>
                            <ArrowUpRight className="h-3 w-3" /> −{money(Math.abs(p.netCapitalShift))}
                          </>
                        ) : (
                          "₹0"
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-border/50 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-medium">
                      Net Available Treasury
                    </p>
                    <p className="text-lg font-bold text-purple-700 dark:text-purple-300">
                      {money(p.netAvailableTreasury)}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSourceProjectId(p.id);
                      setTransferModalOpen(true);
                    }}
                    className="text-xs text-purple-600 border-purple-500/30 hover:bg-purple-500/10 gap-1"
                  >
                    <ArrowRightLeft className="h-3 w-3" /> Transfer Funds
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Inter-Project Fund Transfer History Ledger */}
      <section className="rounded-2xl border bg-card overflow-hidden">
        <div className="p-5 border-b flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-purple-600" />
            <div>
              <h2 className="font-semibold text-lg">Inter-Project Fund Transfers Ledger</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Audit trail of capital allocations, target repayment dates, and fund return tracking.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-48 sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search projects or notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-xs h-8"
              />
            </div>

            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="h-8 text-xs w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Transfers</SelectItem>
                <SelectItem value="active">Active Loans</SelectItem>
                <SelectItem value="repaid">Fully Repaid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table / List */}
        <div className="divide-y divide-border/60">
          {isLoadingTransfers ? (
            <p className="p-8 text-sm text-muted-foreground">Loading transfers ledger...</p>
          ) : filteredTransfers.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <RotateCcw className="h-8 w-8 text-muted-foreground/40 mx-auto" />
              <p className="text-sm font-medium text-muted-foreground">No fund transfers found</p>
              <p className="text-xs text-muted-foreground/70">
                Please make sure you have executed the migration script in Supabase, then click "Transfer Funds Between Projects".
              </p>
            </div>
          ) : (
            filteredTransfers.map((t: any) => {
              const remaining = Number(t.amount) - Number(t.repaid_amount || 0);
              const isRepaid = t.status === "repaid" || remaining <= 0;

              return (
                <div key={t.id} className="p-5 hover:bg-muted/20 transition-colors">
                  <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr_auto] lg:items-center">
                    {/* Project Pair */}
                    <div>
                      <div className="flex items-center gap-2 font-semibold text-sm">
                        <span className="text-terracotta">{t.source_project?.name || "Source Project"}</span>
                        <ArrowRightLeft className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {t.target_project?.name || "Target Project"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                        <span>Transferred by {t.profile?.full_name || "Management User"}</span>
                        <span>•</span>
                        <span>{new Date(t.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                      </p>
                      {t.purpose && (
                        <p className="text-xs text-muted-foreground/90 mt-1.5 italic bg-muted/40 p-2 rounded-md">
                          "{t.purpose}"
                        </p>
                      )}
                    </div>

                    {/* Amount & Status */}
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Original Transfer Amount</p>
                      <p className="text-lg font-bold mt-0.5">{money(Number(t.amount))}</p>
                      <div className="mt-1 flex items-center gap-2">
                        {isRepaid ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
                            Fully Repaid
                          </Badge>
                        ) : t.repaid_amount > 0 ? (
                          <Badge className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 text-[10px]">
                            Partially Repaid
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px]">
                            Active Loan
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Amount Repaid & Remaining Balance */}
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Amount Repaid / Sent Back</p>
                      <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {Number(t.repaid_amount || 0) > 0 ? `+${money(Number(t.repaid_amount))}` : "₹0 Sent Back"}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Net Due: <strong className={remaining > 0 ? "text-terracotta font-semibold" : "text-emerald-600"}>{remaining > 0 ? money(remaining) : "₹0 Settled"}</strong>
                      </p>
                    </div>

                    {/* Repay Action Button */}
                    <div className="flex items-center gap-2">
                      <Link
                        to="/treasury/$transferId"
                        params={{ transferId: t.id }}
                        className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" /> Inspect Flow
                      </Link>

                      {!isRepaid ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            setActiveTransfer(t);
                            setRepayAmount(String(remaining));
                            setRepayModalOpen(true);
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Repay Funds Back
                        </Button>
                      ) : (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                          <CheckCircle2 className="h-4 w-4" /> Settled
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Inter-Project Fund Transfer Modal */}
      <Dialog open={transferModalOpen} onOpenChange={setTransferModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-600">
              <ArrowRightLeft className="h-5 w-5" /> Inter-Project Fund Transfer
            </DialogTitle>
            <DialogDescription>
              Reallocate funds from a project with surplus treasury to another project in need of capital.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Source Project (From)</Label>
                <Select value={sourceProjectId} onValueChange={setSourceProjectId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select Source Project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Target Project (To)</Label>
                <Select value={targetProjectId} onValueChange={setTargetProjectId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select Target Project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id} disabled={p.id === sourceProjectId}>
                        {p.name} ({p.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Transfer Amount (₹)</Label>
              <Input
                type="number"
                min="1"
                placeholder="e.g. 500000"
                className="mt-1"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Repayment Target Date (Optional)</Label>
              <Input
                type="date"
                className="mt-1"
                value={repaymentDueDate}
                onChange={(e) => setRepaymentDueDate(e.target.value)}
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Transfer Purpose / Reason</Label>
              <Textarea
                rows={2}
                placeholder="e.g. Infrastructure development, road paving, or interim land acquisition"
                className="mt-1 text-xs"
                value={transferPurpose}
                onChange={(e) => setTransferPurpose(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setTransferModalOpen(false)}
              disabled={createTransferMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => createTransferMutation.mutate()}
              disabled={
                createTransferMutation.isPending ||
                !sourceProjectId ||
                !targetProjectId ||
                !transferAmount
              }
              className="bg-purple-700 hover:bg-purple-800 text-white"
            >
              {createTransferMutation.isPending ? "Executing Transfer..." : "Confirm & Transfer Funds"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Repay Fund Modal */}
      <Dialog open={repayModalOpen} onOpenChange={(open) => !open && setRepayModalOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <RotateCcw className="h-5 w-5" /> Repay Funds Back to Source
            </DialogTitle>
            <DialogDescription>
              Return capital from {activeTransfer?.target_project?.name || "Target Project"} back to {activeTransfer?.source_project?.name || "Source Project"}.
            </DialogDescription>
          </DialogHeader>

          {activeTransfer && (
            <div className="space-y-4">
              <div className="rounded-xl border p-3.5 bg-muted/20 space-y-1 text-xs">
                <p className="text-muted-foreground uppercase tracking-wider font-semibold text-[10px]">Transfer Summary</p>
                <p className="font-semibold text-sm">
                  {activeTransfer.source_project?.name || "Source"} ➔ {activeTransfer.target_project?.name || "Target"}
                </p>
                <p className="text-muted-foreground">
                  Original Loan: {money(Number(activeTransfer.amount))} • Already Repaid: {money(Number(activeTransfer.repaid_amount || 0))}
                </p>
                <p className="font-bold text-terracotta text-sm mt-1">
                  Remaining Due: {money(Number(activeTransfer.amount) - Number(activeTransfer.repaid_amount || 0))}
                </p>
              </div>

              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Repayment Amount (₹)</Label>
                <Input
                  type="number"
                  min="1"
                  max={Number(activeTransfer.amount) - Number(activeTransfer.repaid_amount || 0)}
                  className="mt-1"
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Repayment Notes (Optional)</Label>
                <Input
                  placeholder="e.g. Returned after Phase 2 customer collections"
                  className="mt-1 text-xs"
                  value={repayNotes}
                  onChange={(e) => setRepayNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRepayModalOpen(false)}
              disabled={repayTransferMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => repayTransferMutation.mutate()}
              disabled={repayTransferMutation.isPending || !repayAmount}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {repayTransferMutation.isPending ? "Recording Repayment..." : "Confirm Repayment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
