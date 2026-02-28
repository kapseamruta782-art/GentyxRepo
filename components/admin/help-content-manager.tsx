"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import useSWR, { mutate } from "swr"
import {
    Plus,
    Trash2,
    Edit2,
    Save,
    X,
    GripVertical,
    ChevronDown,
    ChevronUp,
    Loader2,
    Shield,
    User,
    FileCheck,
    Headphones,
    Eye,
    AlertCircle,
    CheckCircle,
    Activity,
    ArrowRight,
    ClipboardCheck,
    ClipboardList,
    Clock,
    FilePlus,
    FileSearch,
    HelpCircle,
    LayoutDashboard,
    ListTodo,
    LogIn,
    Mail,
    MessageCircle,
    MessageSquare,
    PartyPopper,
    TrendingUp,
    Upload,
    UserCheck,
    UserPlus,
    Users,
    Handshake
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import Link from "next/link"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

const ICON_OPTIONS = [
    "Shield", "User", "FileCheck", "Headphones", "LogIn", "UserPlus", "Users",
    "ListTodo", "ClipboardList", "Activity", "MessageSquare", "CheckCircle",
    "Mail", "LayoutDashboard", "ClipboardCheck", "Upload", "MessageCircle",
    "TrendingUp", "PartyPopper", "UserCheck", "FileSearch", "FilePlus",
    "Clock", "ArrowRight", "HelpCircle", "Handshake"
]

const STEP_TYPE_OPTIONS = [
    { value: "start", label: "Start (Green Circle)" },
    { value: "action", label: "Action (Default)" },
    { value: "decision", label: "Decision (Diamond)" },
    { value: "end", label: "End (Blue Circle)" },
]

const COLOR_OPTIONS = [
    { value: "text-blue-600 dark:text-blue-400", label: "Blue" },
    { value: "text-green-600 dark:text-green-400", label: "Green" },
    { value: "text-purple-600 dark:text-purple-400", label: "Purple" },
    { value: "text-orange-600 dark:text-orange-400", label: "Orange" },
    { value: "text-red-600 dark:text-red-400", label: "Red" },
    { value: "text-pink-600 dark:text-pink-400", label: "Pink" },
    { value: "text-teal-600 dark:text-teal-400", label: "Teal" },
]

const ROLE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    ADMIN: Shield,
    CLIENT: Handshake,
    CPA: FileCheck,
    SERVICE_CENTER: Headphones,
}

type HelpRole = {
    role_id: number
    role_key: string
    title: string
    description: string
    icon_name: string
    color_class: string
    display_order: number
    is_active: boolean
}

type Responsibility = {
    responsibility_id: number
    role_id: number
    description: string
    display_order: number
}

type FlowStep = {
    step_id: number
    role_id: number
    title: string
    description: string
    icon_name: string | null
    step_type: string
    display_order: number
}

type FAQ = {
    faq_id: number
    role_id: number
    question: string
    answer: string
    display_order: number
}

