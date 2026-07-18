import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase, createSecondarySupabaseClient } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  full_name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  phone: z.string().optional(),
  job_title: z.string().optional(),
  department: z.string().optional(),
  status: z.enum(["active", "inactive"]),
  role: z.enum(["admin", "employee", "manager"]),
  manager_id: z.string().optional(),
  joining_date: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function EmployeeFormDialog({
  open,
  onOpenChange,
  employee,
  teamMembers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: any;
  teamMembers?: any[];
}) {
  const [submitting, setSubmitting] = useState(false);
  const qc = useQueryClient();
  const isEditing = !!employee;

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      status: "active",
      role: "employee",
      manager_id: "none",
    },
  });
  const status = watch("status");
  const role = watch("role");
  const manager_id = watch("manager_id");

  useEffect(() => {
    if (open) {
      if (employee) {
        reset({
          full_name: employee.full_name || "",
          email: employee.email || "",
          phone: employee.phone || "",
          job_title: employee.job_title || "",
          department: employee.department || "",
          status: employee.status || "active",
          role: employee.role === "super_admin" ? "admin" : (employee.role || "employee"), // Prevent setting super_admin in UI
          manager_id: employee.manager_id || "none",
        });
      } else {
        reset({
          full_name: "",
          email: "",
          password: "",
          phone: "",
          job_title: "",
          department: "",
          status: "active",
          role: "employee",
          manager_id: "none",
        });
      }
    }
  }, [open, employee, reset]);

  const onSubmit = async (values: FormValues) => {
    try {
      setSubmitting(true);
      
      let targetUserId = employee?.id;

      if (!isEditing) {
        if (!values.password) {
          toast.error("Password is required for new employees");
          return;
        }

        // Create user using secondary client so we don't sign out the admin
        const tempClient = createSecondarySupabaseClient();
        if (!tempClient) throw new Error("Could not initialize secondary auth client");

        const { data: authData, error: authError } = await tempClient.auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            data: { full_name: values.full_name },
          }
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error("Failed to create user account");
        
        targetUserId = authData.user.id;
        
        // Wait a brief moment for the database trigger to create the profile
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Update Profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: values.full_name,
          phone: values.phone || null,
          job_title: values.job_title || null,
          department: values.department || null,
          joining_date: values.joining_date || null,
          status: values.status,
          manager_id: values.manager_id === "none" ? null : values.manager_id,
        })
        .eq("id", targetUserId);

      if (profileError) throw profileError;

      // Update Role
      const { error: roleError } = await supabase
        .from("user_roles")
        .update({ role: values.role })
        .eq("user_id", targetUserId);

      if (roleError) throw roleError;

      toast.success(isEditing ? "Employee updated successfully" : "Employee added successfully");
      qc.invalidateQueries({ queryKey: ["team_profiles"] });
      qc.invalidateQueries({ queryKey: ["team_roles"] });
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Employee" : "Add New Employee"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input {...register("full_name")} placeholder="Jane Doe" autoComplete="off" />
              {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
            </div>
            
            <div className="space-y-2">
              <Label>Email</Label>
              <Input 
                {...register("email")} 
                type="email" 
                placeholder="jane@example.com" 
                disabled={isEditing}
                autoComplete="off"
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
          </div>

          {!isEditing && (
            <div className="space-y-2">
              <Label>Password</Label>
              <Input {...register("password")} type="password" placeholder="Min. 6 characters" autoComplete="new-password" />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input {...register("phone")} placeholder="+1 555-0123" />
            </div>

            <div className="space-y-2">
              <Label>Joining Date</Label>
              <Input {...register("joining_date")} type="date" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Job Title</Label>
              <Input {...register("job_title")} placeholder="Sales Executive" />
            </div>

            <div className="space-y-2">
              <Label>Department</Label>
              <Input {...register("department")} placeholder="Sales" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>System Role</Label>
              <Select value={role} onValueChange={(v: any) => setValue("role", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v: any) => setValue("status", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reports To (Manager)</Label>
              <input type="hidden" {...register("manager_id")} />
              <Select value={manager_id || "none"} onValueChange={(v: any) => setValue("manager_id", v, { shouldDirty: true, shouldValidate: true })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Top Level)</SelectItem>
                  {teamMembers?.filter(m => m.id !== employee?.id && ['manager', 'admin', 'super_admin'].includes(m.role)).map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.full_name || m.email} ({m.role.replace('_', ' ')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Add Employee"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
