import { createFileRoute, redirect } from "@tanstack/react-router";
import { VisitProofsWorkspace } from "@/components/leads/VisitProofsWorkspace";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/visit-proofs")({
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.rpc("get_primary_role", { _user_id: context.user.id });
    if (data !== "admin" && data !== "super_admin") throw redirect({ to: "/leads" });
  },
  component: () => <VisitProofsWorkspace userId={Route.useRouteContext().user.id} />,
});
