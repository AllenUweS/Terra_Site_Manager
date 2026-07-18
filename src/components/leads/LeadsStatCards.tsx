import { Users, DoorOpen, Flame, Trophy } from "lucide-react";

export function LeadsStatCards({
  total,
  open,
  hot,
  won,
}: {
  total: number;
  open: number;
  hot: number;
  won: number;
}) {
  const cards = [
    { label: "Total leads", value: total, icon: Users, tone: "text-foreground" },
    { label: "Open", value: open, icon: DoorOpen, tone: "text-terracotta" },
    { label: "Hot leads", value: hot, icon: Flame, tone: "text-destructive" },
    { label: "Closed won", value: won, icon: Trophy, tone: "text-plot-available" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="bg-card border rounded-lg p-6 hover:shadow-sm transition-shadow"
        >
          <div className="flex items-start justify-between">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</p>
            <c.icon className={`h-4 w-4 ${c.tone}`} />
          </div>
          <p className={`text-display text-3xl mt-3 ${c.tone}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}
