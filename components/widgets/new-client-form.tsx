// components/widgets/new-client-form.tsx
"use client";

import { useState } from "react";
import { z } from "zod";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import useSWR from "swr";
//import { formatPhoneNumber } from "@/lib/formatters";
import { formatPhone } from "@/lib/formatters";

import { createClient, fetchServiceCenters, fetchCPAs } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

const NewClientSchema = z.object({
  clientName: z.string().min(2, "Company name is required"),
  code: z.string().optional(),
  slaNumber: z.string().optional(),
  primaryContactFirstName: z.string().min(1, "First name is required"),
  primaryContactLastName: z.string().min(1, "Last name is required"),
  primaryContactEmail: z
    .string()
    .email("Valid email required")
    .min(3, "Email is required"),
  //primaryContactPhone: z.string().optional(),
  primaryContactPhone: z.string().min(1, "Phone number is required").regex(/^[\d-]+$/, "Phone number must contain only digits"),

  serviceCenterId: z.string().optional(),
  cpaId: z.string().optional(),
  // stageId: z.string().optional(),
  associatedUsers: z
    .array(
      z.object({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().optional(), // not mandatory
        phone: z.string().optional(), // not mandatory (we will format if user types)
      })
    )
    .optional(),
});

function formatPhoneInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}


type FormValues = z.infer<typeof NewClientSchema>;

