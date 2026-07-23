import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Camera, CheckCircle2, LocateFixed, MapPin, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { LeadRow } from "@/components/site-mapper/types";

const POOR_ACCURACY_METERS = 50;

export function SiteVisitProofPanel({
  lead,
  userId,
  canCapture,
  canReview,
}: {
  lead: LeadRow;
  userId: string;
  canCapture: boolean;
  canReview: boolean;
}) {
  const qc = useQueryClient();
  const [location, setLocation] = useState<GeolocationPosition | null>(null);
  const [locating, setLocating] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState("");
  const [correction, setCorrection] = useState("");

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ["site-visits", lead.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("site_visits")
        .select("*, site_visit_photos(*)")
        .eq("lead_id", lead.id)
        .order("arrived_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const activeVisit = useMemo(
    () =>
      visits.find((visit: any) => visit.status === "in_progress" && visit.employee_id === userId),
    [visits, userId],
  );

  const locate = () => {
    if (!navigator.geolocation) return toast.error("GPS is not available on this device.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation(position);
        setLocating(false);
      },
      () => {
        setLocating(false);
        toast.error("Location permission is required to start a verifiable visit.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const startVisit = useMutation({
    mutationFn: async () => {
      if (!location) throw new Error("Capture your GPS location before starting.");
      const { error } = await (supabase as any).from("site_visits").insert({
        lead_id: lead.id,
        employee_id: userId,
        project_id: lead.project_id,
        plot_id: lead.plot_id,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy_meters: location.coords.accuracy,
        arrived_at: new Date(location.timestamp).toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Site visit started. Add at least one proof photo to complete it.");
      qc.invalidateQueries({ queryKey: ["site-visits", lead.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addPhotos = useMutation({
    mutationFn: async () => {
      if (!activeVisit || !files.length) throw new Error("Choose at least one photo.");
      const capturedAt = new Date().toISOString();
      const rows = [];
      for (const file of files) {
        const path = `${userId}/${activeVisit.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
        const { error: uploadError } = await supabase.storage
          .from("site-visit-proofs")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        rows.push({
          visit_id: activeVisit.id,
          storage_path: path,
          file_name: file.name,
          captured_at: capturedAt,
          latitude: location?.coords.latitude ?? null,
          longitude: location?.coords.longitude ?? null,
          accuracy_meters: location?.coords.accuracy ?? null,
        });
      }
      const { error } = await (supabase as any).from("site_visit_photos").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      setFiles([]);
      toast.success("Proof photo saved securely.");
      qc.invalidateQueries({ queryKey: ["site-visits", lead.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const completeVisit = useMutation({
    mutationFn: async () => {
      if (!activeVisit?.site_visit_photos?.length)
        throw new Error("Add at least one proof photo before completing the visit.");
      const { error } = await (supabase as any)
        .from("site_visits")
        .update({
          status: "submitted",
          notes: notes || null,
          completed_at: new Date().toISOString(),
        })
        .eq("id", activeVisit.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setNotes("");
      toast.success("Visit proof submitted for review.");
      qc.invalidateQueries({ queryKey: ["site-visits", lead.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const review = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "verified" | "needs_review" }) => {
      const { error } = await (supabase as any)
        .from("site_visits")
        .update({ status, reviewed_by: userId, reviewed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["site-visits", lead.id] }),
    onError: (error: Error) => toast.error(error.message),
  });
  const addCorrection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("site_visits")
        .update({ correction_note: correction })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setCorrection("");
      toast.success("Correction note saved; original evidence is unchanged.");
      qc.invalidateQueries({ queryKey: ["site-visits", lead.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const poorAccuracy = !!location && location.coords.accuracy > POOR_ACCURACY_METERS;
  return (
    <section className="space-y-4 border-t px-6 py-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Site visit proof
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          GPS-confirmed arrival and private photo evidence.
        </p>
      </div>
      {canCapture && !activeVisit && (
        <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            {location ? (
              <span className="flex items-center gap-1.5 text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                GPS ready ±{Math.round(location.coords.accuracy)}m
              </span>
            ) : (
              <span className="text-muted-foreground">Location permission required</span>
            )}
            <Button size="sm" variant="outline" onClick={locate} disabled={locating}>
              <LocateFixed className="mr-1 h-3.5 w-3.5" />
              {locating ? "Finding…" : "Capture GPS"}
            </Button>
          </div>
          {poorAccuracy && (
            <p className="flex gap-1.5 text-xs text-amber-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              GPS accuracy is poor (over {POOR_ACCURACY_METERS}m). Move outdoors and capture again
              if possible.
            </p>
          )}
          <Button
            className="w-full bg-terracotta text-accent-foreground hover:bg-terracotta/90"
            disabled={!location || startVisit.isPending}
            onClick={() => startVisit.mutate()}
          >
            <MapPin className="mr-2 h-4 w-4" />
            {startVisit.isPending ? "Starting…" : "Start site visit"}
          </Button>
        </div>
      )}
      {canCapture && activeVisit && (
        <div className="space-y-3 rounded-xl border border-terracotta/30 bg-terracotta/5 p-4">
          <div className="flex items-center justify-between">
            <p className="font-medium text-sm">Visit in progress</p>
            <span className="text-xs text-muted-foreground">
              Arrival ±{Math.round(Number(activeVisit.accuracy_meters))}m
            </span>
          </div>
          <Input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
          />
          <p className="text-xs text-muted-foreground">
            {files.length
              ? `${files.length} photo${files.length === 1 ? "" : "s"} ready to upload`
              : `${activeVisit.site_visit_photos?.length ?? 0} proof photos saved. Camera or gallery accepted.`}
          </p>
          <Button
            variant="outline"
            className="w-full"
            disabled={!files.length || addPhotos.isPending}
            onClick={() => addPhotos.mutate()}
          >
            <Upload className="mr-2 h-4 w-4" />
            {addPhotos.isPending ? "Uploading…" : "Save proof photos"}
          </Button>
          <Textarea
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Visit notes (saved when submitted)…"
          />
          <Button
            className="w-full bg-terracotta text-accent-foreground hover:bg-terracotta/90"
            disabled={!activeVisit.site_visit_photos?.length || completeVisit.isPending}
            onClick={() => completeVisit.mutate()}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {completeVisit.isPending ? "Completing…" : "Complete and submit"}
          </Button>
        </div>
      )}
      <div className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading visit history…</p>
        ) : visits.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
            No site visits yet.
          </p>
        ) : (
          visits.map((visit: any) => (
            <VisitCard
              key={visit.id}
              visit={visit}
              canReview={canReview}
              canCorrect={visit.employee_id === userId && visit.status !== "in_progress"}
              correction={correction}
              onCorrection={setCorrection}
              onSaveCorrection={() => addCorrection.mutate(visit.id)}
              onReview={(status: "verified" | "needs_review") => review.mutate({ id: visit.id, status })}
            />
          ))
        )}
      </div>
    </section>
  );
}

function VisitCard({
  visit,
  canReview,
  canCorrect,
  correction,
  onCorrection,
  onSaveCorrection,
  onReview,
}: any) {
  const [expanded, setExpanded] = useState(false);
  const statusClass =
    visit.status === "verified"
      ? "bg-emerald-50 text-emerald-700"
      : visit.status === "needs_review"
        ? "bg-amber-50 text-amber-700"
        : visit.status === "in_progress"
          ? "bg-slate-100 text-slate-700"
          : "bg-blue-50 text-blue-700";
  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            Site visit ·{" "}
            {new Date(visit.arrived_at).toLocaleString("en-IN", {
              day: "numeric",
              month: "short",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
          <a
            target="_blank"
            rel="noreferrer"
            href={`https://www.google.com/maps?q=${visit.latitude},${visit.longitude}`}
            className="mt-1 inline-flex items-center gap-1 text-xs text-terracotta hover:underline"
          >
            <MapPin className="h-3 w-3" />
            Map pin · ±{Math.round(Number(visit.accuracy_meters))}m
          </a>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusClass}`}>
          {visit.status.replace("_", " ")}
        </span>
      </div>
      {visit.notes && <p className="mt-3 text-sm text-muted-foreground">{visit.notes}</p>}
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Camera className="h-3.5 w-3.5" />
        {visit.site_visit_photos?.length ?? 0} private proof photos
      </p>
      {canReview && visit.status === "submitted" && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={() => onReview("verified")}>
            Verify
          </Button>
          <Button size="sm" variant="outline" onClick={() => onReview("needs_review")}>
            Needs review
          </Button>
        </div>
      )}
      {canCorrect && (
        <div className="mt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-terracotta hover:underline"
          >
            {expanded ? "Hide correction" : "Add correction note"}
          </button>
          {expanded && (
            <div className="mt-2 flex gap-2">
              <Input
                value={correction}
                onChange={(event) => onCorrection(event.target.value)}
                placeholder="Explain a correction; evidence remains unchanged"
              />
              <Button size="sm" disabled={!correction.trim()} onClick={onSaveCorrection}>
                Save
              </Button>
            </div>
          )}
          {visit.correction_note && (
            <p className="mt-2 text-xs text-muted-foreground">
              Correction: {visit.correction_note}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
