// app/cpa/settings/page.tsx
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
    Landmark,
    Mail,
    Settings,
    Hash,
    Calendar,
    Users,
} from "lucide-react";

export default function CPASettingsPage() {
    const { toast } = useToast();
    const router = useRouter();
    const role = useUIStore((s) => s.role);
    const currentCpaId = useUIStore((s) => s.currentCpaId);

    const [cpaId, setCpaId] = useState<string | null>(null);

    // Wait for CPA context
    useEffect(() => {
        if (role === "CPA" && currentCpaId) {
            setCpaId(currentCpaId);
        }
    }, [role, currentCpaId]);

    // Fetch CPA data
    const { data: cpa, mutate: refreshCpa, isLoading } = useSWR(
        cpaId ? ["cpa-settings", cpaId] : null,
        async () => {
            const res = await fetch(`/api/cpas/${cpaId}/get`);
            if (!res.ok) return null;
            const json = await res.json();
            return json.data;
        }
    );

    // Fetch assigned clients count
    const { data: clientsData } = useSWR(
        cpaId ? ["cpa-clients-count", cpaId] : null,
        async () => {
            const res = await fetch(`/api/clients/get-by-cpa?cpaId=${cpaId}`);
            if (!res.ok) return { data: [] };
            return res.json();
        }
    );

    const assignedClientsCount = clientsData?.data?.length || 0;

    // Profile state
    const [profileData, setProfileData] = useState({
        cpaName: "",
        cpaCode: "",
        email: "",
    });

    // Sync profile data when CPA loads
    useEffect(() => {
        if (cpa) {
            setProfileData({
                cpaName: cpa.cpa_name || "",
                cpaCode: cpa.cpa_code || "",
                email: cpa.email || "",
            });
        }
    }, [cpa]);

    // Notification settings state
    const [notifications, setNotifications] = useState({
        emailAlerts: true,
        taskReminders: true,
        clientUpdates: true,
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
        if (!cpaId) return;

        setIsSaving(true);
        try {
            const res = await fetch("/api/cpas/update", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    cpa_id: parseInt(cpaId),
                    cpa_name: profileData.cpaName,
                    cpa_code: profileData.cpaCode,
                    email: profileData.email,
                }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                toast({
                    title: "Profile Updated",
                    description: "Your profile has been saved successfully.",
                });
                refreshCpa();
            } else {
                toast({
                    title: "Error",
                    description: data.error || "Failed to save profile. Please try again.",
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
            const res = await fetch("/api/cpas/update-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    cpaId: parseInt(cpaId!),
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

    if (!cpaId || isLoading) {
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
                        {/* Account Overview Card */}
                        <Card className="bg-gradient-to-r from-amber-500/5 via-amber-500/10 to-transparent border-amber-500/20">
                            <CardContent className="pt-6">
                                <div className="flex items-start gap-4">
                                    <div className="h-20 w-20 rounded-full bg-amber-500/10 flex items-center justify-center">
                                        <Landmark className="h-10 w-10 text-amber-600" />
                                    </div>
                                    <div className="flex-1">
                                        <h2 className="text-2xl font-bold">
                                            {cpa?.cpa_name || "Preparer"}
                                        </h2>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Preparer Account
                                        </p>
                                        <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
                                            {cpa?.cpa_code && (
                                                <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded">
                                                    <Hash className="h-3 w-3" />
                                                    {cpa.cpa_code}
                                                </span>
                                            )}
                                            {cpa?.email && (
                                                <span className="flex items-center gap-1">
                                                    <Mail className="h-3 w-3" />
                                                    {cpa.email}
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1">
                                                <Users className="h-3 w-3" />
                                                {assignedClientsCount} Assigned Clients
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Edit Profile Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Landmark className="h-5 w-5 text-primary" />
                                    Preparer Information
                                </CardTitle>
                                <CardDescription>
                                    Update your Preparer details
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="cpaName">Preparer Name</Label>
                                        <Input
                                            id="cpaName"
                                            placeholder="Enter Preparer name"
                                            value={profileData.cpaName}
                                            onChange={(e) =>
                                                setProfileData({ ...profileData, cpaName: e.target.value })
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="cpaCode">Preparer Code</Label>
                                        <Input
                                            id="cpaCode"
                                            placeholder="e.g., CPA001"
                                            value={profileData.cpaCode}
                                            onChange={(e) =>
                                                setProfileData({ ...profileData, cpaCode: e.target.value })
                                            }
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Unique identifier for your Preparer account
                                        </p>
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
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
                                        <p className="text-xs text-muted-foreground">
                                            This is also your login username
                                        </p>
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

                        {/* Stats Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Activity className="h-5 w-5 text-primary" />
                                    Account Statistics
                                </CardTitle>
                                <CardDescription>
                                    Overview of your Preparer activity
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-4 md:grid-cols-3">
                                    <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border">
                                        <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                                            <Users className="h-6 w-6 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold">{assignedClientsCount}</p>
                                            <p className="text-xs text-muted-foreground">Assigned Clients</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border">
                                        <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                                            <Check className="h-6 w-6 text-green-600" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold">Active</p>
                                            <p className="text-xs text-muted-foreground">Account Status</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border">
                                        <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                                            <Calendar className="h-6 w-6 text-purple-600" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold">
                                                {cpa?.created_at
                                                    ? new Date(cpa.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                                                    : "—"}
                                            </p>
                                            <p className="text-xs text-muted-foreground">Member Since</p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
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
                                            Get reminded about pending tasks for your clients
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
                                        <Label className="text-base">Client Updates</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Notifications when clients complete tasks or upload documents
                                        </p>
                                    </div>
                                    <Switch
                                        checked={notifications.clientUpdates}
                                        onCheckedChange={(checked) =>
                                            setNotifications({ ...notifications, clientUpdates: checked })
                                        }
                                    />
                                </div>

                                <div className="flex items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">Weekly Digest</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Receive a weekly summary of activity across all your clients
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
                                        <span className="text-sm text-muted-foreground">Account Type</span>
                                        <span className="font-medium">Preparer</span>
                                    </div>
                                    <div className="flex items-center justify-between py-2 border-b">
                                        <span className="text-sm text-muted-foreground">Preparer Code</span>
                                        <span className="font-medium">{cpa?.cpa_code || "—"}</span>
                                    </div>
                                    <div className="flex items-center justify-between py-2 border-b">
                                        <span className="text-sm text-muted-foreground">Account Status</span>
                                        <span className="font-medium text-green-600">Active</span>
                                    </div>
                                    <div className="flex items-center justify-between py-2 border-b">
                                        <span className="text-sm text-muted-foreground">Account Created</span>
                                        <span className="font-medium">
                                            {cpa?.created_at
                                                ? new Date(cpa.created_at).toLocaleDateString()
                                                : "—"}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between py-2">
                                        <span className="text-sm text-muted-foreground">Last Updated</span>
                                        <span className="font-medium">
                                            {cpa?.updated_at
                                                ? new Date(cpa.updated_at).toLocaleDateString()
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
