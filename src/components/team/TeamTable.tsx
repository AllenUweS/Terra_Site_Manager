import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EmployeeFormDialog } from "./EmployeeFormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Loader2, Search, Mail, Briefcase, Building, Phone, Pencil, Users } from "lucide-react";
import { toast } from "sonner";

const HIERARCHY: Record<string, number> = {
  "SUPER_ADMIN": 1,
  "SUPER ADMIN": 1,
  "ADMIN": 2,
  "ADMINS": 2,
  "MANAGER": 3,
  "MANAGERS": 3,
  "HR": 4,
  "EMPLOYEE": 5,
  "EMPLOYEES": 5,
};

const getPriority = (name: string) => HIERARCHY[name] || 99;

const getRoleGradient = (role: string) => {
  const r = role.toLowerCase();
  if (r.includes('super')) return 'bg-gradient-to-r from-stone-800 to-stone-600 text-white border-transparent shadow-sm'; // Ink/Charcoal
  if (r.includes('admin')) return 'bg-gradient-to-r from-orange-700 to-orange-500 text-white border-transparent shadow-sm'; // Terracotta
  if (r.includes('manager')) return 'bg-gradient-to-r from-amber-600 to-yellow-500 text-white border-transparent shadow-sm'; // Sand/Gold
  if (r.includes('hr')) return 'bg-gradient-to-r from-rose-700 to-rose-500 text-white border-transparent shadow-sm'; // Warm accent
  return 'bg-gradient-to-r from-stone-500 to-stone-400 text-white border-transparent shadow-sm'; // Neutral
};

