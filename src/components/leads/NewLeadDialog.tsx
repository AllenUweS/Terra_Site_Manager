import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserPlus, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LEAD_SOURCES } from "@/components/site-mapper/types";

export interface NewLeadValues {
  plot_id: string;
  project_id: string;
  name: string;
  phone: string;
  email: string | null;
  source: string | null;
  budget: number | null;
  notes: string | null;
}

export function NewLeadDialog({
  open,
  pending,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: NewLeadValues) => void;
}) {
  const [projectId, setProjectId] = useState("");
  const [plotId, setPlotId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("Walk-in");
  const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setProjectId("");
      setPlotId("");
      setName("");
      setPhone("");
      setEmail("");
      setSource("Walk-in");
      setBudget("");
      setNotes("");
    }
  }, [open]);

  const { data: projects } = useQuery({
    queryKey: ["leads-new-projects"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: plots } = useQuery({
    queryKey: ["leads-new-plots", projectId],
    enabled: open && !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plots")
        .select("id, plot_number, status")
        .eq("project_id", projectId)
        .order("plot_number");
      if (error) throw error;
      return data ?? [];
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !plotId || !name.trim() || !phone.trim()) return;
    onSubmit({
      plot_id: plotId,
      project_id: projectId,
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || null,
      source: source || null,
      budget: budget ? Number(budget) : null,
      notes: notes.trim() || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-display text-2xl">
            <UserPlus className="h-5 w-5 text-terracotta" />
            Add a lead
          </DialogTitle>
          <DialogDescription>
            Log an interested buyer against a project and plot. You can manage their status from the
            board afterwards.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Project <span className="text-terracotta">*</span>
              </Label>
              <Select
                value={projectId}
                onValueChange={(v) => {
                  setProjectId(v);
                  setPlotId("");
                }}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {(projects ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Plot <span className="text-terracotta">*</span>
              </Label>
              <Select value={plotId} onValueChange={setPlotId} disabled={!projectId}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder={projectId ? "Select plot" : "Pick a project first"} />
                </SelectTrigger>
                <SelectContent>
                  {(plots ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      Plot {p.plot_number} · {p.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Full name <span className="text-terracotta">*</span>
              </Label>
              <Input
                className="mt-1.5"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ramesh Kulkarni"
                required
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Phone <span className="text-terracotta">*</span>
              </Label>
              <Input
                className="mt-1.5"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile number"
                required
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Email
              </Label>
              <Input
                type="email"
                className="mt-1.5"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="optional"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Budget (₹)
              </Label>
              <Input
                type="number"
                className="mt-1.5"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="optional"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                How did they find us?
              </Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes</Label>
            <Textarea
              className="mt-1.5"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Requirements, family details, follow-up points…"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending || !projectId || !plotId || !name.trim() || !phone.trim()}
              className="bg-terracotta text-accent-foreground hover:bg-terracotta/90"
            >
              <Save className="h-4 w-4 mr-1.5" />
              {pending ? "Saving..." : "Add lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
