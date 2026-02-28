// app/admin/clients/edit/[id]/page.tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function EditClientPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [form, setForm] = useState({
    client_name: "",
    code: "",
    primary_contact_first_name: "",
    primary_contact_last_name: "",
    primary_contact_email: "",
    primary_contact_phone: "",
    service_center_id: "",
    cpa_id: "",
  });

  const [serviceCenters, setServiceCenters] = useState<any[]>([]);
  const [cpas, setCpas] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // ✅ LOAD CLIENT + DROPDOWN DATA
  useEffect(() => {
    if (!id) return;

    const loadAll = async () => {
      const [clientRes, scRes, cpaRes] = await Promise.all([
        fetch(`/api/clients/${id}/get`).then((r) => r.json()),
        fetch("/api/service-centers/get").then((r) => r.json()),
        fetch("/api/cpas/get").then((r) => r.json()),
      ]);

      if (clientRes?.success) {
        setForm({
          client_name: clientRes.data.client_name || "",
          code: clientRes.data.code || "",
          primary_contact_first_name: clientRes.data.primary_contact_first_name || "",
          primary_contact_last_name: clientRes.data.primary_contact_last_name || "",
          primary_contact_email: clientRes.data.primary_contact_email || "",
          primary_contact_phone: clientRes.data.primary_contact_phone || "",
          service_center_id:
            clientRes.data.service_center_id?.toString() || "unassigned",
          cpa_id: clientRes.data.cpa_id?.toString() || "unassigned",
        });
      }

      if (scRes?.success) setServiceCenters(scRes.data || []);
      if (cpaRes?.success) setCpas(cpaRes.data || []);
    };

    loadAll();
  }, [id]);

  // ✅ SAVE HANDLER
  async function handleSave() {
    setSaving(true);

    // Convert "unassigned" to empty string (which sends as null)
    const payload = {
      ...form,
      service_center_id: form.service_center_id === "unassigned" ? "" : form.service_center_id,
      cpa_id: form.cpa_id === "unassigned" ? "" : form.cpa_id,
    };

    const res = await fetch("/api/clients/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: id, ...payload }),
    });

    const json = await res.json();

    if (!json.success) {
      toast({
        title: "Update failed",
        description: json.error,
        variant: "destructive",
      });
      setSaving(false);
      return;
    }

    toast({ title: "Client updated successfully", variant: "success" });
    router.push(`/admin/clients/${id}`);
  }

  return (
    <div className="max-w-2xl p-6">
      <h1 className="text-xl font-semibold mb-6">Edit Client</h1>

      <div className="grid gap-4">
        <div>
          <label className="text-sm font-medium">Client Name</label>
          <Input
            value={form.client_name}
            onChange={(e) =>
              setForm({ ...form, client_name: e.target.value })
            }
          />
        </div>

        <div>
          <label className="text-sm font-medium">Client Code</label>
          <Input
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">First Name</label>
            <Input
              value={form.primary_contact_first_name}
              onChange={(e) =>
                setForm({ ...form, primary_contact_first_name: e.target.value })
              }
            />
          </div>
          <div>
            <label className="text-sm font-medium">Last Name</label>
            <Input
              value={form.primary_contact_last_name}
              onChange={(e) =>
                setForm({ ...form, primary_contact_last_name: e.target.value })
              }
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Primary Contact Email</label>
          <Input
            value={form.primary_contact_email}
            onChange={(e) =>
              setForm({ ...form, primary_contact_email: e.target.value })
            }
          />
        </div>

        <div>
          <label className="text-sm font-medium">Primary Contact Phone</label>
          <Input
            value={form.primary_contact_phone}
            onChange={(e) => {
              const input = e.target.value.replace(/\D/g, "").substring(0, 10);
              let formatted = input;
              if (input.length > 6) {
                formatted = `${input.substring(0, 3)}-${input.substring(3, 6)}-${input.substring(6)}`;
              } else if (input.length > 3) {
                formatted = `${input.substring(0, 3)}-${input.substring(3)}`;
              }
              setForm({ ...form, primary_contact_phone: formatted });
            }}
          />
        </div>

        {/* ✅ SERVICE CENTER DROPDOWN */}
        <div>
          <label className="text-sm font-medium">Assigned Service Center</label>
          <Select
            value={form.service_center_id}
            onValueChange={(v) =>
              setForm({ ...form, service_center_id: v })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Assign service center" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned" className="text-muted-foreground italic">
                Not Assigned
              </SelectItem>
              {serviceCenters.map((sc) => (
                <SelectItem
                  key={sc.service_center_id}
                  value={sc.service_center_id.toString()}
                >
                  {sc.center_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ✅ CPA DROPDOWN */}
        <div>
          <label className="text-sm font-medium">Assigned Preparers</label>
          <Select
            value={form.cpa_id}
            onValueChange={(v) => setForm({ ...form, cpa_id: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Assign CPA" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned" className="text-muted-foreground italic">
                Not Assigned
              </SelectItem>
              {cpas.map((cpa) => (
                <SelectItem key={cpa.cpa_id} value={cpa.cpa_id.toString()}>
                  {cpa.cpa_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ✅ ACTIONS */}
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
