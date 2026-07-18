-- Site Mapper: polygon-based plot boundaries on the layout image
-- ------------------------------------------------------------------
-- The old flow only stored a single pin (layout_x, layout_y) per plot.
-- The Site Mapper draws the actual plot boundary (3+ corners) traced
-- directly on the uploaded layout image/PDF, the same way a physical
-- master-plan is read. Coordinates are stored as percentages (0-100)
-- of the image's width/height so the shape stays correct no matter
-- what size the image renders at (mobile, desktop, zoomed, etc).
--
-- layout_x / layout_y are kept (nullable, unused going forward) so
-- this migration is non-destructive and reversible.

ALTER TABLE public.plots
  ADD COLUMN IF NOT EXISTS polygon_coordinates JSONB,
  ADD COLUMN IF NOT EXISTS length_ft NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS width_ft NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS rate_per_sqft NUMERIC(10,2);

COMMENT ON COLUMN public.plots.polygon_coordinates IS
  'Array of {x,y} points (percentage 0-100 of the layout image width/height) tracing the plot boundary drawn in the Site Mapper. NULL means the plot has not been mapped onto the layout yet.';
COMMENT ON COLUMN public.plots.length_ft IS 'Optional plot length in feet, used to auto-compute area_sqft in the Site Mapper form.';
COMMENT ON COLUMN public.plots.width_ft IS 'Optional plot width in feet, used to auto-compute area_sqft in the Site Mapper form.';
COMMENT ON COLUMN public.plots.rate_per_sqft IS 'Optional rate per sqft, used to auto-compute price in the Site Mapper form.';

-- A boundary must be an actual shape (at least a triangle) if present at all.
ALTER TABLE public.plots
  ADD CONSTRAINT plots_polygon_min_points
  CHECK (polygon_coordinates IS NULL OR jsonb_array_length(polygon_coordinates) >= 3);

CREATE INDEX IF NOT EXISTS plots_mapped_idx ON public.plots ((polygon_coordinates IS NOT NULL));
