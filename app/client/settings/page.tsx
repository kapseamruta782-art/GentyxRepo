// app/client/settings/page.tsx
"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useUIStore } from "@/store/ui-store";
import { useRouter } from "next/navigation";
import {
    User,
    Bell,
    Shield,
    Activity,
    Save,
    Eye,
    EyeOff,
    Check,
    Building2,
    Phone,
    Mail,
    UserCircle,
    Settings,
} from "lucide-react";

export default function ClientSettingsPage() {
    const { toast } = useToast();
    const router = useRouter();
    const role = useUIStore((s) => s.role);
    const currentClientId = useUIStore((s) => s.currentClientId);

    const [clientId, setClientId] = useState<string | null>(null);

    // Wait for client context
    useEffect(() => {
        if (role === "CLIENT" && currentClientId) {
            setClientId(currentClientId);
        }
    }, [role, currentClientId]);

    // Fetch client data
    const { data: client, mutate: refreshClient } = useSWR(
        clientId ? ["client-settings", clientId] : null,
        async () => {
            const res = await fetch(`/api/clients/${clientId}/get`);
            if (!res.ok) return null;
            const json = await res.json();
            return json.data;
        }
    );

    // Profile state
    const [profileData, setProfileData] = useState({
        clientName: "",
        contactName: "",
        email: "",
        phone: "",
    });

    // Sync profile data when client loads
    useEffect(() => {
        if (client) {
            setProfileData({
                clientName: client.client_name || "",
                contactName: client.primary_contact_name || "",
                email: client.primary_contact_email || "",
                phone: client.primary_contact_phone || "",
            });
        }
    }, [client]);

    // Notification settings state
    const [notifications, setNotifications] = useState({
        emailAlerts: true,
        taskReminders: true,
        stageUpdates: true,
        messageNotifications: true,
        weeklyDigest: false,
    });

    // Password visibility
    const [showPassword, setShowPassword] = useState(false);
    const [passwordData, setPasswordData] = useState({
        newPassword: "",
        confirmPassword: "",
    });

    const [isSaving, setIsSaving] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    // Save profile changes
    const handleSaveProfile = async () => {
        if (!clientId) return;

        setIsSaving(true);
        try {
            const res = await fetch("/api/clients/update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    client_id: parseInt(clientId),
                    client_name: profileData.clientName,
                    primary_contact_name: profileData.contactName,
                    primary_contact_email: profileData.email,
                    primary_contact_phone: profileData.phone,
                }),
            });

            if (res.ok) {
                toast({
                    title: "Profile Updated",
                    description: "Your profile has been saved successfully.",
                });
                refreshClient();
            } else {
                toast({
                    title: "Error",
                    description: "Failed to save profile. Please try again.",
                    variant: "destructive",
                });
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "An error occurred while saving.",
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    // Save notification preferences
    const handleSaveNotifications = () => {
        // In a real app, this would save to the backend
        toast({
            title: "Preferences Updated",
            description: "Your notification preferences have been saved.",
        });
    };

    // Handle password change
    const handleChangePassword = async () => {
        if (!passwordData.newPassword) {
            toast({
                title: "Error",
                description: "Please enter a new password.",
                variant: "destructive",
            });
            return;
        }

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            toast({
                title: "Error",
                description: "Passwords do not match.",
                variant: "destructive",
            });
            return;
        }

        if (passwordData.newPassword.length < 8) {
            toast({
                title: "Error",
                description: "Password must be at least 8 characters.",
                variant: "destructive",
            });
            return;
        }

        setIsChangingPassword(true);
        try {
            const res = await fetch("/api/clients/update-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientId: parseInt(clientId!),
                    newPassword: passwordData.newPassword,
                }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                toast({
                    title: "Password Changed",
                    description: "Your password has been updated successfully.",
                });
                setPasswordData({
                    newPassword: "",
                    confirmPassword: "",
                });
            } else {
                toast({
                    title: "Error",
                    description: data.error || "Failed to update password.",
                    variant: "destructive",
                });
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "An error occurred while updating password.",
                variant: "destructive",
            });
        } finally {
            setIsChangingPassword(false);
        }
    };

    if (!clientId) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-3 text-muted-foreground">Loading...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Settings className="h-6 w-6 text-primary" />
                        Settings
                    </h1>
                    <p className="text-muted-foreground">
                        Manage your account settings and preferences
                    </p>
                </div>
            </div>

            <Tabs defaultValue="profile" className="space-y-6">
                <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
                    <TabsTrigger value="profile" className="gap-2">
                        <User className="h-4 w-4" />
                        <span className="hidden sm:inline">Profile</span>
                    </TabsTrigger>
                    {/* <TabsTrigger value="notifications" className="gap-2">
                        <Bell className="h-4 w-4" />
                        <span className="hidden sm:inline">Notifications</span>
                    </TabsTrigger> */}
                    <TabsTrigger value="security" className="gap-2">
                        <Shield className="h-4 w-4" />
                        <span className="hidden sm:inline">Password</span>
                    </TabsTrigger>
                </TabsList>

                {/* ============ PROFILE TAB ============ */}
                <TabsContent value="profile">
                    <div className="space-y-6">
                        {/* Account Info Card */}
                        <Card className="bg-gradient-to-r from-primary/5 via-primary/10 to-transparent border-primary/20">
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-4">
                                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Building2 className="h-8 w-8 text-primary" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold">
                                            {client?.client_name || "Your Company"}
                                        </h2>
                                        <p className="text-sm text-muted-foreground">
                                            Client Code: {client?.code || "—"}
                                        </p>
                                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                            {client?.primary_contact_email && (
                                                <span className="flex items-center gap-1">
                                                    <Mail className="h-3 w-3" />
                                                    {client.primary_contact_email}
                                                </span>
                                            )}
                                            {client?.primary_contact_phone && (
                                                <span className="flex items-center gap-1">
                                                    <Phone className="h-3 w-3" />
                                                    {client.primary_contact_phone}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Edit Profile Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <User className="h-5 w-5 text-primary" />
                                    Profile Information
                                </CardTitle>
                                <CardDescription>
                                    Update your company and contact information
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="clientName">Company Name</Label>
                                        <Input
                                            id="clientName"
                                            placeholder="Enter company name"
                                            value={profileData.clientName}
                                            onChange={(e) =>
                                                setProfileData({ ...profileData, clientName: e.target.value })
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="contactName">Primary Contact Name</Label>
                                        <Input
                                            id="contactName"
                                            placeholder="Enter contact name"
                                            value={profileData.contactName}
                                            onChange={(e) =>
                                                setProfileData({ ...profileData, contactName: e.target.value })
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="email">Email Address</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="Enter email"
                                            value={profileData.email}
                                            onChange={(e) =>
                                                setProfileData({ ...profileData, email: e.target.value })
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="phone">Phone Number</Label>
                                        <Input
                                            id="phone"
                                            placeholder="Enter phone number"
                                            value={profileData.phone}
                                            onChange={(e) =>
                                                setProfileData({ ...profileData, phone: e.target.value })
                                            }
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <Button
                                        onClick={handleSaveProfile}
                                        disabled={isSaving}
                                        className="gap-2"
                                    >
                                        <Save className="h-4 w-4" />
                                        {isSaving ? "Saving..." : "Save Changes"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Assigned Team Card - only show if at least one is assigned */}
                        {(client?.service_center_name || client?.cpa_name) && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <UserCircle className="h-5 w-5 text-primary" />
                                        Your Assigned Team
                                    </CardTitle>
                                    <CardDescription>
                                        Your service center and Preparer assignments
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border">
                                            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                                                <Building2 className="h-6 w-6 text-blue-600" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                                    Service Center
                                                </p>
                                                <p className="text-lg font-semibold">
                                                    {client?.service_center_name || "Not Assigned"}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border">
                                            <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                                                <UserCircle className="h-6 w-6 text-purple-600" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                                    Preparer
                                                </p>
                                                <p className="text-lg font-semibold">
                                                    {client?.cpa_name || "Not Assigned"}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </TabsContent>

                {/* ============ NOTIFICATIONS TAB ============ */}
                <TabsContent value="notifications">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Bell className="h-5 w-5 text-primary" />
                                Notification Preferences
                            </CardTitle>
                            <CardDescription>
                                Configure how you receive notifications and alerts
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">Email Alerts</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Receive email notifications for important updates
                                        </p>
                                    </div>
                                    <Switch
                                        checked={notifications.emailAlerts}
                                        onCheckedChange={(checked) =>
                                            setNotifications({ ...notifications, emailAlerts: checked })
                                        }
                                    />
                                </div>

                                <div className="flex items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">Task Reminders</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Get reminded before task due dates
                                        </p>
                                    </div>
                                    <Switch
                                        checked={notifications.taskReminders}
                                        onCheckedChange={(checked) =>
                                            setNotifications({ ...notifications, taskReminders: checked })
                                        }
                                    />
                                </div>

                                <div className="flex items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">Stage Updates</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Notifications when onboarding stages change
                                        </p>
                                    </div>
                                    <Switch
                                        checked={notifications.stageUpdates}
                                        onCheckedChange={(checked) =>
                                            setNotifications({ ...notifications, stageUpdates: checked })
                                        }
                                    />
                                </div>

                                <div className="flex items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">Message Notifications</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Get notified when you receive new messages from your admin
                                        </p>
                                    </div>
                                    <Switch
                                        checked={notifications.messageNotifications}
                                        onCheckedChange={(checked) =>
                                            setNotifications({
                                                ...notifications,
                                                messageNotifications: checked,
                                            })
                                        }
                                    />
                                </div>

                                <div className="flex items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">Weekly Digest</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Receive a weekly summary of your onboarding progress
                                        </p>
                                    </div>
                                    <Switch
                                        checked={notifications.weeklyDigest}
                                        onCheckedChange={(checked) =>
                                            setNotifications({ ...notifications, weeklyDigest: checked })
                                        }
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <Button onClick={handleSaveNotifications} className="gap-2">
                                    <Check className="h-4 w-4" />
                                    Save Preferences
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ============ SECURITY TAB ============ */}
                <TabsContent value="security">
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Shield className="h-5 w-5 text-primary" />
                                    Change Password
                                </CardTitle>
                                <CardDescription>
                                    Update your account password for security
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="new-password">New Password</Label>
                                        <div className="relative">
                                            <Input
                                                id="new-password"
                                                type={showPassword ? "text" : "password"}
                                                placeholder="Enter new password"
                                                value={passwordData.newPassword}
                                                onChange={(e) =>
                                                    setPasswordData({
                                                        ...passwordData,
                                                        newPassword: e.target.value,
                                                    })
                                                }
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                            >
                                                {showPassword ? (
                                                    <EyeOff className="h-4 w-4" />
                                                ) : (
                                                    <Eye className="h-4 w-4" />
                                                )}
                                            </button>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Minimum 8 characters
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="confirm-password">Confirm New Password</Label>
                                        <Input
                                            id="confirm-password"
                                            type="password"
                                            placeholder="Confirm new password"
                                            value={passwordData.confirmPassword}
                                            onChange={(e) =>
                                                setPasswordData({
                                                    ...passwordData,
                                                    confirmPassword: e.target.value,
                                                })
                                            }
                                        />
                                        {passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
                                            <p className="text-xs text-red-500">
                                                Passwords do not match
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <Button
                                        onClick={handleChangePassword}
                                        disabled={isChangingPassword || !passwordData.newPassword || passwordData.newPassword !== passwordData.confirmPassword}
                                    >
                                        {isChangingPassword ? "Updating..." : "Update Password"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Account Info */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Activity className="h-5 w-5 text-primary" />
                                    Account Information
                                </CardTitle>
                                <CardDescription>
                                    Your account details and status
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between py-2 border-b">
                                        <span className="text-sm text-muted-foreground">Client Code</span>
                                        <span className="font-medium">{client?.code || "—"}</span>
                                    </div>
                                    <div className="flex items-center justify-between py-2 border-b">
                                        <span className="text-sm text-muted-foreground">Account Status</span>
                                        <span className="font-medium text-green-600">
                                            {client?.status || "Active"}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between py-2 border-b">
                                        <span className="text-sm text-muted-foreground">Account Created</span>
                                        <span className="font-medium">
                                            {client?.created_at
                                                ? new Date(client.created_at).toLocaleDateString()
                                                : "—"}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between py-2">
                                        <span className="text-sm text-muted-foreground">Last Updated</span>
                                        <span className="font-medium">
                                            {client?.updated_at
                                                ? new Date(client.updated_at).toLocaleDateString()
                                                : "—"}
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
