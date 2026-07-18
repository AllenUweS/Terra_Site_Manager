import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format, formatDistanceToNow, startOfMonth, endOfMonth, subMonths } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useRouteContext();

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
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-semibold text-display mt-1">
                  {money(stats?.totalRevenue ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.revenueGrowth && stats.revenueGrowth > 0 ? (
                    <span className="text-emerald-600">↑ {stats.revenueGrowth.toFixed(0)}% vs last month</span>
                  ) : (
                    <span className="text-muted-foreground">All time</span>
                  )}
                </p>
              </div>
              <div className="rounded-full bg-blue-100 p-2">
                <IndianRupee className="h-4 w-4 text-blue-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Active Bookings</p>
                <p className="text-2xl font-semibold text-display mt-1">{stats?.approvedBookings ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.pendingBookings ?? 0} pending approval
                </p>
              </div>
              <div className="rounded-full bg-emerald-100 p-2">
                <ClipboardCheck className="h-4 w-4 text-emerald-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Available Plots</p>
                <p className="text-2xl font-semibold text-display mt-1">{stats?.availablePlots ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.bookedPlots ?? 0} already sold
                </p>
              </div>
              <div className="rounded-full bg-amber-100 p-2">
                <MapPin className="h-4 w-4 text-amber-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">New Leads</p>
                <p className="text-2xl font-semibold text-display mt-1">{stats?.newLeads ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.qualifiedLeads ?? 0} qualified
                </p>
              </div>
              <div className="rounded-full bg-purple-100 p-2">
                <Users className="h-4 w-4 text-purple-700" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Overview */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-terracotta" />
              Sales Performance
            </CardTitle>
            <CardDescription>Booking activity and revenue trends</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Monthly Target Achievement</span>
                <span className="font-semibold">
                  {Math.min(100, Math.round(((stats?.thisMonthRevenue ?? 0) / 5000000) * 100))}%
                </span>
              </div>
              <Progress
                value={Math.min(100, Math.round(((stats?.thisMonthRevenue ?? 0) / 5000000) * 100))}
                className="h-2"
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-terracotta" />
            Quick Actions
          </CardTitle>
          <CardDescription>Frequently used tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link to="/projects">
              <Button variant="outline" className="w-full justify-start h-auto py-3">
                <FolderKanban className="h-4 w-4 mr-2 text-terracotta" />
                <div className="text-left">
                  <p className="font-medium">Browse Projects</p>
                  <p className="text-xs text-muted-foreground">View all projects</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto opacity-50" />
              </Button>
            </Link>
            <Link to="/bookings">
              <Button variant="outline" className="w-full justify-start h-auto py-3">
                <ClipboardCheck className="h-4 w-4 mr-2 text-emerald-600" />
                <div className="text-left">
                  <p className="font-medium">Manage Bookings</p>
                  <p className="text-xs text-muted-foreground">{stats?.pendingBookings ?? 0} pending</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto opacity-50" />
              </Button>
            </Link>
            <Link to="/leads">
              <Button variant="outline" className="w-full justify-start h-auto py-3">
                <Users className="h-4 w-4 mr-2 text-purple-600" />
                <div className="text-left">
                  <p className="font-medium">View Leads</p>
                  <p className="text-xs text-muted-foreground">{stats?.newLeads ?? 0} new leads</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto opacity-50" />
              </Button>
            </Link>
            <Link to="/messages">
              <Button variant="outline" className="w-full justify-start h-auto py-3">
                <MessageSquare className="h-4 w-4 mr-2 text-blue-600" />
                <div className="text-left">
                  <p className="font-medium">Messages</p>
                  <p className="text-xs text-muted-foreground">{stats?.unreadMessages ?? 0} unread</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto opacity-50" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-terracotta" />
              Recent Bookings
            </CardTitle>
            <CardDescription>Latest plot bookings</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.recentBookings && stats.recentBookings.length > 0 ? (
              <div className="space-y-3">
                {stats.recentBookings.map((booking: any) => (
                  <div key={booking.id} className="flex items-center gap-3 text-sm">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-gradient-to-br from-terracotta to-amber-600 text-white text-xs">
                        {getInitials(booking.customer_name || "Customer")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{booking.customer_name || "Customer"}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatMoney(booking.total_price || 0)}
                      </p>
                    </div>
                    <Badge
                      variant={booking.status === "approved" ? "default" : "secondary"}
                      className="shrink-0"
                    >
                      {booking.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No recent bookings</p>
            )}
            <Link to="/bookings">
              <Button variant="link" className="w-full mt-4">
                View all bookings →
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-terracotta" />
              Recent Leads
            </CardTitle>
            <CardDescription>Latest customer inquiries</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.recentLeads && stats.recentLeads.length > 0 ? (
              <div className="space-y-3">
                {stats.recentLeads.map((lead: any) => (
                  <div key={lead.id} className="flex items-center gap-3 text-sm">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-600 text-white text-xs">
                        {getInitials(lead.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{lead.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <Badge variant={lead.status === "new" ? "default" : "secondary"} className="shrink-0">
                      {lead.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No recent leads</p>
            )}
            <Link to="/leads">
              <Button variant="link" className="w-full mt-4">
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
    </div>
  );
}
