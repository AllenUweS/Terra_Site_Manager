import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  FolderKanban,
  MapPin,
  ClipboardCheck,
  IndianRupee,
  TrendingUp,
  Users,
  Sparkles,
  Calendar,
  MessageSquare,
  Clock,
  ArrowRight,
  Activity,
  Award,
  Target,
  Zap,
  Edit3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, formatDistanceToNow, startOfMonth, endOfMonth, subMonths } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useRouteContext();

  const [monthlyTarget, setMonthlyTarget] = useState<number>(() => {
    const saved = localStorage.getItem("terra_monthly_target");
    return saved ? Number(saved) : 5000000;
  });
  const [targetDialogOpen, setTargetDialogOpen] = useState(false);
  const [inputTarget, setInputTarget] = useState(String(monthlyTarget));

  const { data: role } = useQuery({
    queryKey: ["role", user.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_primary_role", { _user_id: user.id });
      return (data as string) ?? "employee";
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", role],
    enabled: !!role,
    queryFn: async () => {
      const [projects, plots, bookings, leads, messages, incentives, profiles] = await Promise.all([
        supabase.from("projects").select("id, status, created_at"),
        supabase.from("plots").select("id, status, price, project_id"),
        supabase.from("bookings").select("id, status, total_price, booking_amount, booking_date, created_at, sales_executive_id"),
        supabase.from("plot_leads").select("id, name, status, created_at"),
        supabase.from("contact_messages").select("id, status, created_at"),
        supabase.from("incentive_grants").select("id, amount, granted_at"),
        supabase.from("profiles").select("id, full_name, role"),
      ]);

      const p = projects.data ?? [];
      const pl = plots.data ?? [];
      const b = bookings.data ?? [];
      const l = leads.data ?? [];
      const m = messages.data ?? [];
      const i = incentives.data ?? [];
      const prof = profiles.data ?? [];

      // Calculate monthly revenue
      const now = new Date();
      const thisMonthStart = startOfMonth(now);
      const thisMonthEnd = endOfMonth(now);
      const lastMonthStart = startOfMonth(subMonths(now, 1));
      const lastMonthEnd = endOfMonth(subMonths(now, 1));

      const thisMonthRevenue = b
        .filter((x) => {
          const date = new Date(x.created_at);
          return x.status === "approved" && date >= thisMonthStart && date <= thisMonthEnd;
        })
        .reduce((s, x) => s + Number(x.total_price ?? 0), 0);

      const lastMonthRevenue = b
        .filter((x) => {
          const date = new Date(x.created_at);
          return x.status === "approved" && date >= lastMonthStart && date <= lastMonthEnd;
        })
        .reduce((s, x) => s + Number(x.total_price ?? 0), 0);

      const revenueGrowth = lastMonthRevenue > 0
        ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : 0;

      return {
        totalProjects: p.length,
        liveProjects: p.filter((x) => x.status === "live").length,
        upcomingProjects: p.filter((x) => x.status === "upcoming").length,
        totalPlots: pl.length,
        availablePlots: pl.filter((x) => x.status === "available").length,
        bookedPlots: pl.filter((x) => x.status === "booked" || x.status === "sold").length,
        pendingPlots: pl.filter((x) => x.status === "pending").length,
        totalBookings: b.length,
        approvedBookings: b.filter((x) => x.status === "approved").length,
        pendingBookings: b.filter((x) => x.status === "pending").length,
        totalRevenue: b.filter((x) => x.status === "approved").reduce((s, x) => s + Number(x.total_price ?? 0), 0),
        thisMonthRevenue,
        lastMonthRevenue,
        revenueGrowth,
        totalLeads: l.length,
        newLeads: l.filter((x) => x.status === "new").length,
        qualifiedLeads: l.filter((x) => x.status === "qualified").length,
        totalMessages: m.length,
        unreadMessages: m.filter((x) => x.status === "new").length,
        totalIncentivesPaid: i.reduce((s, x) => s + Number(x.amount), 0),
        totalEmployees: prof.filter((x) => x.role === "employee").length,
        recentBookings: b.slice(0, 5),
        recentLeads: l.slice(0, 5),
      };
    },
  });

  const isAdmin = role === "admin" || role === "super_admin";
  const isManager = role === "manager";
  const canSetTarget = isAdmin || isManager;

  const saveTarget = () => {
    const num = Number(inputTarget);
    if (!isNaN(num) && num > 0) {
      setMonthlyTarget(num);
      localStorage.setItem("terra_monthly_target", String(num));
      setTargetDialogOpen(false);
      toast.success(`Monthly sales target set to ${money(num)}`);
    } else {
      toast.error("Please enter a valid target amount");
    }
  };

  const achievementPercent = Math.min(100, Math.round(((stats?.thisMonthRevenue ?? 0) / monthlyTarget) * 100));

  const money = (amount: number) => `₹${(amount / 100000).toFixed(1)}L`;
  const formatMoney = (amount: number) => `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Dashboard</p>
          <h1 className="mt-1 text-display text-4xl">
            {format(new Date(), "EEEE, MMMM d")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Welcome back! Here's what's happening today.
          </p>
        </div>
        {role && (
          <Badge className="bg-terracotta/10 text-terracotta border-terracotta/20">
            {role.replace("_", " ")}
          </Badge>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-border/50 hover:border-terracotta/40 hover:-translate-y-0.5 transition-all duration-300 shadow-xs hover:shadow-md group">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-semibold text-display mt-1 text-ink dark:text-foreground">
                  {money(stats?.totalRevenue ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {stats?.revenueGrowth && stats.revenueGrowth > 0 ? (
                    <span className="text-emerald-600 font-medium">↑ {stats.revenueGrowth.toFixed(0)}% vs last month</span>
                  ) : (
                    <span className="text-muted-foreground">All time</span>
                  )}
                </p>
              </div>
              <div className="rounded-lg bg-terracotta/10 p-2.5 text-terracotta group-hover:bg-terracotta group-hover:text-white transition-colors duration-300">
                <IndianRupee className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50 hover:border-terracotta/40 hover:-translate-y-0.5 transition-all duration-300 shadow-xs hover:shadow-md group">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Active Bookings</p>
                <p className="text-2xl font-semibold text-display mt-1 text-ink dark:text-foreground">{stats?.approvedBookings ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {stats?.pendingBookings && stats.pendingBookings > 0 ? (
                    <span className="text-terracotta font-medium">{stats.pendingBookings} pending approval</span>
                  ) : (
                    <span>No pending approvals</span>
                  )}
                </p>
              </div>
              <div className="rounded-lg bg-terracotta/10 p-2.5 text-terracotta group-hover:bg-terracotta group-hover:text-white transition-colors duration-300">
                <ClipboardCheck className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50 hover:border-terracotta/40 hover:-translate-y-0.5 transition-all duration-300 shadow-xs hover:shadow-md group">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Available Plots</p>
                <p className="text-2xl font-semibold text-display mt-1 text-ink dark:text-foreground">{stats?.availablePlots ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  <span className="font-medium text-ink/75 dark:text-foreground/75">{stats?.bookedPlots ?? 0}</span> already sold
                </p>
              </div>
              <div className="rounded-lg bg-terracotta/10 p-2.5 text-terracotta group-hover:bg-terracotta group-hover:text-white transition-colors duration-300">
                <MapPin className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50 hover:border-terracotta/40 hover:-translate-y-0.5 transition-all duration-300 shadow-xs hover:shadow-md group">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">New Leads</p>
                <p className="text-2xl font-semibold text-display mt-1 text-ink dark:text-foreground">{stats?.newLeads ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  <span className="font-medium text-ink/75 dark:text-foreground/75">{stats?.qualifiedLeads ?? 0}</span> qualified leads
                </p>
              </div>
              <div className="rounded-lg bg-terracotta/10 p-2.5 text-terracotta group-hover:bg-terracotta group-hover:text-white transition-colors duration-300">
                <Users className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Overview */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-terracotta" />
                Sales Performance
              </CardTitle>
              <CardDescription>
                {canSetTarget
                  ? `Monthly target: ${money(monthlyTarget)} (click Set Target to change)`
                  : `Monthly target set by management: ${money(monthlyTarget)}`}
              </CardDescription>
            </div>
            {canSetTarget ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setInputTarget(String(monthlyTarget));
                  setTargetDialogOpen(true);
                }}
                className="h-8 text-xs border-terracotta/30 text-terracotta hover:bg-terracotta/10 cursor-pointer"
              >
                <Edit3 className="h-3.5 w-3.5 mr-1" />
                Set Target
              </Button>
            ) : (
              <Badge variant="outline" className="text-xs font-normal">
                Target: {money(monthlyTarget)}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium">
                  Monthly Target Achievement ({formatMoney(stats?.thisMonthRevenue ?? 0)} of {formatMoney(monthlyTarget)})
                </span>
                <span className="font-semibold text-terracotta">
                  {achievementPercent}%
                </span>
              </div>
              <Progress
                value={achievementPercent}
                className="h-2.5"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <p className="text-2xl font-semibold text-display text-terracotta">
                  {formatMoney(stats?.thisMonthRevenue ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">This Month</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <p className="text-2xl font-semibold text-display">
                  {formatMoney(stats?.lastMonthRevenue ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Last Month</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <p className="text-2xl font-semibold text-display">
                  {stats?.approvedBookings ?? 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Total Bookings</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-terracotta" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Live Projects</span>
              <Badge variant="secondary">{stats?.liveProjects ?? 0}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Plots</span>
              <Badge variant="secondary">{stats?.totalPlots ?? 0}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Team Size</span>
              <Badge variant="secondary">{stats?.totalEmployees ?? 0}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Pending Messages</span>
              <Badge variant={stats?.unreadMessages ? "default" : "secondary"}>
                {stats?.unreadMessages ?? 0}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Incentives Paid</span>
              <Badge variant="secondary">{formatMoney(stats?.totalIncentivesPaid ?? 0)}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="border border-border/50 shadow-xs">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-ink dark:text-foreground">
            <Zap className="h-5 w-5 text-terracotta" />
            Quick Actions
          </CardTitle>
          <CardDescription>Frequently used tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link to="/projects">
              <Button variant="outline" className="w-full justify-start h-auto py-3.5 hover:border-terracotta/40 hover:bg-terracotta/[0.02] transition-colors cursor-pointer group">
                <FolderKanban className="h-5 w-5 mr-3 text-terracotta transition-transform group-hover:scale-110" />
                <div className="text-left">
                  <p className="font-semibold text-sm">Browse Projects</p>
                  <p className="text-xs text-muted-foreground mt-0.5">View all projects</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-terracotta" />
              </Button>
            </Link>
            <Link to="/bookings">
              <Button variant="outline" className="w-full justify-start h-auto py-3.5 hover:border-terracotta/40 hover:bg-terracotta/[0.02] transition-colors cursor-pointer group">
                <ClipboardCheck className="h-5 w-5 mr-3 text-terracotta transition-transform group-hover:scale-110" />
                <div className="text-left">
                  <p className="font-semibold text-sm">Manage Bookings</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stats?.pendingBookings ?? 0} pending</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-terracotta" />
              </Button>
            </Link>
            <Link to="/leads">
              <Button variant="outline" className="w-full justify-start h-auto py-3.5 hover:border-terracotta/40 hover:bg-terracotta/[0.02] transition-colors cursor-pointer group">
                <Users className="h-5 w-5 mr-3 text-terracotta transition-transform group-hover:scale-110" />
                <div className="text-left">
                  <p className="font-semibold text-sm">View Leads</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stats?.newLeads ?? 0} new leads</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-terracotta" />
              </Button>
            </Link>
            <Link to="/messages">
              <Button variant="outline" className="w-full justify-start h-auto py-3.5 hover:border-terracotta/40 hover:bg-terracotta/[0.02] transition-colors cursor-pointer group">
                <MessageSquare className="h-5 w-5 mr-3 text-terracotta transition-transform group-hover:scale-110" />
                <div className="text-left">
                  <p className="font-semibold text-sm">Messages</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stats?.unreadMessages ?? 0} unread</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-terracotta" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border border-border/50 shadow-xs hover:border-terracotta/20 transition-colors duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-ink dark:text-foreground">
              <Calendar className="h-5 w-5 text-terracotta" />
              Recent Bookings
            </CardTitle>
            <CardDescription>Latest plot bookings</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.recentBookings && stats.recentBookings.length > 0 ? (
              <div className="space-y-4">
                {stats.recentBookings.map((booking: any) => (
                  <div key={booking.id} className="flex items-center gap-3 text-sm pb-3 border-b border-border/30 last:border-0 last:pb-0">
                    <Avatar className="h-9 w-9 border border-border/50">
                      <AvatarFallback className="bg-gradient-to-br from-terracotta to-amber-600 text-white text-xs font-medium">
                        {getInitials(booking.customer_name || "Customer")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink dark:text-foreground truncate">{booking.customer_name || "Customer"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatMoney(booking.total_price || 0)}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`shrink-0 capitalize font-medium ${
                        booking.status === "approved"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200/50 dark:bg-emerald-950/30 dark:text-emerald-400"
                          : "bg-terracotta/5 text-terracotta border-terracotta/20"
                      }`}
                    >
                      {booking.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No recent bookings</p>
            )}
            <Link to="/bookings">
              <Button variant="ghost" className="w-full mt-4 text-xs font-semibold uppercase tracking-[0.1em] text-terracotta hover:bg-terracotta/5 hover:text-terracotta cursor-pointer">
                View all bookings →
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border border-border/50 shadow-xs hover:border-terracotta/20 transition-colors duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-ink dark:text-foreground">
              <Sparkles className="h-5 w-5 text-terracotta" />
              Recent Leads
            </CardTitle>
            <CardDescription>Latest customer inquiries</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.recentLeads && stats.recentLeads.length > 0 ? (
              <div className="space-y-4">
                {stats.recentLeads.map((lead: any) => (
                  <div key={lead.id} className="flex items-center gap-3 text-sm pb-3 border-b border-border/30 last:border-0 last:pb-0">
                    <Avatar className="h-9 w-9 border border-border/50">
                      <AvatarFallback className="bg-gradient-to-br from-ink to-terracotta text-white text-xs font-medium">
                        {getInitials(lead.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink dark:text-foreground truncate">{lead.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`shrink-0 capitalize font-medium ${
                        lead.status === "new"
                          ? "bg-terracotta/10 text-terracotta border-terracotta/25"
                          : "bg-muted text-muted-foreground border-border/50"
                      }`}
                    >
                      {lead.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No recent leads</p>
            )}
            <Link to="/leads">
              <Button variant="ghost" className="w-full mt-4 text-xs font-semibold uppercase tracking-[0.1em] text-terracotta hover:bg-terracotta/5 hover:text-terracotta cursor-pointer">
                View all leads →
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Role-specific content */}
      {(role === "admin" || role === "super_admin" || role === "manager") && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link to="/incentives">
            <Card className="transition-shadow hover:shadow-md cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-amber-100 p-2">
                    <Award className="h-5 w-5 text-amber-700" />
                  </div>
                  <div>
                    <p className="font-semibold">Grant Incentives</p>
                    <p className="text-xs text-muted-foreground">Reward team performance</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/team">
            <Card className="transition-shadow hover:shadow-md cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-blue-100 p-2">
                    <Users className="h-5 w-5 text-blue-700" />
                  </div>
                  <div>
                    <p className="font-semibold">Manage Team</p>
                    <p className="text-xs text-muted-foreground">{stats?.totalEmployees ?? 0} employees</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/visit-proofs">
            <Card className="transition-shadow hover:shadow-md cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-emerald-100 p-2">
                    <MapPin className="h-5 w-5 text-emerald-700" />
                  </div>
                  <div>
                    <p className="font-semibold">Visit Proofs</p>
                    <p className="text-xs text-muted-foreground">Review GPS evidence</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}

      {/* SET TARGET DIALOG */}
      <Dialog open={targetDialogOpen} onOpenChange={setTargetDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-terracotta" />
              Set Monthly Sales Target
            </DialogTitle>
            <DialogDescription>
              As an Admin / Manager, you can set the monthly revenue target for your sales team.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Monthly Target Amount (₹)
              </Label>
              <Input
                type="number"
                min="100000"
                step="500000"
                value={inputTarget}
                onChange={(e) => setInputTarget(e.target.value)}
                className="mt-1.5 h-11 text-base font-semibold"
                placeholder="e.g. 5000000 for ₹50 Lakhs"
              />
              <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
                <span>Presets:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setInputTarget("2500000")}
                    className="px-2 py-1 rounded bg-muted hover:bg-terracotta/10 hover:text-terracotta text-xs font-medium cursor-pointer transition-colors"
                  >
                    ₹25L
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputTarget("5000000")}
                    className="px-2 py-1 rounded bg-muted hover:bg-terracotta/10 hover:text-terracotta text-xs font-medium cursor-pointer transition-colors"
                  >
                    ₹50L
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputTarget("10000000")}
                    className="px-2 py-1 rounded bg-muted hover:bg-terracotta/10 hover:text-terracotta text-xs font-medium cursor-pointer transition-colors"
                  >
                    ₹1 Cr
                  </button>
                </div>
              </div>
            </div>

            <Button onClick={saveTarget} className="w-full h-11 bg-terracotta text-white font-medium hover:bg-terracotta/90 text-sm cursor-pointer shadow-md">
              Save Monthly Target
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
