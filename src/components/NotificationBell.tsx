import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Bell,
  CheckCheck,
  ClipboardList,
  WalletCards,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";

export interface UserNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: "booking" | "installment_due" | "installment_overdue" | "payment_received" | "info";
  read: boolean;
  link: string | null;
  created_at: string;
}

export function NotificationBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: notifications = [] } = useQuery<UserNotification[]>({
    queryKey: ["user-notifications", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("user_notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) {
        console.error("Failed to fetch notifications:", error);
        return [];
      }
      return data ?? [];
    },
    refetchInterval: 15000, // auto-refresh every 15s
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markReadMutation = useMutation({
    mutationFn: async (id?: string) => {
      if (id) {
        await (supabase as any)
          .from("user_notifications")
          .update({ read: true })
          .eq("id", id);
      } else {
        await (supabase as any)
          .from("user_notifications")
          .update({ read: true })
          .eq("user_id", userId)
          .eq("read", false);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-notifications", userId] });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      await (supabase as any)
        .from("user_notifications")
        .delete()
        .eq("user_id", userId);
    },
    onSuccess: () => {
      toast.success("Notifications cleared");
      qc.invalidateQueries({ queryKey: ["user-notifications", userId] });
    },
  });

  const handleNotificationClick = (item: UserNotification) => {
    if (!item.read) {
      markReadMutation.mutate(item.id);
    }
    if (item.link) {
      navigate({ to: item.link as any });
      setOpen(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "booking":
        return <ClipboardList className="h-4 w-4 text-emerald-500 shrink-0" />;
      case "installment_overdue":
        return <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />;
      case "installment_due":
        return <CalendarDays className="h-4 w-4 text-amber-500 shrink-0" />;
      case "payment_received":
        return <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0" />;
      default:
        return <WalletCards className="h-4 w-4 text-terracotta shrink-0" />;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-foreground/80 hover:text-foreground hover:bg-muted/60 h-9 w-9 rounded-full"
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 text-[9px] font-bold text-white items-center justify-center" />
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 sm:w-96 p-0 shadow-2xl rounded-2xl border border-border/80 bg-card overflow-hidden" align="end">
        {/* Header */}
        <div className="p-3.5 px-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-terracotta" />
            <h4 className="text-sm font-semibold">Notifications</h4>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px] bg-terracotta/10 text-terracotta border-terracotta/20 py-0 h-4 px-1.5">
                {unreadCount} new
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markReadMutation.mutate(undefined)}
                className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground gap-1"
                title="Mark all as read"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Read all
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearAllMutation.mutate()}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                title="Clear all notifications"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Notification Items List */}
        <div className="max-h-80 overflow-y-auto divide-y divide-border/40">
          {notifications.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <Bell className="h-8 w-8 text-muted-foreground/40 mx-auto" />
              <p className="text-sm font-medium text-muted-foreground">All caught up!</p>
              <p className="text-xs text-muted-foreground/70">
                You'll receive notifications when your leads book plots or when installment payments are due.
              </p>
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => handleNotificationClick(item)}
                className={`p-3.5 px-4 text-xs cursor-pointer transition-colors flex items-start gap-3 ${
                  item.read ? "bg-card hover:bg-muted/30" : "bg-terracotta/[0.04] hover:bg-terracotta/[0.08]"
                }`}
              >
                <div className="mt-0.5">{getIcon(item.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`font-semibold truncate ${item.read ? "text-foreground/90" : "text-foreground"}`}>
                      {item.title}
                    </p>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                    {item.message}
                  </p>
                </div>
                {!item.read && (
                  <span className="h-2 w-2 rounded-full bg-terracotta shrink-0 mt-1.5" />
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-2 border-t border-border/50 bg-muted/10 text-center">
            <button
              onClick={() => {
                navigate({ to: "/installments" });
                setOpen(false);
              }}
              className="text-[11px] font-medium text-terracotta hover:underline inline-flex items-center gap-1"
            >
              Go to Finance & Installments <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
