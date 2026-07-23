import { Phone, MessageCircle, Flame, Pencil, Trash2, ArrowLeftRight, Map, MapPin } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LEAD_STATUS_LABEL,
  LEAD_STATUS_ORDER,
  LEAD_STATUS_PALETTE,
  type LeadRow,
  type LeadStatus,
} from "@/components/site-mapper/types";
import { formatShortDate, getTemperature, initials, tintFor } from "./leadUtils";

export interface EmployeeOption {
  id: string;
  name: string;
}

function digitsOnly(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

export function LeadCard({
  lead,
  employeeName,
  employeeId,
  plotLabel,
  canManage,
  transferOptions,
  onStatusChange,
  onTransfer,
  onEdit,
  onDelete,
  onOpenDetail,
  onMapToPlot,
}: {
  lead: LeadRow;
  employeeName: string;
  employeeId: string | null;
  plotLabel?: string;
  canManage: boolean;
  transferOptions?: EmployeeOption[];
  onStatusChange: (id: string, status: LeadStatus) => void;
  onTransfer?: (id: string, newEmployeeId: string) => void;
  onEdit?: (lead: LeadRow) => void;
  onDelete?: (id: string) => void;
  onOpenDetail?: (lead: LeadRow) => void;
  onMapToPlot?: (lead: LeadRow) => void;
}) {
  const palette = LEAD_STATUS_PALETTE[lead.status];
  const temp = getTemperature(lead);

  return (
    <div
      className={`group rounded-xl border border-border/60 bg-card p-3.5 shadow-sm hover:shadow-md hover:border-terracotta/30 transition-all ${onOpenDetail ? "cursor-pointer" : ""}`}
      onClick={() => onOpenDetail?.(lead)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-semibold truncate group-hover:text-terracotta transition-colors">
              {lead.name}
            </p>
            {temp === "hot" && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">
                <Flame className="h-2.5 w-2.5" /> Hot
              </span>
            )}
            {temp === "warm" && (
              <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                Warm
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {formatShortDate(lead.created_at)}
          </p>
        </div>

        {canManage && (
          <div
            className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {!lead.plot_id && !lead.project_id && onMapToPlot && (
              <button
                className="rounded p-1 text-terracotta hover:bg-terracotta/10 relative"
                title="Map to plot"
                onClick={() => onMapToPlot(lead)}
              >
                <MapPin className="h-3 w-3" />
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-terracotta text-[8px] font-bold flex items-center justify-center text-white">+</span>
              </button>
            )}
            {onEdit && (
              <button
                className="rounded p-1 text-muted-foreground hover:bg-muted"
                title="Edit lead"
                onClick={() => onEdit(lead)}
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
            {onDelete && (
              <button
                className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                title="Delete lead"
                onClick={() => {
                  if (confirm(`Remove lead "${lead.name}"?`)) onDelete(lead.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>

      <div
        className="flex items-center gap-2 text-[11px] text-muted-foreground mt-2"
        onClick={(e) => e.stopPropagation()}
      >
        <a
          href={`tel:${lead.phone}`}
          className="inline-flex items-center gap-1 hover:text-terracotta"
        >
          <Phone className="h-2.5 w-2.5" /> {lead.phone}
        </a>
        <a
          href={`https://wa.me/91${digitsOnly(lead.phone).slice(-10)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 hover:text-plot-available"
          title="Message on WhatsApp"
        >
          <MessageCircle className="h-2.5 w-2.5" />
        </a>
      </div>

      {plotLabel && (
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1 group-hover:text-terracotta transition-colors">
          <Map className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">{plotLabel}</span>
          {onOpenDetail && (
            <span className="ml-auto shrink-0 text-[9px] font-semibold uppercase tracking-wide text-terracotta opacity-0 group-hover:opacity-100 transition-opacity">
              View map →
            </span>
          )}
        </div>
      )}

      <div
        className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-border/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Avatar className="h-5 w-5 shrink-0">
            <AvatarFallback className={`text-[9px] font-semibold ${tintFor(employeeId)}`}>
              {initials(employeeName)}
            </AvatarFallback>
          </Avatar>
          <span className="text-[11px] text-muted-foreground truncate">{employeeName}</span>
        </div>

        {canManage && transferOptions && transferOptions.length > 0 && onTransfer && (
          <Select onValueChange={(v) => onTransfer(lead.id, v)}>
            <SelectTrigger className="h-6 w-6 p-0 justify-center border-none bg-transparent shadow-none [&>svg]:hidden">
              <ArrowLeftRight className="h-3 w-3 text-muted-foreground hover:text-terracotta" />
            </SelectTrigger>
            <SelectContent align="end">
              {transferOptions.map((o) => (
                <SelectItem key={o.id} value={o.id} className="text-xs">
                  Transfer to {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="mt-2" onClick={(e) => e.stopPropagation()}>
        <Select
          value={lead.status}
          onValueChange={(v) => onStatusChange(lead.id, v as LeadStatus)}
          disabled={!canManage}
        >
          <SelectTrigger
            className={`h-6 w-full gap-1 border px-2 text-[10px] font-medium capitalize rounded-full ${palette.badge}`}
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
      </div>
    </div>
  );
}
