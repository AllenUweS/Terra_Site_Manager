import { createFileRoute } from "@tanstack/react-router";
import { LeadsCRM } from "@/components/leads/LeadsCRM";

export const Route = createFileRoute("/_authenticated/leads")({
  component: LeadsPage,
});

function LeadsPage() {
  const { user } = Route.useRouteContext();
  return <LeadsCRM userId={user.id} />;
}
