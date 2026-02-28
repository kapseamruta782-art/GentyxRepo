"use client"

import { useState, useEffect } from "react"
import useSWR, { mutate } from "swr"
import { fetchAuditLogs, fetchAdminProfile, updateAdminProfile } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { User, Bell, Shield, Activity, Save, Eye, EyeOff, Check, Loader2, UserPlus, Lock, Plus, X, BookOpen, Mail } from "lucide-react"
import { updateAdminPassword, createAdminUser } from "@/lib/api"
import { HelpContentManager } from "@/components/admin/help-content-manager"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export default function SettingsPage() {
  const { toast } = useToast()
  const { data: auditsResponse } = useSWR(["audits"], () => fetchAuditLogs())

  // Fix: Extract data array from response
  const audits = Array.isArray(auditsResponse?.data) ? auditsResponse.data : []

  // Profile state
  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "Administrator"
  })

  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchAdminProfile().then((data) => {
      if (data) {
        setProfileData({
          name: data.full_name || "",
          email: data.email || "",
          phone: data.phone || "",
          role: data.role || "Administrator"
        })
      }
    })
  }, [])

  // Notification settings state
  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    taskUpdates: true,
    clientUpdates: true,
    weeklyDigest: false,
    messageNotifications: true
  })

  // Secret visibility
  const [showSecret, setShowSecret] = useState(false)
  const [secretValue, setSecretValue] = useState("")

  // Password Update State
  const [currentPass, setCurrentPass] = useState("")
  const [newPass, setNewPass] = useState("")
  const [confirmPass, setConfirmPass] = useState("")
  const [isUpdatingPass, setIsUpdatingPass] = useState(false)

  // Create Admin State
  const [newAdminEmail, setNewAdminEmail] = useState("")
  const [newAdminPassword, setNewAdminPassword] = useState("")
  const [adminConfirmPass, setAdminConfirmPass] = useState("")
  const [masterPass, setMasterPass] = useState("") // Current admin password to confirm
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false)
  const [showCreateAdminDialog, setShowCreateAdminDialog] = useState(false)


  // Save handlers
  const handleSaveProfile = async () => {
    setIsSaving(true)
    try {
      await updateAdminProfile({
        full_name: profileData.name,
        email: profileData.email,
        phone: profileData.phone,
      })
      toast({
        title: "Profile Updated",
        description: "Your profile settings have been saved successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update profile.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveNotifications = () => {
    toast({
      title: "Notifications Updated",
      description: "Your notification preferences have been saved.",
    })
  }

  const handleSubmitSecret = () => {
    if (!secretValue.trim()) {
      toast({
        title: "Error",
        description: "Please enter a secret value.",
        variant: "destructive"
      })
      return
    }
    toast({
      title: "Secret Stored",
      description: "Your secret has been securely stored.",
      variant: "success"
    })
    setSecretValue("")
  }

  const handleUpdatePassword = async () => {
    if (!currentPass || !newPass || !confirmPass) {
      toast({ title: "Error", description: "All fields are required", variant: "destructive" })
      return
    }
    if (newPass !== confirmPass) {
      toast({ title: "Error", description: "New passwords do not match", variant: "destructive" })
      return
    }

    setIsUpdatingPass(true)
    try {
      await updateAdminPassword({ currentPassword: currentPass, newPassword: newPass })
      toast({ title: "Success", description: "Password updated successfully" })
      setCurrentPass("")
      setNewPass("")
      setConfirmPass("")
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update password", variant: "destructive" })
    } finally {
      setIsUpdatingPass(false)
    }
  }

  const handleCreateAdmin = async () => {
    if (!newAdminEmail || !newAdminPassword || !masterPass) {
      toast({ title: "Error", description: "All fields are required", variant: "destructive" })
      return
    }
    if (newAdminPassword !== adminConfirmPass) {
      toast({ title: "Error", description: "New admin passwords do not match", variant: "destructive" })
      return
    }

    setIsCreatingAdmin(true)
    try {
      await createAdminUser({
        currentPassword: masterPass,
        newEmail: newAdminEmail,
        newPassword: newAdminPassword
      })
      toast({ title: "Success", description: "New admin user created successfully" })
      setShowCreateAdminDialog(false)
      setNewAdminEmail("")
      setNewAdminPassword("")
      setAdminConfirmPass("")
      setMasterPass("")
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to create admin", variant: "destructive" })
    } finally {
      setIsCreatingAdmin(false)
    }
  }

  const formatPhoneNumber = (value: string) => {
    // Strip all non-digit characters
    const phoneNumber = value.replace(/\D/g, "");

    // Format as XXX-XXX-XXXX
    if (phoneNumber.length <= 3) return phoneNumber;
    if (phoneNumber.length <= 6) return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3)}`;
    return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage your account settings and preferences</p>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-[750px]">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Password</span>
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Audit Log</span>
          </TabsTrigger>
          <TabsTrigger value="help" className="gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Help Content</span>
          </TabsTrigger>
        </TabsList>

        {/* ============ PROFILE TAB ============ */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Profile Information
              </CardTitle>
              <CardDescription>Update your personal information and account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    placeholder="Enter your name"
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    placeholder="XXX-XXX-XXXX"
                    value={profileData.phone}
                    onChange={(e) => {
                      const formatted = formatPhoneNumber(e.target.value)
                      setProfileData({ ...profileData, phone: formatted })
                    }}
                    maxLength={12} // 3+3+4 digits + 2 hyphens
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Input
                    id="role"
                    value={profileData.role}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} className="gap-2" disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ NOTIFICATIONS TAB ============ */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  Admin Email Notifications
                </CardTitle>
                <CardDescription>
                  All administrators automatically receive system email notifications.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                <div className="flex items-start gap-3">
                  <Bell className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-green-800">All Notifications Active</div>
                    <div className="text-sm text-green-700 mt-1">
                      All administrators receive email notifications for the following events:
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>A client sends a message to the admin team</li>
                        <li>Documents are uploaded by clients, Preparers, or Service Centers</li>
                        <li>Tasks or onboarding steps are completed</li>
                        <li>New folders are created in client document areas</li>
                        <li>New clients are created (welcome emails sent automatically)</li>
                        <li>Client profiles are updated</li>
                      </ul>
                    </div>
                  </div>
                </div>
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
                  Password & Security
                </CardTitle>
                <CardDescription>Manage your password and security settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current Password</Label>
                    <Input
                      id="current-password"
                      type="password"
                      placeholder="Enter current password"
                      value={currentPass}
                      onChange={(e) => setCurrentPass(e.target.value)}
                    />
                  </div>
                  <div></div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="Enter new password"
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Confirm new password"
                      value={confirmPass}
                      onChange={(e) => setConfirmPass(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleUpdatePassword} disabled={isUpdatingPass}>
                    {isUpdatingPass && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Update Password
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-primary" />
                  Admin Management
                </CardTitle>
                <CardDescription>Create new system administrators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Create New Admin</p>
                    <p className="text-xs text-muted-foreground">Add another user with full administrative privileges.</p>
                  </div>
                  <Dialog open={showCreateAdminDialog} onOpenChange={setShowCreateAdminDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="gap-2">
                        <Plus className="h-4 w-4" /> Add Admin
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New Administrator</DialogTitle>
                        <DialogDescription>
                          Enter the details for the new admin. You must confirm with your current password.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>New Admin Email</Label>
                          <Input
                            value={newAdminEmail}
                            onChange={(e) => setNewAdminEmail(e.target.value)}
                            placeholder="admin2@example.com"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>New Password</Label>
                            <Input
                              type="password"
                              value={newAdminPassword}
                              onChange={(e) => setNewAdminPassword(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Confirm Password</Label>
                            <Input
                              type="password"
                              value={adminConfirmPass}
                              onChange={(e) => setAdminConfirmPass(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="border-t pt-4 mt-2">
                          <div className="space-y-2">
                            <Label className="text-amber-600">Confirm Your Identity</Label>
                            <Input
                              type="password"
                              placeholder="Enter YOUR current password"
                              value={masterPass}
                              onChange={(e) => setMasterPass(e.target.value)}
                            />
                            <p className="text-[10px] text-muted-foreground">Required to authorize creation of a new admin.</p>
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowCreateAdminDialog(false)}>Cancel</Button>
                        <Button onClick={handleCreateAdmin} disabled={isCreatingAdmin}>
                          {isCreatingAdmin && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Create Admin
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card> */}
          </div>
        </TabsContent>

        {/* ============ AUDIT LOG TAB ============ */}
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Activity Audit Log
              </CardTitle>
              <CardDescription>View recent activity and system changes</CardDescription>
            </CardHeader>
            <CardContent>
              {audits.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="bg-muted/50 rounded-full p-3 mb-3">
                    <Activity className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">No audit logs available yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {audits.slice(0, 20).map((a: any, index: number) => (
                    <div
                      key={a.id || index}
                      className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full ${a.action?.includes('CREATE') ? 'bg-green-500' :
                          a.action?.includes('UPDATE') ? 'bg-blue-500' :
                            a.action?.includes('DELETE') ? 'bg-red-500' :
                              'bg-gray-500'
                          }`} />
                        <div>
                          <p className="font-medium text-sm">{a.action}</p>
                          <p className="text-xs text-muted-foreground">
                            By {a.actorRole || a.actor_role || 'System'}
                          </p>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground text-right">
                        {a.at || a.created_at ? new Date(a.at || a.created_at).toLocaleString() : '-'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ HELP CONTENT TAB ============ */}
        <TabsContent value="help">
          <HelpContentManager />
        </TabsContent>
      </Tabs>
    </div >
  )
}
