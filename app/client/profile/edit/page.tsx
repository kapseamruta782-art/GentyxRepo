// app/client/profile/edit/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUIStore } from "@/store/ui-store";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Save } from "lucide-react";

export default function EditClientProfilePage() {
    const router = useRouter();
    const { toast } = useToast();
    const role = useUIStore((s) => s.role);
    const currentClientId = useUIStore((s) => s.currentClientId);

    const [clientId, setClientId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState({
        client_name: "",
        code: "",
        primary_contact_name: "",
        primary_contact_email: "",
        primary_contact_phone: "",
    });

    // Wait for client context
    useEffect(() => {
        if (role === "CLIENT" && currentClientId) {
            setClientId(currentClientId);
        }
    }, [role, currentClientId]);

    // Load client data
    useEffect(() => {
        if (!clientId) return;

        const loadClient = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/clients/${clientId}/get`);
                const json = await res.json();

                if (json?.success && json.data) {
                    setForm({
                        client_name: json.data.client_name || "",
                        code: json.data.code || "",
                        primary_contact_name: json.data.primary_contact_name || "",
                        primary_contact_email: json.data.primary_contact_email || "",
                        primary_contact_phone: json.data.primary_contact_phone || "",
                    });
                }
            } catch (err) {
                console.error("Failed to load client:", err);
                toast({
                    title: "Failed to load profile",
                    variant: "destructive",
                });
            } finally {
                setLoading(false);
            }
        };

        loadClient();
    }, [clientId, toast]);

    // Save handler
    async function handleSave() {
        if (!clientId) return;

        setSaving(true);

        try {
            const res = await fetch("/api/clients/update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientId,
                    client_name: form.client_name,
                    primary_contact_name: form.primary_contact_name,
                    primary_contact_email: form.primary_contact_email,
                    primary_contact_phone: form.primary_contact_phone,
                }),
            });

            const json = await res.json();

            if (!json.success) {
                throw new Error(json.error || "Update failed");
            }

            toast({ title: "Profile updated successfully" });
            router.push("/client/profile");
        } catch (err: any) {
            toast({
                title: "Update failed",
                description: err.message,
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Loading profile...</span>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-2xl font-bold">Edit Profile</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Your Information</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-5">
                    {/* Company Name */}
                    <div className="grid gap-2">
                        <label className="text-sm font-medium text-foreground">
                            Company Name
                        </label>
                        <Input
                            value={form.client_name}
                            onChange={(e) =>
                                setForm({ ...form, client_name: e.target.value })
                            }
                            placeholder="Enter company name"
                        />
                    </div>

                    {/* Client Code - Read Only */}
                    <div className="grid gap-2">
                        <label className="text-sm font-medium text-foreground">
                            Client Code
                            <span className="ml-2 text-xs text-muted-foreground">
                                (Read-only)
                            </span>
                        </label>
                        <Input
                            value={form.code}
                            disabled
                            className="bg-muted cursor-not-allowed"
                        />
                    </div>

                    {/* Contact Name */}
                    <div className="grid gap-2">
                        <label className="text-sm font-medium text-foreground">
                            Primary Contact Name
                        </label>
                        <Input
                            value={form.primary_contact_name}
                            onChange={(e) =>
                                setForm({ ...form, primary_contact_name: e.target.value })
                            }
                            placeholder="Enter contact name"
                        />
                    </div>

                    {/* Contact Email - Read Only */}
                    <div className="grid gap-2">
                        <label className="text-sm font-medium text-foreground">
                            Primary Contact Email
                            <span className="ml-2 text-xs text-muted-foreground">
                                (Read-only)
                            </span>
                        </label>
                        <Input
                            type="email"
                            value={form.primary_contact_email}
                            disabled
                            className="bg-muted cursor-not-allowed"
                        />
                    </div>

                    {/* Contact Phone */}
                    <div className="grid gap-2">
                        <label className="text-sm font-medium text-foreground">
                            Primary Contact Phone
                        </label>
                        <Input
                            type="tel"
                            value={form.primary_contact_phone}
                            onChange={(e) =>
                                setForm({ ...form, primary_contact_phone: e.target.value })
                            }
                            placeholder="Enter contact phone"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button variant="outline" onClick={() => router.back()}>
                            Cancel
                        </Button>

                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Save Changes
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
