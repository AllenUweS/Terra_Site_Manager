import { createFileRoute } from "@tanstack/react-router";
import { TeamTable } from "@/components/team/TeamTable";

export const Route = createFileRoute("/_authenticated/team")({
  component: TeamPage,
});

function TeamPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">HR Management</h1>
        <p className="text-muted-foreground">
          Manage your organization's employees and their access roles.
        </p>
      </div>

      <TeamTable />
    </div>
  );
}
