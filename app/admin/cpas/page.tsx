"use client";

import { useState, useEffect } from "react";
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
  UserCheck, Mail, Briefcase, Plus, Pencil, Trash2, Search,
  ExternalLink, MoreVertical, FileText
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function CPAsPage() {
  const [cpas, setCPAs] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
  });

  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const [openClientsModal, setOpenClientsModal] = useState(false);
  const [selectedCPA, setSelectedCPA] = useState<any | null>(null);
  const [assignedClients, setAssignedClients] = useState<any[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [formErrors, setFormErrors] = useState<{ name?: string; email?: string }>({});

  // ==========================
  // LOAD CPA LIST FROM SQL
  // ==========================
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/cpas/get");
        const json = await res.json();
        setCPAs(json.data || []);
      } catch (err) {
        console.error("Failed to load CPAs", err);
      }
    }
    load();
  }, []);


  // ==========================
  // OPEN ASSIGNED CLIENTS
  // ==========================
  async function openAssignedClients(cpa: any) {
    setSelectedCPA(cpa);
    setOpenClientsModal(true);
    setLoadingClients(true);

    try {
      const res = await fetch(
        `/api/clients/get-by-cpa?cpaId=${cpa.cpa_id}`
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


  // ==========================
  // OPEN MODAL FOR EDIT/NEW
  // ==========================
  function handleOpenDialog(cpa?: any) {
    if (cpa) {
      setEditingId(cpa.cpa_id);
      setFormData({
        name: cpa.cpa_name,
        email: cpa.email ?? "",
      });
    } else {
      setEditingId(null);
      setFormData({ name: "", email: "" });
    }

    setFormErrors({});
    setOpen(true);
  }

  // ==========================
  // SAVE (CREATE OR UPDATE)
  // ==========================
  async function handleSave() {
    // Validate required fields
    const errors: { name?: string; email?: string } = {};

    if (!formData.name.trim()) {
      errors.name = "Preparer Name is required";
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
      if (editingId) {
        // UPDATE
        const res = await fetch("/api/cpas/update", {
          method: "POST", // using POST as per original file
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cpa_id: editingId,
            name: formData.name,
            email: formData.email,
          }),
        });

        const json = await res.json();
        if (!json.success) {
          toast({ title: "Error", description: json.message, variant: "destructive" });
          return;
        }

        toast({ title: "Updated", description: "Preparer updated successfully", variant: "success" });
      } else {
        // CREATE
        const res = await fetch("/api/cpas/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
          }),
        });

        const json = await res.json();
        if (!json.success) {
          toast({ title: "Error", description: json.message, variant: "destructive" });
          return;
        }

        toast({ title: "Created", description: "New Preparer created successfully", variant: "success" });
      }

      // Reload list
      const reload = await fetch("/api/cpas/get");
      setCPAs((await reload.json()).data);

      setOpen(false);

    } catch (err) {
      toast({ title: "Error", description: "Something went wrong", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }

  // ==========================
  // DELETE CPA
  // ==========================
  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this Preparer?")) return;

    try {
      const res = await fetch("/api/cpas/delete", {
        method: "POST",
        body: JSON.stringify({ cpa_id: id }),
      });

      const json = await res.json();

      if (!json.success) {
        toast({ title: "Error", description: json.message, variant: "destructive" });
        return;
      }

      toast({ title: "Deleted", description: "Preparer deleted" });

      const reload = await fetch("/api/cpas/get");
      setCPAs((await reload.json()).data);
    } catch (err) {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  }


  // ==========================
  // FILTERING
  // ==========================
  const filteredCPAs = cpas.filter(c =>
    c.cpa_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Preparers</h1>
          <p className="text-muted-foreground mt-1">Manage Preparers and their client assignments.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search Preparers..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" /> Add Preparer
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit Preparer Details" : "New Preparer"}</DialogTitle>
              </DialogHeader>

              <div className="grid gap-6 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Full Name <span className="text-red-500">*</span></Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      if (formErrors.name) setFormErrors({ ...formErrors, name: undefined });
                    }}
                    placeholder="e.g. John Doe"
                  />
                  {formErrors.name && (
                    <p className="text-xs text-red-500">{formErrors.name}</p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="email">Email Address <span className="text-red-500">*</span></Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      if (formErrors.email) setFormErrors({ ...formErrors, email: undefined });
                    }}
                    placeholder="contact@cpa-firm.com"
                  />
                  {formErrors.email && (
                    <p className="text-xs text-red-500">{formErrors.email}</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>

                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (editingId ? "Updating..." : "Creating...") : (editingId ? "Update Preparer" : "Create Preparer")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* CARDS GRID */}
      {filteredCPAs.length === 0 ? (
        <div className="text-center py-20 bg-muted/20 rounded-lg border-2 border-dashed">
          <UserCheck className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <h3 className="text-lg font-medium">No Preparers Found</h3>
          <p className="text-muted-foreground text-sm mt-1">Try adjusting your search or add a new Preparer.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCPAs.map((c) => (
            <Card key={c.cpa_id} className="hover:shadow-md transition-shadow group relative overflow-hidden flex flex-col">
              {/* Top Accent Border */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />

              <CardHeader className="pb-3 pt-5">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <UserCheck className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-lg font-bold truncate pr-2">{c.cpa_name}</CardTitle>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-muted-foreground">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenDialog(c)}>
                        <Pencil className="mr-2 h-4 w-4" /> Edit Details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleDelete(c.cpa_id)}
                        disabled={c.client_count > 0}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete Preparer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 flex-1">
                <div className="grid gap-3">
                  <div className="flex items-center text-sm text-muted-foreground overflow-hidden">
                    <Mail className="h-4 w-4 mr-2.5 opacity-70 shrink-0" />
                    {c.email ? (
                      <span className="truncate">{c.email}</span>
                    ) : (
                      <span className="italic text-muted-foreground/50">No email provided</span>
                    )}
                  </div>

                  <div className="flex items-center text-sm text-muted-foreground">
                    <Briefcase className="h-4 w-4 mr-2.5 opacity-70 shrink-0" />
                    <span className="font-medium text-foreground mr-1">{c.client_count}</span> Clients Assigned
                  </div>
                </div>
              </CardContent>

              <div className="p-4 pt-0 mt-auto">
                <Button
                  variant="outline"
                  className="w-full border-dashed"
                  onClick={() => openAssignedClients(c)}
                >
                  <FileText className="mr-2 h-4 w-4" /> View Client List
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}


      <Dialog open={openClientsModal} onOpenChange={setOpenClientsModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2 border-b">
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-emerald-600" />
              <span>Clients assigned to {selectedCPA?.cpa_name}</span>
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
                <p className="text-muted-foreground text-sm max-w-sm mt-1">This Preparer does not have any clients assigned to them yet.</p>
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