export function TeamTable() {
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const qc = useQueryClient();

  const { data: profiles, isLoading: isLoadingProfiles } = useQuery({
    queryKey: ["team_profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: roles, isLoading: isLoadingRoles } = useQuery({
    queryKey: ["team_roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data;
    },
  });

  const isLoading = isLoadingProfiles || isLoadingRoles;

  const teamMembers = useMemo(() => {
    const basicProfiles = profiles?.map((profile) => {
      const userRoles = roles?.filter((r) => r.user_id === profile.id) || [];
      const roleMap = userRoles.map(r => r.role);
      let primaryRole = "employee";
      if (roleMap.includes("super_admin")) primaryRole = "super_admin";
      else if (roleMap.includes("admin")) primaryRole = "admin";
      else if (roleMap.includes("manager")) primaryRole = "manager";

      return {
        ...profile,
        role: primaryRole,
      };
    }) || [];

    return basicProfiles.map((profile) => {
      let groupName = profile.role.toUpperCase();

      return {
        ...profile,
        groupName,
      };
    });
  }, [profiles, roles]);

  const filteredMembers = useMemo(() => {
    return teamMembers.filter(m => {
      const matchesSearch = 
        m.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.job_title?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFilter = activeFilter === "ALL" || m.groupName === activeFilter;
      
      return matchesSearch && matchesFilter;
    });
  }, [teamMembers, searchQuery, activeFilter]);

  const groups = useMemo(() => {
    const groupMap = new Map<string, typeof teamMembers>();
    filteredMembers.forEach(m => {
      if (!groupMap.has(m.groupName)) groupMap.set(m.groupName, []);
      groupMap.get(m.groupName)!.push(m);
    });
    
    // Sort groups hierarchically, then alphabetically
    return Array.from(groupMap.entries()).sort((a, b) => {
      const pA = getPriority(a[0]);
      const pB = getPriority(b[0]);
      if (pA !== pB) return pA - pB;
      return a[0].localeCompare(b[0]);
    });
  }, [filteredMembers]);

  const allGroupNames = useMemo(() => {
    const names = new Set<string>();
    teamMembers.forEach(m => names.add(m.groupName));
    return Array.from(names).sort((a, b) => {
      const pA = getPriority(a);
      const pB = getPriority(b);
      if (pA !== pB) return pA - pB;
      return a.localeCompare(b);
    });
  }, [teamMembers]);

  const toggleStatus = async (member: any, checked: boolean) => {
    try {
      const newStatus = checked ? 'active' : 'inactive';
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', member.id);
      
      if (error) throw error;
      toast.success(`${member.full_name || 'User'} is now ${newStatus}`);
      qc.invalidateQueries({ queryKey: ["team_profiles"] });
    } catch (err: any) {
      toast.error("Failed to update status");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Button 
          variant="outline" 
          className={`rounded-full h-8 transition-all duration-300 ${
            activeFilter === "ALL" 
              ? "bg-gradient-to-r from-orange-600 to-amber-600 text-white border-transparent shadow-md hover:from-orange-700 hover:to-amber-700 hover:shadow-lg" 
              : "hover:bg-orange-50 hover:text-orange-700 hover:border-orange-200"
          }`}
          onClick={() => setActiveFilter("ALL")}
        >
          ALL <span className="ml-2 bg-background/20 px-1.5 py-0.5 rounded-full text-[10px]">{teamMembers.length}</span>
        </Button>
        {allGroupNames.map(g => {
          const count = teamMembers.filter(m => m.groupName === g).length;
          return (
            <Button 
              key={g}
              variant="outline" 
              className={`rounded-full h-8 transition-all duration-300 ${
                activeFilter === g 
                  ? "bg-gradient-to-r from-orange-600 to-amber-600 text-white border-transparent shadow-md hover:from-orange-700 hover:to-amber-700 hover:shadow-lg" 
                  : "hover:bg-orange-50 hover:text-orange-700 hover:border-orange-200"
              }`}
              onClick={() => setActiveFilter(g)}
            >
              {g} <span className="ml-2 bg-background/20 px-1.5 py-0.5 rounded-full text-[10px]">{count}</span>
            </Button>
          )
        })}
      </div>

      {/* Search and Add */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search name, email, etc..." 
            className="pl-9 bg-card rounded-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button
          className="w-full sm:w-auto rounded-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white border-transparent shadow-md hover:shadow-lg transition-all duration-300"
          onClick={() => {
            setEditingEmployee(null);
            setIsDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" /> Add User
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mr-2" /> Loading team...
        </div>
      ) : (
        <div className="space-y-6">
          {groups.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground bg-card rounded-xl border border-border/50">
              No employees found matching your filters.
            </div>
          ) : (
            groups.map(([groupName, members]) => (
              <div key={groupName} className="bg-card rounded-2xl border border-border/50 overflow-hidden">
                <div className="flex justify-between items-center p-6 border-b border-border/50 bg-muted/20">
                  <div>
                    <h3 className="font-semibold tracking-wide text-muted-foreground">{groupName}</h3>
                    <p className="text-xl font-bold">{members.length} members</p>
                  </div>
                  <Badge variant="secondary" className="px-4 py-1 text-xs tracking-wider bg-primary/10 text-primary uppercase">
                    {groupName}
                  </Badge>
                </div>
                
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {members.map(member => (
                    <div key={member.id} className="group relative flex gap-4 p-5 rounded-xl border border-border/50 bg-background shadow-sm hover:shadow-md transition-all hover:border-primary/20">
                      
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => {
                          setEditingEmployee(member);
                          setIsDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>

                      <Avatar className="h-12 w-12 border-2 border-primary/10 font-bold">
                        <AvatarImage src={member.avatar_url || ""} />
                        <AvatarFallback className="bg-primary/5 text-primary">
                          {member.full_name?.charAt(0)?.toUpperCase() || member.email?.charAt(0)?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0 space-y-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1 pr-6">
                            <h4 className="font-semibold text-sm truncate">{member.full_name || "Unknown User"}</h4>
                            <Badge className={`h-5 px-1.5 text-[9px] uppercase font-bold tracking-wider ${getRoleGradient(member.role)}`} variant="outline">
                              {member.role.replace("_", " ")}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Switch 
                              checked={member.status !== 'inactive'}
                              onCheckedChange={(c) => toggleStatus(member, c)}
                              className="scale-75 origin-left"
                            />
                            <span className="text-xs font-medium text-muted-foreground">
                              {member.status === 'inactive' ? 'Inactive' : 'Active'}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          {member.manager_id && (() => {
                            const manager = teamMembers.find(m => m.id === member.manager_id);
                            return manager ? (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                                <Users className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                                <span className="truncate">Reports to: <span className="font-medium">{manager.full_name || manager.email}</span></span>
                              </div>
                            ) : null;
                          })()}
                          {member.email && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Mail className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate" title={member.email}>{member.email}</span>
                            </div>
                          )}
                          {member.job_title && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Briefcase className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{member.job_title}</span>
                            </div>
                          )}
                          {member.department && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Building className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{member.department}</span>
                            </div>
                          )}
                          {member.phone && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Phone className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{member.phone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <EmployeeFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        employee={editingEmployee}
        teamMembers={teamMembers}
      />
    </div>
  );
}
