import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Welcome back.");
      nav({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setLoading(false);
    }
  }



  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex relative overflow-hidden bg-ink text-primary-foreground">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1600)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <Link to="/" className="text-display text-3xl hover:opacity-80 transition-opacity w-fit">Terra</Link>
          <div>
            <p className="text-display text-4xl leading-tight max-w-md">
              A quiet, careful way to manage land, plots and the people who invest in them.
            </p>
            <p className="mt-6 text-sm opacity-70 max-w-sm">
              Projects · Interactive layouts · Bookings · Approvals
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12 relative">
        <Link 
          to="/" 
          className="absolute top-6 right-6 sm:top-8 sm:right-8 flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group bg-secondary/30 hover:bg-secondary/60 px-4 py-2 rounded-full"
        >
          <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          Back to landing
        </Link>
        <div className="w-full max-w-sm mt-12 sm:mt-0">
          <Link to="/" className="text-display text-2xl hover:opacity-80 transition-opacity">Terra</Link>
          <h1 className="text-display text-3xl mt-8">
            Welcome back
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Sign in to continue.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="mt-1.5" />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-terracotta text-accent-foreground hover:bg-terracotta/90">
              {loading ? "..." : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
