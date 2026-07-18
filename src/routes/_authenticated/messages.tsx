import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import {
  Mail,
  Phone,
  MessageSquare,
  Clock,
  User,
  CheckCircle2,
  Circle,
  AlertCircle,
  Search,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/messages")({
  component: MessagesPage,
});

type Message = {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  status: string;
  created_at: string;
};

function MessagesPage() {
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: messages, isLoading } = useQuery({
    queryKey: ["contact_messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_messages")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Message[];
    },
  });

  const filteredMessages = messages?.filter((msg) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      msg.name.toLowerCase().includes(searchLower) ||
      msg.email.toLowerCase().includes(searchLower) ||
      msg.message.toLowerCase().includes(searchLower)
    );
  }) || [];

  const stats = {
    total: messages?.length || 0,
    new: messages?.filter((m) => m.status === "new").length || 0,
    read: messages?.filter((m) => m.status === "read").length || 0,
    replied: messages?.filter((m) => m.status === "replied").length || 0,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "read":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "replied":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "new":
        return Circle;
      case "read":
        return AlertCircle;
      case "replied":
        return CheckCircle2;
      default:
        return Circle;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Customer communications
          </p>
          <h1 className="mt-1 text-display text-4xl">Messages</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage customer inquiries from your landing page.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Messages</p>
                <p className="text-2xl font-semibold text-display mt-1">{stats.total}</p>
              </div>
              <div className="rounded-full bg-blue-100 p-2">
                <MessageSquare className="h-4 w-4 text-blue-700" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">New</p>
                <p className="text-2xl font-semibold text-display mt-1 text-blue-600">{stats.new}</p>
              </div>
              <div className="rounded-full bg-blue-100 p-2">
                <Circle className="h-4 w-4 text-blue-700" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Read</p>
                <p className="text-2xl font-semibold text-display mt-1 text-amber-600">{stats.read}</p>
              </div>
              <div className="rounded-full bg-amber-100 p-2">
                <AlertCircle className="h-4 w-4 text-amber-700" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Replied</p>
                <p className="text-2xl font-semibold text-display mt-1 text-emerald-600">{stats.replied}</p>
              </div>
              <div className="rounded-full bg-emerald-100 p-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-700" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or message..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Messages List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground animate-pulse" />
            <p className="mt-2 text-sm text-muted-foreground">Loading messages...</p>
          </div>
        </div>
      ) : filteredMessages.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-4">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="mt-4 font-medium">No messages found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {searchQuery ? "Try adjusting your search" : "Messages will appear here when customers contact you"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredMessages.map((msg, index) => {
            const StatusIcon = getStatusIcon(msg.status);
            return (
              <Card
                key={msg.id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => setSelectedMessage(msg)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className="bg-gradient-to-br from-terracotta to-amber-600 text-white font-medium">
                        {getInitials(msg.name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-semibold truncate">{msg.name}</h3>
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {msg.email}
                            </span>
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {msg.phone}
                            </span>
                          </div>
                        </div>
                        <Badge className={`${getStatusColor(msg.status)} shrink-0`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {msg.status}
                        </Badge>
                      </div>

                      <p className="mt-3 text-sm line-clamp-2 text-muted-foreground">
                        {msg.message}
                      </p>

                      <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                        </span>
                        <Separator orientation="vertical" className="h-3" />
                        <span>{format(new Date(msg.created_at), "MMM d, yyyy 'at' h:mm a")}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Message Detail Dialog */}
      <Dialog open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
        <DialogContent className="max-w-2xl">
          {selectedMessage && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-gradient-to-br from-terracotta to-amber-600 text-white font-medium text-lg">
                      {getInitials(selectedMessage.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <DialogTitle className="text-xl">{selectedMessage.name}</DialogTitle>
                    <DialogDescription className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {selectedMessage.email}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {selectedMessage.phone}
                      </span>
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <Separator />

              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground mb-2">
                    Message
                  </p>
                  <p className="text-sm leading-relaxed bg-muted/50 p-4 rounded-lg">
                    {selectedMessage.message}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>
                      {format(new Date(selectedMessage.created_at), "MMMM d, yyyy 'at' h:mm a")}
                    </span>
                  </div>
                  <Badge className={`${getStatusColor(selectedMessage.status)}`}>
                    {selectedMessage.status}
                  </Badge>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
