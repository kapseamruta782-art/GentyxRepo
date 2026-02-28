"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, Mail, Pencil, Trash2, Search,
  ExternalLink, MoreVertical, Briefcase, FileText, Plus
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ServiceCenter = {
  center_id: number;
  center_code: string;
  center_name: string;
  email: string;
  clients_assigned: number;
};

export default function ServiceCentersPage() {
  const [serviceCenters, setServiceCenters] = useState<ServiceCenter[]>([]);
  const [editing, setEditing] = useState<ServiceCenter | null>(null);

  const [formData, setFormData] = useState({
    center_name: "",
    center_code: "",
    email: "",
  });



  const [isSaving, setIsSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [openClientsModal, setOpenClientsModal] = useState(false);
  const [selectedCenter, setSelectedCenter] = useState<ServiceCenter | null>(null);
  const [assignedClients, setAssignedClients] = useState<any[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [formErrors, setFormErrors] = useState<{ center_name?: string; email?: string }>({});


  // ------------------------------
  // LOAD SERVICE CENTERS
  // ------------------------------
  async function loadCenters() {
    try {
      const res = await fetch("/api/service-centers/list?page=1&pageSize=100");

      if (!res.ok) {
        toast({
          title: "Error",
          description: `Failed to load service centers (${res.status})`,
          variant: "destructive",
        });
        return;
      }

      const json = await res.json();

      // Handle different possible shapes: { data: [...] } or just [...]
      const raw = Array.isArray(json)
        ? json
        : json.data ?? json.centers ?? json.serviceCenters ?? [];

      // normalize field names
      const centers: ServiceCenter[] = raw.map((c: any) => ({
        center_id: c.center_id ?? c.centerId ?? c.id,
        center_name: c.center_name ?? c.name,
        center_code: c.center_code ?? c.code ?? "",
        email: c.email,
        clients_assigned: Number(c.clients_assigned || 0),
      }));

      setServiceCenters(centers);
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to load service centers",
        variant: "destructive",
      });
    }
  }

  useEffect(() => {
    loadCenters();
  }, []);

  // ------------------------------
  // OPEN DIALOG
  // ------------------------------
  function openDialog(center?: ServiceCenter) {
    if (center) {
      setEditing(center);

      setFormData({
        center_name: center.center_name ?? "",
        center_code: center.center_code ?? "",
        email: center.email ?? "",
      });

    } else {
      setEditing(null);

      setFormData({ center_name: "", center_code: "", email: "" });
    }

    setFormErrors({});
    setOpen(true);
  }


  // ------------------------------
  // CREATE / UPDATE
  // ------------------------------
  async function saveCenter() {
    // Validate required fields
    const errors: { center_name?: string; email?: string } = {};

    if (!formData.center_name.trim()) {
      errors.center_name = "Center Name is required";
    }
    if (!formData.email.trim()) {
      errors.email = "Email Address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Please enter a valid email address";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});

    setIsSaving(true);

    try {
      let payload: any;

      if (!editing) {
        payload = {
          name: formData.center_name,
          email: formData.email,
        };
      } else {
        payload = {
          center_id: editing.center_id,
          center_name: formData.center_name,
          center_code: formData.center_code,
          email: formData.email,
        };
      }

      const res = await fetch(
        editing ? "/api/service-centers/update" : "/api/service-centers/create",
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const json = await res.json();

      if (!json.success) {
        toast({ title: "Error", description: json.error, variant: "destructive" });
        return;
      }

      toast({
        title: editing ? "Updated" : "Created",
        description: `Service Center ${editing ? "updated" : "created"} successfully`,
        variant: "success",
      });

      setOpen(false);
      loadCenters();
    } finally {
      setIsSaving(false);
    }
  }



  // ------------------------------  OPEN ASSIGNED CLIENTS MODAL --------------------------------
  async function openAssignedClients(center: ServiceCenter) {
    setSelectedCenter(center);
    setOpenClientsModal(true);
    setLoadingClients(true);

    try {
      const res = await fetch(
        `/api/clients/get-by-service-center?serviceCenterId=${center.center_id}`
      );

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error);
      }

      setAssignedClients(json.data || []);
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "Failed to load assigned clients",
        variant: "destructive",
      });
    } finally {
      setLoadingClients(false);
    }
  }

  // ------------------------------
  // DELETE
  // ------------------------------
  async function deleteCenter(center_id: number) {
    if (!confirm("Are you sure you want to delete this service center?")) return;

    const res = await fetch(`/api/service-centers/delete?id=${center_id}`, {
      method: "DELETE",
    });

    const json = await res.json();

    if (!json.success) {
      toast({ title: "Error", description: json.error, variant: "destructive" });
      return;
    }

    toast({ title: "Deleted", description: "Service Center deleted" });
    loadCenters();
  }


  // ------------------------------
  // UI
  // ------------------------------
  const [searchTerm, setSearchTerm] = useState("");

  const filteredCenters = serviceCenters.filter((center) =>
    center.center_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (center.email && center.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Service Centers</h1>
          <p className="text-muted-foreground mt-1">Manage service centers and their associated users.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search centers..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => openDialog()}>
                <Plus className="mr-2 h-4 w-4" /> Add Center
              </Button>
            </DialogTrigger>

            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit Service Center" : "New Service Center"}</DialogTitle>
              </DialogHeader>

              <form
                className="grid gap-6 py-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveCenter();
                }}
              >
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>Center Name <span className="text-red-500">*</span></Label>
                    <Input
                      placeholder="e.g. Downtown Operations"
                      value={formData.center_name}
                      onChange={(e) => {
                        setFormData({ ...formData, center_name: e.target.value });
                        if (formErrors.center_name) setFormErrors({ ...formErrors, center_name: undefined });
                      }}
                    />
                    {formErrors.center_name && (
                      <p className="text-xs text-red-500">{formErrors.center_name}</p>
                    )}
                  </div>

                  {/* Hidden Center Code */}
                  <input type="hidden" value={formData.center_code} />

                  <div className="grid gap-2">
                    <Label>Email Address <span className="text-red-500">*</span></Label>
                    <Input
                      placeholder="contact@example.com"
                      value={formData.email}
                      onChange={(e) => {
                        setFormData({ ...formData, email: e.target.value });
                        if (formErrors.email) setFormErrors({ ...formErrors, email: undefined });
                      }}
                    />
                    {formErrors.email && (
                      <p className="text-xs text-red-500">{formErrors.email}</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-2">
                  <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? "Saving..." : editing ? "Update Center" : "Create Center"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* CARDS GRID */}
      {filteredCenters.length === 0 ? (
        <div className="text-center py-20 bg-muted/20 rounded-lg border-2 border-dashed">
          <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <h3 className="text-lg font-medium">No Service Centers Found</h3>
          <p className="text-muted-foreground text-sm mt-1">Try adjusting your search or add a new one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCenters.map((center) => (
            <Card key={center.center_id} className="hover:shadow-md transition-shadow group relative overflow-hidden flex flex-col">
              {/* Top Accent Border */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />

              <CardHeader className="pb-3 pt-5">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-lg font-bold truncate pr-2">{center.center_name}</CardTitle>
                      {/* <p className="text-xs text-muted-foreground mt-0.5">{center.center_code || "No Code"}</p> */}
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-muted-foreground">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openDialog(center)}>
                        <Pencil className="mr-2 h-4 w-4" /> Edit Details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => deleteCenter(center.center_id)}
                        disabled={center.clients_assigned > 0}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete Center
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 flex-1">
                <div className="grid gap-3">
                  <div className="flex items-center text-sm text-muted-foreground overflow-hidden">
                    <Mail className="h-4 w-4 mr-2.5 opacity-70 shrink-0" />
                    {center.email ? (
                      <span className="truncate">{center.email}</span>
                    ) : (
                      <span className="italic text-muted-foreground/50">No email provided</span>
                    )}
                  </div>

                  <div className="flex items-center text-sm text-muted-foreground">
                    <Briefcase className="h-4 w-4 mr-2.5 opacity-70 shrink-0" />
                    <span>{center.clients_assigned} Clients Assigned</span>
                  </div>
                </div>



              </CardContent>
              <div className="p-4 pt-0 mt-auto">
                <Button
                  variant="outline"
                  className="w-full border-dashed"
                  onClick={() => openAssignedClients(center)}
                >
                  <FileText className="mr-2 h-4 w-4" /> View Client List
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ASSIGNED CLIENTS MODAL */}
      <Dialog open={openClientsModal} onOpenChange={setOpenClientsModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <span>Clients at {selectedCenter?.center_name}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 bg-muted/10">
            {loadingClients ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                <p className="text-muted-foreground font-medium">Loading clients...</p>
              </div>
            ) : assignedClients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Briefcase className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <h3 className="text-lg font-medium">No Clients Assigned</h3>
                <p className="text-muted-foreground text-sm max-w-sm mt-1">This service center does not have any clients assigned to it yet.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {assignedClients.map((c) => (
                  <div
                    key={c.client_id}
                    className="flex justify-between items-center p-4 bg-background border rounded-lg shadow-sm hover:shadow-md transition-all"
                  >
                    <div>
                      <div className="font-semibold text-lg">{c.client_name}</div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {c.code && <span className="bg-muted px-1.5 py-0.5 rounded">Code: {c.code}</span>}
                        {c.status && <span>Status: {c.status}</span>}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={() =>
                        window.location.href = `/admin/clients/${c.client_id}`
                      }
                    >
                      View <ExternalLink className="ml-2 h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
