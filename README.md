# Plot Leads — what's new

A full leads pipeline under every plot, so multiple prospective buyers can be
tracked before one of them is turned into an actual booking.

## How it works

Open a project → click a mapped plot → the side panel now has a **Leads**
section under the plot's details.

- **Add lead** — logs a prospect against that plot: name, phone, email,
  budget, how they found you (walk-in / referral / online / etc.), notes,
  and an optional site-visit date + location. Anyone signed in can add a
  lead (attributed to them).
- Each lead shows as a card with a tap-to-call phone number, a WhatsApp
  shortcut, their budget/source, the scheduled meeting (if any), and a
  colour-coded **status pill** (New → Contacted → Meeting scheduled →
  Negotiating → Converted → Dropped) that can be changed inline.
- **Reserve** (admin only) — picks that lead as the one holding the plot.
  The plot flips to "Reserved", gets tagged with that lead, and is
  highlighted at the top of the leads list with a "Selected" badge.
- **Book for them** / **Convert to booking** — takes you to the existing
  booking form with the lead's name/phone/email/notes pre-filled, and a
  banner confirming which lead is being converted. On submit, the lead is
  automatically marked "Converted" and the booking keeps a reference back
  to it.

Admins can edit/delete any lead; regular users can edit the leads they
created. Everything reuses the app's existing card/badge/dialog styling
(terracotta accents, the same status-pill pattern as plots/bookings), so it
feels native rather than bolted on.

## Files in this bundle

```
supabase/migrations/20260716120000_add_plot_leads.sql   ← new table + columns (apply this migration)
src/components/site-mapper/types.ts                     ← replaces the existing file (adds lead types)
src/components/site-mapper/LeadFormDialog.tsx            ← new file
src/components/site-mapper/LeadsPanel.tsx                 ← new file
src/components/site-mapper/SiteMapper.tsx                 ← replaces the existing file
src/routes/_authenticated/projects_.$id.tsx               ← replaces the existing file
src/routes/_authenticated/plots.$plotId.book.tsx           ← replaces the existing file
```

## Applying it

1. Drop the two new files (`LeadFormDialog.tsx`, `LeadsPanel.tsx`) into
   `src/components/site-mapper/`.
2. Overwrite the four existing files with the versions here (they're small,
   targeted diffs — `types.ts` gained a leads section at the bottom,
   `SiteMapper.tsx` gained a `userId` prop + the `<LeadsPanel>` render,
   `projects_.$id.tsx` just passes `userId` down, and
   `plots.$plotId.book.tsx` gained lead pre-fill + a `leadId` search param).
3. Run the migration against your Supabase project (`supabase db push`,
   or paste the SQL into the SQL editor).
4. `pnpm dev` — TanStack Router will regenerate `routeTree.gen.ts`
   automatically to pick up the new `leadId` search param.

No other files were touched. The Supabase generated types file
(`src/integrations/supabase/types.ts`) wasn't regenerated, so the new
`plot_leads` table and the `lead_id`/`selected_lead_id` columns are
accessed with a light `as any` cast — exactly the same pattern the codebase
already uses for `project_documents`. Regenerate types via the Supabase CLI
whenever convenient and those casts can be dropped.
