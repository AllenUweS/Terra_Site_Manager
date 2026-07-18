import { useState, useEffect } from "react";
import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useRouter,
  useLocation,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  FolderKanban,
  ClipboardList,
  WalletCards,
  LogOut,
  Users,
  Contact2,
  Sparkles,
  MessageSquare,
  MapPinned,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const qc = useQueryClient();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const { data: role } = useQuery({
    queryKey: ["role", user.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_primary_role", { _user_id: user.id });
      return (data as string) ?? "employee";
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data;
    },
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  const nav = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/projects", label: "Projects", icon: FolderKanban },
    { to: "/bookings", label: "Bookings", icon: ClipboardList },
    { to: "/installments", label: "Installments", icon: WalletCards },
    { to: "/leads", label: "Leads", icon: Contact2 },
    { to: "/team", label: "Team", icon: Users },
  ] as const;

  const visibleNav = [
    ...nav,
    ...(role === "admin" || role === "super_admin" || role === "manager"
      ? [
          { to: "/incentives" as const, label: "Incentives", icon: Sparkles },
          { to: "/messages" as const, label: "Messages", icon: MessageSquare },
        ]
      : role === "employee"
        ? [{ to: "/my-incentives" as const, label: "Incentives", icon: Sparkles }]
        : []),
    ...(role === "admin" || role === "super_admin"
      ? [{ to: "/visit-proofs" as const, label: "Visit Proofs", icon: MapPinned }]
      : []),
  ];

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-card">
        <div className="p-6 border-b">
          <Link to="/dashboard" className="text-display text-2xl">
            Terra
          </Link>
          <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">
            Developer Platform
          </p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {visibleNav.map((item) => {
            const active =
              location.pathname === item.to ||
              ((item.to as string) !== "/" && location.pathname.startsWith(item.to));
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-terracotta/10 text-terracotta font-medium"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t">
          <div className="px-3 py-2">
            <div className="text-sm font-medium truncate">{profile?.full_name ?? user.email}</div>
            <div className="text-xs text-muted-foreground capitalize">
              {role?.replace("_", " ")}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start mt-1">
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile Menu Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 md:hidden transition-opacity duration-300 animate-in fade-in"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile Menu Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-card border-r shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out md:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Close Button matching position of hamburger */}
            <button
              onClick={() => setIsOpen(false)}
              className="flex flex-col justify-center items-center w-9 h-9 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer relative"
              aria-label="Close Menu"
            >
              <div className="w-4 h-4 flex flex-col justify-between items-center relative">
                <span className="block h-[2px] w-4 bg-foreground rounded transition-all duration-300 ease-out origin-center rotate-45 absolute top-[7px]" />
                <span className="block h-[2px] w-4 bg-foreground rounded transition-all duration-300 ease-out opacity-0" />
                <span className="block h-[2px] w-4 bg-foreground rounded transition-all duration-300 ease-out origin-center -rotate-45 absolute top-[7px]" />
              </div>
            </button>
            <Link to="/dashboard" className="text-display text-xl" onClick={() => setIsOpen(false)}>
              Terra
            </Link>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleNav.map((item, index) => {
            const active =
              location.pathname === item.to ||
              ((item.to as string) !== "/" && location.pathname.startsWith(item.to));
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-300 transform ${
                  isOpen ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0"
                } ${
                  active
                    ? "bg-terracotta/10 text-terracotta font-medium"
                    : "text-foreground hover:bg-muted"
                }`}
                style={{
                  transitionDelay: isOpen ? `${index * 40}ms` : "0ms",
                }}
                onClick={() => setIsOpen(false)}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t bg-muted/20">
          <div className="px-3 py-2">
            <div className="text-sm font-medium truncate">{profile?.full_name ?? user.email}</div>
            <div className="text-xs text-muted-foreground capitalize">
              {role?.replace("_", " ")}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              signOut();
              setIsOpen(false);
            }}
            className="w-full justify-start mt-1 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0">
        <header className="md:hidden border-b p-4 flex items-center justify-between bg-card">
          <div className="flex items-center gap-3">
            {/* Hamburger Button */}
            <button
              onClick={() => setIsOpen(true)}
              className="flex flex-col justify-center items-center w-9 h-9 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground md:hidden transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer relative"
              aria-label="Open Menu"
            >
              <div className="w-4 h-4 flex flex-col justify-between items-center relative">
                <span className="block h-[2px] w-4 bg-foreground rounded transition-all duration-300 ease-out origin-center" />
                <span className="block h-[2px] w-4 bg-foreground rounded transition-all duration-300 ease-out my-[3px]" />
                <span className="block h-[2px] w-4 bg-foreground rounded transition-all duration-300 ease-out origin-center" />
              </div>
            </button>
            <Link to="/dashboard" className="text-display text-xl">
              Terra
            </Link>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </header>
        <div className="max-w-7xl mx-auto p-6 md:p-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

