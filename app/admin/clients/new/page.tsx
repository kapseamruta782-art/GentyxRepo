// app/admin/clients/new/page.tsx
"use client";

import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createClient,
  fetchServiceCenters,
  fetchCPAs,
  fetchStagesList,
} from "@/lib/api";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { Plus, X } from "lucide-react";

const Schema = z.object({
  client_name: z.string().optional(),
  primary_contact_first_name: z.string().min(1, "First name is required"),
  primary_contact_last_name: z.string().min(1, "Last name is required"),
  primary_contact_email: z.string().min(1, "Email is required").email("Valid email required"),
  primary_contact_phone: z.string().min(1, "Phone number is required"),
  service_center_id: z.string().optional(),
  cpa_id: z.string().optional(),
  // stage_id: z.string().optional(),
});

// Helper function to format phone as 555-888-3333
function formatPhoneInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

type AssociatedUser = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
};

export default function NewClientPage() {
  const { toast } = useToast();
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [associatedUsers, setAssociatedUsers] = useState<AssociatedUser[]>([]);
  // const [newUser, setNewUser] = useState({
  //   name: "",
  //   email: "",
  //   role: "Client User" as const,
  // });

  /* ------------------- FETCH SQL DATA ------------------- */
  const { data: serviceCenters } = useSWR("service-centers-list", fetchServiceCenters);
  const { data: cpas } = useSWR("cpas-list", fetchCPAs);
  const { data: stages } = useSWR("stages-master-list", fetchStagesList);

  const form = useForm<z.infer<typeof Schema>>({
    resolver: zodResolver(Schema),
    defaultValues: {
      client_name: "",
      primary_contact_first_name: "",
      primary_contact_last_name: "",
      primary_contact_email: "",
      primary_contact_phone: "",
      service_center_id: "",
      cpa_id: "",
      // stage_id: "",
    },
  });

  /* ------------------- ADD USER ------------------- */
  function addUser() {
    setAssociatedUsers((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, firstName: "", lastName: "", email: "", phone: "" },
    ]);
  }

  function removeUser(id: string) {
    setAssociatedUsers((prev) => prev.filter((u) => u.id !== id));
  }

  /* ------------------- SUBMIT FORM ------------------- */
  async function onSubmit(values: z.infer<typeof Schema>) {
    try {
      setIsSubmitting(true);

      // Combine first and last name for display/storage
      const primaryContactName = `${values.primary_contact_first_name} ${values.primary_contact_last_name}`.trim();

      const mappedAssociatedUsers = associatedUsers
        .map((u) => {
          const first = (u.firstName ?? "").trim();
          const last = (u.lastName ?? "").trim();
          const email = (u.email ?? "").trim();
          const phone = (u.phone ?? "").trim();

          return {
            name: `${first} ${last}`.trim(),
            email,
            role: "Client User",
            phone,
          };
        })
        // remove fully-empty rows
        .filter((u) => u.name || u.email || u.phone);

      const res = await createClient({
        clientName: values.client_name,
        primaryContactFirstName: values.primary_contact_first_name,
        primaryContactLastName: values.primary_contact_last_name,
        primaryContactName: primaryContactName,
        primaryContactEmail: values.primary_contact_email,
        primaryContactPhone: values.primary_contact_phone,
        serviceCenterId: Number(values.service_center_id) || null,
        cpaId: Number(values.cpa_id) || null,
        associatedUsers: mappedAssociatedUsers,
      });

      // ✅ Check for API error response
      if (!res.success) {
        toast({
          title: "Error",
          description: res.error || "Failed to create client",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Client Created",
        description: "New client added successfully",
        variant: "success",
      });

      router.push(`/admin/clients/${res.clientId}`);

    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to create client",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  /* ------------------- UI ------------------- */
  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>New Client</CardTitle>
        </CardHeader>

        <CardContent className="grid gap-3">


          {/* Company Name (Optional) */}
          <div className="grid gap-2">
            <Label>Company Name</Label>
            <Input {...form.register("client_name")} placeholder="Acme LLC" />
          </div>

          {/* Primary Contact - First Name and Last Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>First Name <span className="text-red-500">*</span></Label>
              <Input {...form.register("primary_contact_first_name")} placeholder="John" />
              {form.formState.errors.primary_contact_first_name && (
                <p className="text-xs text-red-500">{form.formState.errors.primary_contact_first_name.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Last Name <span className="text-red-500">*</span></Label>
              <Input {...form.register("primary_contact_last_name")} placeholder="Doe" />
              {form.formState.errors.primary_contact_last_name && (
                <p className="text-xs text-red-500">{form.formState.errors.primary_contact_last_name.message}</p>
              )}
            </div>
          </div>

          {/* Email */}
          <div className="grid gap-2">
            <Label>Email <span className="text-red-500">*</span></Label>
            <Input {...form.register("primary_contact_email")} placeholder="john@example.com" />
            {form.formState.errors.primary_contact_email && (
              <p className="text-xs text-red-500">{form.formState.errors.primary_contact_email.message}</p>
            )}
          </div>
          {/* Phone */}
          <div className="grid gap-2">
            <Label>Phone <span className="text-red-500">*</span></Label>
            <Controller
              control={form.control}
              name="primary_contact_phone"
              render={({ field }) => (
                <Input
                  {...field}
                  placeholder="555-888-3333"
                  inputMode="numeric"
                  maxLength={12}
                  onChange={(e) => {
                    const formatted = formatPhoneInput(e.target.value);
                    field.onChange(formatted);
                  }}
                />
              )}
            />
            {form.formState.errors.primary_contact_phone && (
              <p className="text-xs text-red-500">{form.formState.errors.primary_contact_phone.message}</p>
            )}
          </div>

          {/* Service Center */}
          <div className="grid gap-2">
            <Label>Service Center</Label>

            <Select
              value={form.watch("service_center_id")}
              onValueChange={(v) => form.setValue("service_center_id", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Assign service center" />
              </SelectTrigger>

              <SelectContent>
                {(serviceCenters?.data || []).map((sc: any) => (
                  <SelectItem
                    key={sc.service_center_id}
                    value={String(sc.service_center_id)}
                  >
                    {sc.center_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>



          {/* CPA */}
          <div className="grid gap-2">
            <Label>Preparer</Label>

            <Select
              value={form.watch("cpa_id")}
              onValueChange={(v) => form.setValue("cpa_id", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Assign Preparer" />
              </SelectTrigger>

              <SelectContent>
                {(cpas?.data || []).map((c: any) => (
                  <SelectItem key={c.cpa_id} value={String(c.cpa_id)}>
                    {c.cpa_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>



          {/* Associated Users */}
          {/* Associated Users */}
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-semibold">Associated Users</Label>
                <p className="text-xs text-muted-foreground">
                  Optional users who can access this client.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addUser}
              >
                <Plus className="mr-1 size-4" /> Add associated user
              </Button>
            </div>

            {associatedUsers.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-2">
                No associated users added.
              </p>
            ) : (
              <div className="space-y-3 mt-3">
                {associatedUsers.map((u, idx) => (
                  <div
                    key={u.id}
                    className="rounded-md border p-3"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                      {/* First Name */}
                      <div className="grid gap-1">
                        <Label className="text-xs">First Name</Label>
                        <Input
                          placeholder="John"
                          value={u.firstName ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setAssociatedUsers((prev) =>
                              prev.map((x) => (x.id === u.id ? { ...x, firstName: v } : x))
                            );
                          }}
                        />
                      </div>

                      {/* Last Name */}
                      <div className="grid gap-1">
                        <Label className="text-xs">Last Name</Label>
                        <Input
                          placeholder="Doe"
                          value={u.lastName ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setAssociatedUsers((prev) =>
                              prev.map((x) => (x.id === u.id ? { ...x, lastName: v } : x))
                            );
                          }}
                        />
                      </div>

                      {/* Email (full row) */}
                      <div className="grid gap-1 md:col-span-2">
                        <Label className="text-xs">Email</Label>
                        <Input
                          type="email"
                          placeholder="john@example.com"
                          value={u.email ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setAssociatedUsers((prev) =>
                              prev.map((x) => (x.id === u.id ? { ...x, email: v } : x))
                            );
                          }}
                        />
                      </div>

                      {/* Phone (full row) */}
                      <div className="grid gap-1 md:col-span-2">
                        <Label className="text-xs">Phone</Label>
                        <Input
                          placeholder="555-888-3333"
                          inputMode="numeric"
                          maxLength={12}
                          value={u.phone ?? ""}
                          onChange={(e) => {
                            const formatted = formatPhoneInput(e.target.value);
                            setAssociatedUsers((prev) =>
                              prev.map((x) => (x.id === u.id ? { ...x, phone: formatted } : x))
                            );
                          }}
                        />
                      </div>

                      {/* Remove button (full row, right aligned) */}
                      <div className="md:col-span-2 flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeUser(u.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                  ))}
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>

            <Button disabled={isSubmitting} onClick={form.handleSubmit(onSubmit)}>
              {isSubmitting ? "Creating..." : "Create Client"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
