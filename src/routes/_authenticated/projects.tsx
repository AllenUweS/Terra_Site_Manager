import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, ArrowRight } from "lucide-react";
import { CreateProjectDialog } from "@/components/CreateProjectDialog";

export const Route = createFileRoute("/_authenticated/projects")({
  component: ProjectsList,
});

const statusStyle: Record<string, string> = {
  live: "bg-plot-available/15 text-plot-available border-plot-available/30",
  upcoming: "bg-plot-pending/15 text-[color:var(--plot-pending)] border-plot-pending/30",
  completed: "bg-muted text-muted-foreground",
  archived: "bg-muted text-muted-foreground",
};

function ProjectsList() {
  const { user } = Route.useRouteContext();
  const { data: role } = useQuery({
    queryKey: ["role", user.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_primary_role", { _user_id: user.id });
      return (data as string) ?? "employee";
    },
  });
  const isAdmin = role === "admin" || role === "super_admin";

  const { data: projects } = useQuery({
    queryKey: ["projects", role],
    enabled: !!role,
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("*, plots(id, status)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-sm text-muted-foreground uppercase tracking-wider">Portfolio</p>
          <h1 className="text-display text-4xl mt-1">Projects</h1>
        </div>
        {isAdmin && <CreateProjectDialog />}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {projects?.map((p: any) => {
          const total = p.plots?.length ?? 0;
          const available = p.plots?.filter((x: any) => x.status === "available").length ?? 0;
          const booked = p.plots?.filter((x: any) => x.status === "booked" || x.status === "sold").length ?? 0;
          const pct = total > 0 ? Math.round((booked / total) * 100) : 0;

          const canOpen = isAdmin || p.status === "live";
          
          const CardContent = (
            <>
              <div className="aspect-[4/3] overflow-hidden bg-muted">
                {p.cover_image_url && (
                  <img src={p.cover_image_url} alt={p.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                )}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">{p.code}</p>
                    <h3 className="text-display text-xl mt-1">{p.name}</h3>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${statusStyle[p.status] ?? ""}`}>
                    {p.status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {p.location}
                </p>
                <div className="mt-4 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-plot-available font-medium">{available}</span>
                    <span className="text-muted-foreground"> available</span>
                    <span className="mx-2 text-border">·</span>
                    <span className="text-plot-booked font-medium">{booked}</span>
                    <span className="text-muted-foreground"> booked</span>
                  </div>
                  <span className="text-muted-foreground">{pct}%</span>
                </div>
                <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-terracotta transition-all" style={{ width: `${pct}%` }} />
                </div>
                {canOpen ? (
                  <div className="mt-4 flex items-center text-sm text-terracotta font-medium">
                    Open project <ArrowRight className="h-3 w-3 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                ) : (
                  <div className="mt-4 flex items-center text-sm text-muted-foreground font-medium">
                    Available when live
                  </div>
                )}
              </div>
            </>
          );

          if (!canOpen) {
            return (
              <div
                key={p.id}
                className="group bg-card border rounded-lg overflow-hidden opacity-90 grayscale-[0.2]"
              >
                {CardContent}
              </div>
            );
          }

          return (
            <Link
              key={p.id}
              to="/projects/$id"
              params={{ id: p.id }}
              className="group bg-card border rounded-lg overflow-hidden hover:shadow-md transition-all cursor-pointer"
            >
              {CardContent}
            </Link>
          );
        })}
        {projects && projects.length === 0 && (
          <p className="text-muted-foreground col-span-full">No projects yet.</p>
        )}
      </div>
    </div>
  );
}