export function NewClientForm() {
  const { toast } = useToast();
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);

  // Load Service Centers & CPAs
  const { data: serviceCentersData } = useSWR(
    ["service-centers"],
    () => fetchServiceCenters(),
    { revalidateOnFocus: false }
  );

  const { data: cpasData } = useSWR(["cpas"], () => fetchCPAs(), {
    revalidateOnFocus: false,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(NewClientSchema),
    defaultValues: {
      clientName: "",
      code: "",
      slaNumber: "",
      primaryContactFirstName: "",
      primaryContactLastName: "",
      primaryContactEmail: "",
      primaryContactPhone: "",
      serviceCenterId: "",
      cpaId: "",
      // stageId: "",
      associatedUsers: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "associatedUsers",
  });

  async function onSubmit(values: FormValues) {
    try {
      setSubmitting(true);

      // Combine first and last name for display/storage
      const primaryContactName = `${values.primaryContactFirstName} ${values.primaryContactLastName}`.trim();

      const payload = {
        clientName: values.clientName,
        code: values.code,
        slaNumber: values.slaNumber,
        primaryContactFirstName: values.primaryContactFirstName,
        primaryContactLastName: values.primaryContactLastName,
        primaryContactName: primaryContactName,
        primaryContactEmail: values.primaryContactEmail,
        primaryContactPhone: values.primaryContactPhone,
        serviceCenterId: values.serviceCenterId
          ? Number(values.serviceCenterId)
          : null,
        cpaId: values.cpaId ? Number(values.cpaId) : null,
        // stageId: values.stageId ? Number(values.stageId) : null,
        associatedUsers: (values.associatedUsers || [])
          // ✅ If user added a row but left everything empty, ignore it
          .filter((u) => {
            const first = (u.firstName ?? "").trim();
            const last = (u.lastName ?? "").trim();
            const email = (u.email ?? "").trim();
            const phone = (u.phone ?? "").trim();
            return first || last || email || phone;
          })
          .map((u) => {
            const first = (u.firstName ?? "").trim();
            const last = (u.lastName ?? "").trim();

            // ✅ API expects "name/email/role" - keep compatible
            return {
              name: `${first} ${last}`.trim() || "",  // if empty it's fine
              email: (u.email ?? "").trim() || "",
              role: "Client User", // default role (since UI no longer asks role)
              phone: (u.phone ?? "").trim() || "",   // safe extra field (API can ignore if not used)
            };
          }),
      };

      const res = await createClient(payload);

      if (!res.success) {
        throw new Error(res.error || "Failed to create client");
      }

      toast({
        title: "Client created",
        description: "New client has been added and tasks seeded.",
      });

      // Redirect back to Clients list
      router.push("/admin/clients");
    } catch (err: any) {
      console.error("NewClientForm error:", err);
      toast({
        title: "Error",
        description: err?.message || "Failed to create client",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const serviceCenters = serviceCentersData?.data || [];
  const cpas = cpasData?.data || [];

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="grid gap-4 max-w-3xl"
    >
      {/* Company Name */}
      <div className="grid gap-2">
        <Label>Company Name <span className="text-red-500">*</span></Label>
        <Input
          {...form.register("clientName")}
          placeholder="Acme LLC"
        />
        {form.formState.errors.clientName && (
          <p className="text-xs text-red-500">
            {form.formState.errors.clientName.message}
          </p>
        )}
      </div>

      {/* Primary Contact - First Name and Last Name */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>First Name <span className="text-red-500">*</span></Label>
          <Input
            {...form.register("primaryContactFirstName")}
            placeholder="Jane"
          />
          {form.formState.errors.primaryContactFirstName && (
            <p className="text-xs text-red-500">
              {form.formState.errors.primaryContactFirstName.message}
            </p>
          )}
        </div>
        <div className="grid gap-2">
          <Label>Last Name <span className="text-red-500">*</span></Label>
          <Input
            {...form.register("primaryContactLastName")}
            placeholder="Doe"
          />
          {form.formState.errors.primaryContactLastName && (
            <p className="text-xs text-red-500">
              {form.formState.errors.primaryContactLastName.message}
            </p>
          )}
        </div>
      </div>

      {/* Email */}
      <div className="grid gap-2">
        <Label>Email <span className="text-red-500">*</span></Label>
        <Input
          type="email"
          {...form.register("primaryContactEmail")}
          placeholder="jane@example.com"
        />
        {form.formState.errors.primaryContactEmail && (
          <p className="text-xs text-red-500">
            {form.formState.errors.primaryContactEmail.message}
          </p>
        )}
      </div>

      {/* Phone */}
      {/* <div className="grid gap-2">
        <Label>Phone</Label>
        <Input
          placeholder="555-888-3333"
          value={formatPhoneNumber(form.watch("primaryContactPhone"))}
          onChange={(e) => {
            const digitsOnly = e.target.value.replace(/\D/g, " ").slice(0, 10);
            form.setValue("primaryContactPhone", digitsOnly);
          }}
        />
      </div> */}

      {/* Phone */}
      <div className="grid gap-2">
        <Label>Phone <span className="text-red-500">*</span></Label>
        <Controller
          control={form.control}
          name="primaryContactPhone"
          render={({ field }) => (
            <Input
              {...field}
              placeholder="555-888-3333"
              inputMode="numeric"
              maxLength={12} // 123-456-7891
              onChange={(e) => {
                const formatted = formatPhoneInput(e.target.value);
                field.onChange(formatted);
              }}
            />
          )}
        />
        {form.formState.errors.primaryContactPhone && (
          <p className="text-xs text-red-500">
            {form.formState.errors.primaryContactPhone.message}
          </p>
        )}
      </div>


      {/* <Controller
        control={form.control}
        name="primaryContactPhone"
        render={({ field }) => (
          <Input
            placeholder="123-456-7891"
            value={formatPhone(field.value)}
            onChange={(e) => {
              const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 10);
              field.onChange(digitsOnly);
            }}
            inputMode="numeric"
          />
        )}
      /> */}

      {/* Code + SLA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>Code</Label>
          <Input {...form.register("code")} placeholder="CLI-001" />
        </div>

        <div className="grid gap-2">
          <Label>SLA Number</Label>
          <Input
            {...form.register("slaNumber")}
            placeholder="SLA-2025-01"
          />
        </div>
      </div>

      {/* Service Center */}
      <div className="grid gap-2">
        <Label>Service Center</Label>
        <Select
          value={form.watch("serviceCenterId") || ""}
          onValueChange={(v) => form.setValue("serviceCenterId", v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Assign service center" />
          </SelectTrigger>
          <SelectContent>
            {serviceCenters.map((sc: any) => (
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
        <Label>CPA</Label>
        <Select
          value={form.watch("cpaId") || ""}
          onValueChange={(v) => form.setValue("cpaId", v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Assign CPA" />
          </SelectTrigger>
          <SelectContent>
            {cpas.map((c: any) => (
              <SelectItem
                key={c.cpa_id}
                value={String(c.cpa_id)}
              >
                {c.cpa_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Associated Users */}
      <div className="mt-4 border-t pt-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="font-medium">Associated Users</p>
            <p className="text-xs text-muted-foreground">
              Team members who will access this client.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({ firstName: "", lastName: "", email: "", phone: "" })
            }
          >
            + Add another user
          </Button>
        </div>

        <div className="grid gap-3">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="grid grid-cols-1 md:grid-cols-[1fr,1fr,1fr,1fr,auto] gap-2 items-end"
            >
              <div className="grid gap-1">
                <Label className="text-xs">First Name</Label>
                <Input
                  {...form.register(`associatedUsers.${index}.firstName` as const)}
                  placeholder="John"
                />
              </div>

              <div className="grid gap-1">
                <Label className="text-xs">Last Name</Label>
                <Input
                  {...form.register(`associatedUsers.${index}.lastName` as const)}
                  placeholder="Doe"
                />
              </div>

              <div className="grid gap-1">
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  {...form.register(`associatedUsers.${index}.email` as const)}
                  placeholder="john@example.com"
                />
              </div>

              <div className="grid gap-1">
                <Label className="text-xs">Phone</Label>
                <Controller
                  control={form.control}
                  name={`associatedUsers.${index}.phone` as const}
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
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(index)}
                aria-label="Remove associated user"
              >
                ✕
              </Button>
            </div>
          ))}
          {fields.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No associated users yet. You can add them later.
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/admin/clients")}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create Client"}
        </Button>
      </div>
    </form>
  );
}
