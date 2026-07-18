import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/bookings")({
  component: BookingsPage,
});

const statusStyle: Record<string, string> = {
  pending: "bg-plot-pending/15 text-[color:var(--plot-pending)] border-plot-pending/30",
  approved: "bg-plot-available/15 text-plot-available border-plot-available/30",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
  cancelled: "bg-muted text-muted-foreground",
  on_hold: "bg-plot-reserved/15 text-plot-reserved border-plot-reserved/30",
};

function BookingsPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();

  const { data: role } = useQuery({
    queryKey: ["role", user.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_primary_role", { _user_id: user.id });
      return (data as string) ?? "employee";
    },
  });

  const isAdmin = role === "admin" || role === "super_admin";

  const { data: bookings } = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("*, plots(plot_number, projects(name, code))")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" | "cancelled" | "on_hold" | "pending" }) => {
      const { error } = await supabase.from("bookings").update({
        status, approved_by: user.id,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Booking updated");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <div className="mb-8">
        <p className="text-sm text-muted-foreground uppercase tracking-wider">Pipeline</p>
        <h1 className="text-display text-4xl mt-1">Bookings</h1>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="p-4 font-medium">Project · Plot</th>
                <th className="p-4 font-medium">Customer</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Status</th>
                {isAdmin && <th className="p-4 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {bookings?.map((b: any) => (
                <tr key={b.id} className="border-t hover:bg-muted/30">
                  <td className="p-4">
                    <div className="font-medium">{b.plots?.projects?.name}</div>
                    <div className="text-xs text-muted-foreground">{b.plots?.projects?.code} · Plot {b.plots?.plot_number}</div>
                  </td>
                  <td className="p-4">
                    <div className="font-medium">{b.customer_name}</div>
                    <div className="text-xs text-muted-foreground">{b.customer_phone}</div>
                  </td>
                  <td className="p-4">
                    <div>₹{Number(b.total_price).toLocaleString("en-IN")}</div>
                    <div className="text-xs text-muted-foreground">₹{Number(b.advance_paid).toLocaleString("en-IN")} paid</div>
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {new Date(b.booking_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="p-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${statusStyle[b.status]}`}>
                      {b.status.replace("_", " ")}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="p-4 text-right">
                      {b.status === "pending" && (
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => update.mutate({ id: b.id, status: "approved" })}>
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => update.mutate({ id: b.id, status: "rejected" })}>
                            Reject
                          </Button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {bookings && bookings.length === 0 && (
                <tr><td colSpan={isAdmin ? 6 : 5} className="p-8 text-center text-muted-foreground">
                  No bookings yet.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
