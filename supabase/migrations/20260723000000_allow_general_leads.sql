-- General Leads: Allow leads without initial plot/project assignment
-- ------------------------------------------------------------------
-- This allows sales staff to add "general leads" - customers who have
-- expressed interest but haven't selected a specific plot yet.
-- These leads can later be mapped to any project and plot based on
-- customer preference.

-- Make plot_id and project_id nullable to support general leads
ALTER TABLE public.plot_leads
  ALTER COLUMN plot_id DROP NOT NULL,
  ALTER COLUMN project_id DROP NOT NULL;

-- Add comment to document the change
COMMENT ON COLUMN public.plot_leads.plot_id IS 'The specific plot this lead is associated with. NULL for general leads not yet assigned to a plot.';
COMMENT ON COLUMN public.plot_leads.project_id IS 'The project this lead is associated with. NULL for general leads not yet assigned to a project.';

