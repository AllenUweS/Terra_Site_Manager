import { useMemo, useState } from "react";
import { LayoutGrid, Table as TableIcon, Search, Layers } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LEAD_STATUS_LABEL,
  LEAD_STATUS_ORDER,
  LEAD_STATUS_PALETTE,
  type LeadRow,
  type LeadStatus,
} from "@/components/site-mapper/types";
import { LeadCard, type EmployeeOption } from "./LeadCard";
import { formatShortDate, getTemperature, initials, tintFor } from "./leadUtils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export interface ProjectOption {
  id: string;
  name: string;
}

export function LeadsBoard({
  leads,
  employeeNameOf,
  plotLabelOf,
  canManageLead,
  transferOptionsFor,
  onStatusChange,
  onTransfer,
  onEdit,
  onDelete,
  onOpenDetail,
  projects,
}: {
  leads: LeadRow[];
  employeeNameOf: (id: string | null) => string;
  plotLabelOf?: (lead: LeadRow) => string | undefined;
  canManageLead: (lead: LeadRow) => boolean;
  transferOptionsFor?: (lead: LeadRow) => EmployeeOption[];
  onStatusChange: (id: string, status: LeadStatus) => void;
  onTransfer?: (id: string, newEmployeeId: string) => void;
  onEdit?: (lead: LeadRow) => void;
  onDelete?: (id: string) => void;
  onOpenDetail?: (lead: LeadRow) => void;
  /** When provided, shows a "choose a project" chip row above the board so
   *  leads can be scoped to one project at a time. */
  projects?: ProjectOption[];
}) {
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [projectFilter, setProjectFilter] = useState<string | "all">("all");

  const projectLeadCounts = useMemo(() => {
    const m = new Map<string, number>();
    leads.forEach((l) => {
      if (!l.project_id) return;
      m.set(l.project_id, (m.get(l.project_id) ?? 0) + 1);
    });
    return m;
  }, [leads]);

  const projectsWithLeads = useMemo(
    () => (projects ?? []).filter((p) => (projectLeadCounts.get(p.id) ?? 0) > 0),
    [projects, projectLeadCounts],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      const matchesSearch =
        !q ||
        l.name.toLowerCase().includes(q) ||
        l.phone.toLowerCase().includes(q) ||
        employeeNameOf(l.created_by).toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || l.status === statusFilter;
      const matchesProject = projectFilter === "all" || l.project_id === projectFilter;
      return matchesSearch && matchesStatus && matchesProject;
    });
  }, [leads, search, statusFilter, projectFilter, employeeNameOf]);

  const columns = useMemo(() => {
    return LEAD_STATUS_ORDER.map((status) => ({
      status,
      leads: filtered
        .filter((l) => l.status === status)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    }));
  }, [filtered]);

  return (
    <div className="space-y-4">
      {projectsWithLeads.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            onClick={() => setProjectFilter("all")}
            className={`inline-flex items-center gap-1.5 shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
              projectFilter === "all"
                ? "bg-terracotta text-accent-foreground border-terracotta shadow-sm"
                : "bg-card border-border/60 text-muted-foreground hover:border-terracotta/40 hover:text-terracotta"
            }`}
          >
            <Layers className="h-3 w-3" /> All projects
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${projectFilter === "all" ? "bg-white/20" : "bg-muted"}`}
            >
              {leads.length}
            </span>
          </button>
          {projectsWithLeads.map((p) => (
            <button
              key={p.id}
              onClick={() => setProjectFilter(p.id)}
              className={`inline-flex items-center gap-1.5 shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                projectFilter === p.id
                  ? "bg-terracotta text-accent-foreground border-terracotta shadow-sm"
                  : "bg-card border-border/60 text-muted-foreground hover:border-terracotta/40 hover:text-terracotta"
              }`}
            >
              {p.name}
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${projectFilter === p.id ? "bg-white/20" : "bg-muted"}`}
              >
                {projectLeadCounts.get(p.id) ?? 0}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, phone..."
            className="pl-9 bg-card"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="h-9 w-[160px] text-xs">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                All statuses
              </SelectItem>
              {LEAD_STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">
                  {LEAD_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center rounded-md border bg-card p-0.5">
            <Button
              size="sm"
              variant={view === "kanban" ? "default" : "ghost"}
              className={`h-8 px-2.5 ${view === "kanban" ? "bg-terracotta text-accent-foreground hover:bg-terracotta/90" : ""}`}
              onClick={() => setView("kanban")}
            >
              <LayoutGrid className="h-3.5 w-3.5 mr-1.5" /> Kanban
            </Button>
            <Button
              size="sm"
              variant={view === "table" ? "default" : "ghost"}
              className={`h-8 px-2.5 ${view === "table" ? "bg-terracotta text-accent-foreground hover:bg-terracotta/90" : ""}`}
              onClick={() => setView("table")}
            >
              <TableIcon className="h-3.5 w-3.5 mr-1.5" /> Table
            </Button>
          </div>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-sm text-muted-foreground bg-card rounded-xl border border-border/50">
          No leads match your filters.
        </div>
      )}

      {filtered.length > 0 && view === "kanban" && (
        <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
          {columns.map((col) => {
            const palette = LEAD_STATUS_PALETTE[col.status];
            return (
              <div key={col.status} className="w-[280px] shrink-0">
                <div className="flex items-center justify-between px-1 mb-3">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <span className={`h-1.5 w-1.5 rounded-full ${palette.dot}`} />
                    {LEAD_STATUS_LABEL[col.status]}
                  </span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {col.leads.length}
                  </span>
                </div>
                <div className="space-y-3 min-h-[80px]">
                  {col.leads.length === 0 && (
                    <div className="text-center py-6 text-[11px] text-muted-foreground/70 border border-dashed rounded-xl">
                      No leads
                    </div>
                  )}
                  {col.leads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      employeeId={lead.created_by}
                      employeeName={employeeNameOf(lead.created_by)}
                      plotLabel={plotLabelOf?.(lead)}
                      canManage={canManageLead(lead)}
                      transferOptions={transferOptionsFor?.(lead)}
                      onStatusChange={onStatusChange}
                      onTransfer={onTransfer}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onOpenDetail={onOpenDetail}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filtered.length > 0 && view === "table" && (
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Added by</TableHead>
                <TableHead>Plot</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map((lead) => {
                  const palette = LEAD_STATUS_PALETTE[lead.status];
                  const temp = getTemperature(lead);
                  const empName = employeeNameOf(lead.created_by);
                  return (
                    <TableRow
                      key={lead.id}
                      className={onOpenDetail ? "cursor-pointer hover:bg-muted/40" : ""}
                      onClick={() => onOpenDetail?.(lead)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          {lead.name}
                          {temp === "hot" && (
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">
                              Hot
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">{lead.phone}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback
                              className={`text-[9px] font-semibold ${tintFor(lead.created_by)}`}
                            >
                              {initials(empName)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs">{empName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {plotLabelOf?.(lead) ?? "—"}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={lead.status}
                          onValueChange={(v) => onStatusChange(lead.id, v as LeadStatus)}
                          disabled={!canManageLead(lead)}
                        >
                          <SelectTrigger
                            className={`h-6 w-auto gap-1 border px-2 text-[10px] font-medium capitalize rounded-full ${palette.badge}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${palette.dot}`} />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LEAD_STATUS_ORDER.map((s) => (
                              <SelectItem key={s} value={s} className="text-xs">
                                {LEAD_STATUS_LABEL[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatShortDate(lead.created_at)}
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