export function HelpContentManager() {
    const { data, error, isLoading } = useSWR("/api/help/admin", fetcher)
    const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null)
    const [editingRole, setEditingRole] = useState<HelpRole | null>(null)
    const [saving, setSaving] = useState(false)

    // Selected role data
    const roles: HelpRole[] = data?.roles || []
    const responsibilities: Responsibility[] = data?.responsibilities || []
    const flowSteps: FlowStep[] = data?.flowSteps || []
    const faqs: FAQ[] = data?.faqs || []

    const selectedRole = roles.find((r) => r.role_id === selectedRoleId)
    const roleResponsibilities = responsibilities.filter((r) => r.role_id === selectedRoleId)
    const roleFlowSteps = flowSteps.filter((f) => f.role_id === selectedRoleId)
    const roleFaqs = faqs.filter((f) => f.role_id === selectedRoleId)

    // Auto-select first role
    useEffect(() => {
        if (roles.length > 0 && !selectedRoleId) {
            setSelectedRoleId(roles[0].role_id)
        }
    }, [roles, selectedRoleId])

    async function handleSaveRole() {
        if (!editingRole) return
        setSaving(true)
        try {
            const res = await fetch("/api/help/admin", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editingRole),
            })
            if (res.ok) {
                toast.success("Role updated successfully")
                mutate("/api/help/admin")
                setEditingRole(null)
            } else {
                toast.error("Failed to update role")
            }
        } catch (err) {
            toast.error("Failed to update role")
        } finally {
            setSaving(false)
        }
    }

    // CRUD handlers for responsibilities
    async function addResponsibility(description: string) {
        try {
            const res = await fetch("/api/help/admin/responsibilities", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    role_id: selectedRoleId,
                    description,
                    display_order: roleResponsibilities.length + 1,
                }),
            })
            if (res.ok) {
                toast.success("Responsibility added")
                mutate("/api/help/admin")
            }
        } catch (err) {
            toast.error("Failed to add responsibility")
        }
    }

    async function updateResponsibility(resp: Responsibility) {
        try {
            await fetch("/api/help/admin/responsibilities", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(resp),
            })
            mutate("/api/help/admin")
        } catch (err) {
            toast.error("Failed to update")
        }
    }

    async function deleteResponsibility(id: number) {
        try {
            await fetch(`/api/help/admin/responsibilities?id=${id}`, { method: "DELETE" })
            toast.success("Responsibility deleted")
            mutate("/api/help/admin")
        } catch (err) {
            toast.error("Failed to delete")
        }
    }

    // CRUD handlers for flow steps
    async function addFlowStep(step: Partial<FlowStep>) {
        try {
            const res = await fetch("/api/help/admin/flow-steps", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    role_id: selectedRoleId,
                    ...step,
                    display_order: roleFlowSteps.length + 1,
                }),
            })
            if (res.ok) {
                toast.success("Flow step added")
                mutate("/api/help/admin")
            }
        } catch (err) {
            toast.error("Failed to add flow step")
        }
    }

    async function updateFlowStep(step: FlowStep) {
        try {
            await fetch("/api/help/admin/flow-steps", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(step),
            })
            mutate("/api/help/admin")
        } catch (err) {
            toast.error("Failed to update")
        }
    }

    async function deleteFlowStep(id: number) {
        try {
            await fetch(`/api/help/admin/flow-steps?id=${id}`, { method: "DELETE" })
            toast.success("Flow step deleted")
            mutate("/api/help/admin")
        } catch (err) {
            toast.error("Failed to delete")
        }
    }

    // CRUD handlers for FAQs
    async function addFaq(faq: Partial<FAQ>) {
        try {
            const res = await fetch("/api/help/admin/faqs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    role_id: selectedRoleId,
                    ...faq,
                    display_order: roleFaqs.length + 1,
                }),
            })
            if (res.ok) {
                toast.success("FAQ added")
                mutate("/api/help/admin")
            }
        } catch (err) {
            toast.error("Failed to add FAQ")
        }
    }

    async function updateFaq(faq: FAQ) {
        try {
            await fetch("/api/help/admin/faqs", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(faq),
            })
            mutate("/api/help/admin")
        } catch (err) {
            toast.error("Failed to update")
        }
    }

    async function deleteFaq(id: number) {
        try {
            await fetch(`/api/help/admin/faqs?id=${id}`, { method: "DELETE" })
            toast.success("FAQ deleted")
            mutate("/api/help/admin")
        } catch (err) {
            toast.error("Failed to delete")
        }
    }

    if (isLoading) {
        return (
            <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        )
    }

    if (error || !data?.success) {
        return (
            <div className="container mx-auto p-6">
                <Card className="border-destructive">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-destructive">
                            <AlertCircle className="w-5 h-5" />
                            Database Not Configured
                        </CardTitle>
                        <CardDescription>
                            The help content tables have not been created in the database yet.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            To enable admin-editable help content, please run the SQL script located at:
                        </p>
                        <code className="block bg-muted p-3 rounded-md text-sm">
                            scripts/create-help-table.sql
                        </code>
                        <p className="text-sm text-muted-foreground">
                            Until then, the Help page will display the default static content.
                        </p>
                        <Button asChild variant="outline">
                            <Link href="/help">
                                <Eye className="w-4 h-4 mr-2" />
                                Preview Help Page
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Manage Help Content</h1>
                    <p className="text-muted-foreground mt-1">
                        Edit the help page content for each role
                    </p>
                </div>
                <Button asChild variant="outline">
                    <Link href="/help">
                        <Eye className="w-4 h-4 mr-2" />
                        Preview Help Page
                    </Link>
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-4">
                {/* Role Selector */}
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle className="text-lg">Roles</CardTitle>
                    </CardHeader>
                    <CardContent className="p-2">
                        <div className="space-y-1">
                            {roles.map((role) => {
                                const Icon = ROLE_ICONS[role.role_key] || User
                                return (
                                    <Button
                                        key={role.role_id}
                                        variant={selectedRoleId === role.role_id ? "default" : "ghost"}
                                        className="w-full justify-start"
                                        onClick={() => setSelectedRoleId(role.role_id)}
                                    >
                                        <Icon className="w-4 h-4 mr-2" />
                                        {role.title}
                                        {!role.is_active && (
                                            <Badge variant="secondary" className="ml-auto text-xs">
                                                Inactive
                                            </Badge>
                                        )}
                                    </Button>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Content Editor */}
                <div className="md:col-span-3 space-y-6">
                    {selectedRole && (
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={selectedRole.role_id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-6"
                            >
                                {/* Role Details Card */}
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between">
                                        <div>
                                            <CardTitle>Role Details: {selectedRole.title}</CardTitle>
                                            <CardDescription>Basic information about this role</CardDescription>
                                        </div>
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setEditingRole({ ...selectedRole })}
                                                >
                                                    <Edit2 className="w-4 h-4 mr-2" />
                                                    Edit
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>Edit Role: {selectedRole.title}</DialogTitle>
                                                    <DialogDescription>
                                                        Update the role's basic information
                                                    </DialogDescription>
                                                </DialogHeader>
                                                {editingRole && (
                                                    <div className="space-y-4 py-4">
                                                        <div className="space-y-2">
                                                            <Label>Title</Label>
                                                            <Input
                                                                value={editingRole.title}
                                                                onChange={(e) =>
                                                                    setEditingRole({ ...editingRole, title: e.target.value })
                                                                }
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>Description</Label>
                                                            <Textarea
                                                                value={editingRole.description}
                                                                onChange={(e) =>
                                                                    setEditingRole({ ...editingRole, description: e.target.value })
                                                                }
                                                                rows={3}
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>Color</Label>
                                                            <Select
                                                                value={editingRole.color_class}
                                                                onValueChange={(v) =>
                                                                    setEditingRole({ ...editingRole, color_class: v })
                                                                }
                                                            >
                                                                <SelectTrigger>
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {COLOR_OPTIONS.map((c) => (
                                                                        <SelectItem key={c.value} value={c.value}>
                                                                            {c.label}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Switch
                                                                checked={editingRole.is_active}
                                                                onCheckedChange={(v) =>
                                                                    setEditingRole({ ...editingRole, is_active: v })
                                                                }
                                                            />
                                                            <Label>Active (visible on Help page)</Label>
                                                        </div>
                                                    </div>
                                                )}
                                                <DialogFooter>
                                                    <Button variant="ghost" onClick={() => setEditingRole(null)}>
                                                        Cancel
                                                    </Button>
                                                    <Button onClick={handleSaveRole} disabled={saving}>
                                                        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                                        Save Changes
                                                    </Button>
                                                </DialogFooter>
                                            </DialogContent>
                                        </Dialog>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-muted-foreground">{selectedRole.description}</p>
                                    </CardContent>
                                </Card>

                                {/* Tabs for Responsibilities, Flow Steps, FAQs */}
                                <Tabs defaultValue="responsibilities">
                                    <TabsList className="grid w-full grid-cols-3">
                                        <TabsTrigger value="responsibilities">
                                            Responsibilities ({roleResponsibilities.length})
                                        </TabsTrigger>
                                        <TabsTrigger value="flow">
                                            Flow Steps ({roleFlowSteps.length})
                                        </TabsTrigger>
                                        <TabsTrigger value="faqs">
                                            FAQs ({roleFaqs.length})
                                        </TabsTrigger>
                                    </TabsList>

                                    {/* Responsibilities Tab */}
                                    <TabsContent value="responsibilities" className="mt-4">
                                        <Card>
                                            <CardHeader className="flex flex-row items-center justify-between">
                                                <CardTitle className="text-lg">Key Responsibilities</CardTitle>
                                                <AddResponsibilityDialog onAdd={addResponsibility} />
                                            </CardHeader>
                                            <CardContent>
                                                {roleResponsibilities.length === 0 ? (
                                                    <p className="text-muted-foreground text-center py-8">
                                                        No responsibilities added yet
                                                    </p>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {roleResponsibilities
                                                            .sort((a, b) => a.display_order - b.display_order)
                                                            .map((resp) => (
                                                                <ResponsibilityItem
                                                                    key={resp.responsibility_id}
                                                                    data={resp}
                                                                    onUpdate={updateResponsibility}
                                                                    onDelete={() => deleteResponsibility(resp.responsibility_id)}
                                                                />
                                                            ))}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </TabsContent>

                                    {/* Flow Steps Tab */}
                                    <TabsContent value="flow" className="mt-4">
                                        <Card>
                                            <CardHeader className="flex flex-row items-center justify-between">
                                                <CardTitle className="text-lg">Process Flow Steps</CardTitle>
                                                <AddFlowStepDialog onAdd={addFlowStep} />
                                            </CardHeader>
                                            <CardContent>
                                                {roleFlowSteps.length === 0 ? (
                                                    <p className="text-muted-foreground text-center py-8">
                                                        No flow steps added yet
                                                    </p>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {roleFlowSteps
                                                            .sort((a, b) => a.display_order - b.display_order)
                                                            .map((step) => (
                                                                <FlowStepItem
                                                                    key={step.step_id}
                                                                    data={step}
                                                                    onUpdate={updateFlowStep}
                                                                    onDelete={() => deleteFlowStep(step.step_id)}
                                                                />
                                                            ))}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </TabsContent>

                                    {/* FAQs Tab */}
                                    <TabsContent value="faqs" className="mt-4">
                                        <Card>
                                            <CardHeader className="flex flex-row items-center justify-between">
                                                <CardTitle className="text-lg">Frequently Asked Questions</CardTitle>
                                                <AddFaqDialog onAdd={addFaq} />
                                            </CardHeader>
                                            <CardContent>
                                                {roleFaqs.length === 0 ? (
                                                    <p className="text-muted-foreground text-center py-8">
                                                        No FAQs added yet
                                                    </p>
                                                ) : (
                                                    <Accordion type="single" collapsible className="w-full space-y-2">
                                                        {roleFaqs
                                                            .sort((a, b) => a.display_order - b.display_order)
                                                            .map((faq) => (
                                                                <FaqItem
                                                                    key={faq.faq_id}
                                                                    data={faq}
                                                                    onUpdate={updateFaq}
                                                                    onDelete={() => deleteFaq(faq.faq_id)}
                                                                />
                                                            ))}
                                                    </Accordion>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </TabsContent>
                                </Tabs>
                            </motion.div>
                        </AnimatePresence>
                    )}
                </div>
            </div>
        </div>
    )
}

// Sub-components for CRUD operations

function AddResponsibilityDialog({ onAdd }: { onAdd: (desc: string) => void }) {
    const [open, setOpen] = useState(false)
    const [description, setDescription] = useState("")

    function handleAdd() {
        if (description.trim()) {
            onAdd(description.trim())
            setDescription("")
            setOpen(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Responsibility</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                    <Textarea
                        placeholder="Enter responsibility description..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                    />
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleAdd}>Add</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function ResponsibilityItem({
    data,
    onUpdate,
    onDelete,
}: {
    data: Responsibility
    onUpdate: (r: Responsibility) => void
    onDelete: () => void
}) {
    const [editing, setEditing] = useState(false)
    const [description, setDescription] = useState(data.description)

    function handleSave() {
        onUpdate({ ...data, description })
        setEditing(false)
    }

    return (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 group">
            <GripVertical className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab" />
            {editing ? (
                <>
                    <Input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="flex-1"
                    />
                    <Button size="icon" variant="ghost" onClick={handleSave}>
                        <Save className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditing(false)}>
                        <X className="w-4 h-4" />
                    </Button>
                </>
            ) : (
                <>
                    <span className="flex-1 text-sm">{data.description}</span>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="opacity-0 group-hover:opacity-100"
                        onClick={() => setEditing(true)}
                    >
                        <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="opacity-0 group-hover:opacity-100 text-destructive"
                        onClick={onDelete}
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </>
            )}
        </div>
    )
}

function AddFlowStepDialog({ onAdd }: { onAdd: (step: Partial<FlowStep>) => void }) {
    const [open, setOpen] = useState(false)
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [icon, setIcon] = useState("Circle")
    const [stepType, setStepType] = useState("action")

    function handleAdd() {
        if (title.trim() && description.trim()) {
            onAdd({ title, description, icon_name: icon, step_type: stepType })
            setTitle("")
            setDescription("")
            setIcon("Circle")
            setStepType("action")
            setOpen(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Step
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Flow Step</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Title</Label>
                        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Icon</Label>
                            <Select value={icon} onValueChange={setIcon}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {ICON_OPTIONS.map((i) => (
                                        <SelectItem key={i} value={i}>
                                            {i}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Step Type</Label>
                            <Select value={stepType} onValueChange={setStepType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {STEP_TYPE_OPTIONS.map((t) => (
                                        <SelectItem key={t.value} value={t.value}>
                                            {t.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleAdd}>Add Step</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function FlowStepItem({
    data,
    onUpdate,
    onDelete,
}: {
    data: FlowStep
    onUpdate: (s: FlowStep) => void
    onDelete: () => void
}) {
    const [editing, setEditing] = useState(false)
    const [title, setTitle] = useState(data.title)
    const [description, setDescription] = useState(data.description)
    const [icon, setIcon] = useState(data.icon_name || "Circle")
    const [stepType, setStepType] = useState(data.step_type)

    function handleSave() {
        onUpdate({ ...data, title, description, icon_name: icon, step_type: stepType })
        setEditing(false)
    }

    const typeLabel = STEP_TYPE_OPTIONS.find((t) => t.value === data.step_type)?.label || "Action"

    return (
        <div className="p-3 rounded-lg bg-muted/50 group">
            {editing ? (
                <div className="space-y-3">
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
                    <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Description"
                        rows={2}
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <Select value={icon} onValueChange={setIcon}>
                            <SelectTrigger>
                                <SelectValue placeholder="Icon" />
                            </SelectTrigger>
                            <SelectContent>
                                {ICON_OPTIONS.map((i) => (
                                    <SelectItem key={i} value={i}>
                                        {i}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={stepType} onValueChange={setStepType}>
                            <SelectTrigger>
                                <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                                {STEP_TYPE_OPTIONS.map((t) => (
                                    <SelectItem key={t.value} value={t.value}>
                                        {t.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={handleSave}>
                            Save
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                        {data.display_order}
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <span className="font-medium">{data.title}</span>
                            <Badge variant="outline" className="text-xs">
                                {typeLabel}
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{data.description}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" onClick={() => setEditing(true)}>
                            <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            onClick={onDelete}
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}

function AddFaqDialog({ onAdd }: { onAdd: (faq: Partial<FAQ>) => void }) {
    const [open, setOpen] = useState(false)
    const [question, setQuestion] = useState("")
    const [answer, setAnswer] = useState("")

    function handleAdd() {
        if (question.trim() && answer.trim()) {
            onAdd({ question, answer })
            setQuestion("")
            setAnswer("")
            setOpen(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add FAQ
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add FAQ</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Question</Label>
                        <Input value={question} onChange={(e) => setQuestion(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Answer</Label>
                        <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={4} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleAdd}>Add FAQ</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function FaqItem({
    data,
    onUpdate,
    onDelete,
}: {
    data: FAQ
    onUpdate: (f: FAQ) => void
    onDelete: () => void
}) {
    const [editing, setEditing] = useState(false)
    const [question, setQuestion] = useState(data.question)
    const [answer, setAnswer] = useState(data.answer)

    function handleSave() {
        onUpdate({ ...data, question, answer })
        setEditing(false)
    }

    return (
        <AccordionItem value={`faq-${data.faq_id}`}>
            <AccordionTrigger className="group">
                <div className="flex items-center gap-2 flex-1 text-left">
                    <Badge variant="outline" className="shrink-0">
                        Q{data.display_order}
                    </Badge>
                    <span className="flex-1">{data.question}</span>
                    <div
                        className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Button size="icon" variant="ghost" onClick={() => setEditing(true)}>
                            <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            onClick={onDelete}
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </AccordionTrigger>
            <AccordionContent>
                {editing ? (
                    <div className="space-y-3 pt-2">
                        <Input
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            placeholder="Question"
                        />
                        <Textarea
                            value={answer}
                            onChange={(e) => setAnswer(e.target.value)}
                            placeholder="Answer"
                            rows={3}
                        />
                        <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                                Cancel
                            </Button>
                            <Button size="sm" onClick={handleSave}>
                                Save
                            </Button>
                        </div>
                    </div>
                ) : (
                    <p className="text-muted-foreground">{data.answer}</p>
                )}
            </AccordionContent>
        </AccordionItem>
    )
}
