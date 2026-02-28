// app/admin/email-activity/page.tsx
"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Mail,
    Send,
    CheckCircle,
    XCircle,
    Clock,
    AlertCircle,
    RefreshCw,
    Search,
    Filter,
    Eye,
    RotateCw,
    Users,
    Building2,
    Landmark,
} from "lucide-react";

// Types
interface EmailLogRecord {
    id: number;
    recipientEmail: string;
    recipientName: string | null;
    recipientRole: string | null;
    relatedEntityType: string | null;
    relatedEntityId: number | null;
    relatedEntityName: string | null;
    emailType: string;
    emailSubject: string;
    emailBodyPreview: string | null;
    status: string;
    statusMessage: string | null;
    acsMessageId: string | null;
    originalEmailId: number | null;
    resendCount: number;
    lastResentAt: string | null;
    resentBy: string | null;
    createdAt: string;
    sentAt: string | null;
    deliveredAt: string | null;
    metadata: Record<string, any> | null;
}

interface EmailLogsResponse {
    success: boolean;
    data: EmailLogRecord[];
    total: number;
    page: number;
    pageSize: number;
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
    const config: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
        Pending: { icon: Clock, color: "text-amber-600", bg: "bg-amber-100" },
        Sent: { icon: Send, color: "text-blue-600", bg: "bg-blue-100" },
        Delivered: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-100" },
        Failed: { icon: XCircle, color: "text-red-600", bg: "bg-red-100" },
        Unknown: { icon: AlertCircle, color: "text-gray-600", bg: "bg-gray-100" },
    };

    const { icon: Icon, color, bg } = config[status] || config.Unknown;

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${bg} ${color}`}>
            <Icon className="h-3 w-3" />
            {status}
        </span>
    );
}

// Role badge component
function RoleBadge({ role }: { role: string | null }) {
    if (!role) return <span className="text-gray-400 text-xs">-</span>;

    const config: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
        CLIENT: { icon: Users, color: "text-indigo-600", bg: "bg-indigo-100", label: "Client" },
        CPA: { icon: Landmark, color: "text-emerald-600", bg: "bg-emerald-100", label: "Preparer" },
        SERVICE_CENTER: { icon: Building2, color: "text-amber-600", bg: "bg-amber-100", label: "Service Center" },
    };

    const { icon: Icon, color, bg, label } = config[role] || { icon: Users, color: "text-gray-600", bg: "bg-gray-100", label: role };

    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${color}`}>
            <Icon className="h-3 w-3" />
            {label}
        </span>
    );
}

// Email type display
function EmailTypeDisplay({ type }: { type: string }) {
    const typeLabels: Record<string, string> = {
        welcome_client: "Welcome (Client)",
        welcome_cpa: "Welcome (Preparer)",
        welcome_service_center: "Welcome (Service Center)",
        task_notification: "Task Notification",
        task_assigned: "Task Assigned",
        task_updated: "Task Updated",
        message_notification: "Message Notification",
        document_notification: "Document Notification",
        stage_notification: "Stage Notification",
        custom_email: "Custom Email",
        onboarding_task: "Onboarding Task",
        general: "General",
    };

    return (
        <span className="text-sm text-gray-700">
            {typeLabels[type] || type}
        </span>
    );
}

export default function EmailActivityPage() {
    // Filters state
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [emailTypeFilter, setEmailTypeFilter] = useState("all");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    // Modal states
    const [previewOpen, setPreviewOpen] = useState(false);
    const [selectedEmail, setSelectedEmail] = useState<EmailLogRecord | null>(null);
    const [resendingId, setResendingId] = useState<number | null>(null);
    const [resendResult, setResendResult] = useState<{ success: boolean; message: string } | null>(null);

    // Build query params
    const queryParams = useMemo(() => {
        const params = new URLSearchParams();
        params.set("page", page.toString());
        params.set("pageSize", pageSize.toString());
        if (search) params.set("search", search);
        if (roleFilter !== "all") params.set("recipientRole", roleFilter);
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (emailTypeFilter !== "all") params.set("emailType", emailTypeFilter);
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);
        return params.toString();
    }, [page, pageSize, search, roleFilter, statusFilter, emailTypeFilter, dateFrom, dateTo]);

    // Fetch email logs
    const { data, error, isLoading, mutate } = useSWR<EmailLogsResponse>(
        `/api/email-logs?${queryParams}`,
        (url: string) => fetch(url).then((res) => res.json())
    );

    const emailLogs = data?.data || [];
    const total = data?.total || 0;
    const totalPages = Math.ceil(total / pageSize);

    // Handle resend
    const handleResend = async (emailLog: EmailLogRecord) => {
        setResendingId(emailLog.id);
        setResendResult(null);

        try {
            const response = await fetch("/api/email-logs/resend", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    emailLogId: emailLog.id,
                    adminEmail: "admin@legacy.com", // Could come from auth context
                }),
            });

            const result = await response.json();

            if (result.success) {
                setResendResult({ success: true, message: `Email resent successfully to ${emailLog.recipientEmail}` });
                mutate(); // Refresh the list
            } else {
                setResendResult({ success: false, message: result.error || "Failed to resend email" });
            }
        } catch (err: any) {
            setResendResult({ success: false, message: err.message || "An error occurred" });
        } finally {
            setResendingId(null);
        }
    };

    // Format date for display
    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "-";
        const date = new Date(dateStr);
        return date.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    };

    // Stats calculation
    const stats = useMemo(() => {
        const sent = emailLogs.filter((e) => e.status === "Sent" || e.status === "Delivered").length;
        const failed = emailLogs.filter((e) => e.status === "Failed").length;
        const pending = emailLogs.filter((e) => e.status === "Pending").length;
        return { sent, failed, pending, total: emailLogs.length };
    }, [emailLogs]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Email Activity Log</h1>
                    <p className="text-muted-foreground mt-1">
                        Track and manage all system-generated emails
                    </p>
                </div>
                <Button variant="outline" onClick={() => mutate()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Emails</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{total}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            Sent/Delivered
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{stats.sent}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            Failed
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Clock className="h-4 w-4 text-amber-500" />
                            Pending
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        Filters
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search email, name..."
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setPage(1);
                                }}
                                className="pl-9"
                            />
                        </div>

                        {/* Role Filter */}
                        <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
                            <SelectTrigger>
                                <SelectValue placeholder="Filter by Role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Roles</SelectItem>
                                <SelectItem value="CLIENT">Client</SelectItem>
                                <SelectItem value="CPA">Preparer</SelectItem>
                                <SelectItem value="SERVICE_CENTER">Service Center</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Status Filter */}
                        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                            <SelectTrigger>
                                <SelectValue placeholder="Filter by Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="Sent">Sent</SelectItem>
                                <SelectItem value="Delivered">Delivered</SelectItem>
                                <SelectItem value="Failed">Failed</SelectItem>
                                <SelectItem value="Pending">Pending</SelectItem>
                                <SelectItem value="Unknown">Unknown</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Email Type Filter */}
                        <Select value={emailTypeFilter} onValueChange={(v) => { setEmailTypeFilter(v); setPage(1); }}>
                            <SelectTrigger>
                                <SelectValue placeholder="Filter by Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                <SelectItem value="welcome_client">Welcome (Client)</SelectItem>
                                <SelectItem value="welcome_cpa">Welcome (Preparer)</SelectItem>
                                <SelectItem value="welcome_service_center">Welcome (Service Center)</SelectItem>
                                <SelectItem value="task_notification">Task Notification</SelectItem>
                                <SelectItem value="message_notification">Message Notification</SelectItem>
                                <SelectItem value="document_notification">Document Notification</SelectItem>
                                <SelectItem value="general">General</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Date From */}
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">From Date</label>
                            <Input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                            />
                        </div>

                        {/* Date To */}
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">To Date</label>
                            <Input
                                type="date"
                                value={dateTo}
                                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                            />
                        </div>

                        {/* Clear Filters */}
                        <div className="flex items-end">
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setSearch("");
                                    setRoleFilter("all");
                                    setStatusFilter("all");
                                    setEmailTypeFilter("all");
                                    setDateFrom("");
                                    setDateTo("");
                                    setPage(1);
                                }}
                            >
                                Clear Filters
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Email Logs Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        Email Logs
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                            <span className="ml-2 text-muted-foreground">Loading...</span>
                        </div>
                    ) : error ? (
                        <div className="text-center py-12 text-red-500">
                            Failed to load email logs. Please try again.
                        </div>
                    ) : emailLogs.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No email logs found</p>
                            <p className="text-sm mt-1">Try adjusting your filters or check back later</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b bg-muted/50">
                                        <th className="text-left p-3 text-sm font-medium">Recipient</th>
                                        <th className="text-left p-3 text-sm font-medium">Role</th>
                                        <th className="text-left p-3 text-sm font-medium">Type</th>
                                        <th className="text-left p-3 text-sm font-medium">Subject</th>
                                        <th className="text-left p-3 text-sm font-medium">Status</th>
                                        <th className="text-left p-3 text-sm font-medium">Date</th>
                                        <th className="text-left p-3 text-sm font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {emailLogs.map((log) => (
                                        <tr key={log.id} className="border-b hover:bg-muted/30 transition-colors">
                                            <td className="p-3">
                                                <div>
                                                    <div className="font-medium text-sm">{log.recipientName || "-"}</div>
                                                    <div className="text-xs text-muted-foreground">{log.recipientEmail}</div>
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <RoleBadge role={log.recipientRole} />
                                            </td>
                                            <td className="p-3">
                                                <EmailTypeDisplay type={log.emailType} />
                                            </td>
                                            <td className="p-3">
                                                <div className="max-w-[250px] truncate text-sm" title={log.emailSubject}>
                                                    {log.emailSubject}
                                                </div>
                                                {log.resendCount > 0 && (
                                                    <div className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                                                        <RotateCw className="h-3 w-3" />
                                                        Resent {log.resendCount}x
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                <StatusBadge status={log.status} />
                                                {log.statusMessage && log.status === "Failed" && (
                                                    <div className="text-xs text-red-500 mt-1 max-w-[150px] truncate" title={log.statusMessage}>
                                                        {log.statusMessage}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                <div className="text-sm">{formatDate(log.createdAt)}</div>
                                            </td>
                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        title="View Email Details"
                                                        onClick={() => {
                                                            setSelectedEmail(log);
                                                            setPreviewOpen(true);
                                                            setResendResult(null);
                                                        }}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        title="Resend Email"
                                                        onClick={() => handleResend(log)}
                                                        disabled={resendingId !== null}
                                                    >
                                                        <RotateCw className={`h-4 w-4 ${resendingId === log.id ? "animate-spin" : ""}`} />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {total > 0 && (
                        <div className="flex items-center justify-between mt-4 pt-4 border-t">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>Items per page:</span>
                                <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                                    <SelectTrigger className="w-[70px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="10">10</SelectItem>
                                        <SelectItem value="20">20</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                        <SelectItem value="100">100</SelectItem>
                                    </SelectContent>
                                </Select>
                                <span>
                                    Showing {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, total)} of {total}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page <= 1}
                                    onClick={() => setPage(page - 1)}
                                >
                                    Previous
                                </Button>
                                <span className="text-sm text-muted-foreground">
                                    Page {page} of {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page >= totalPages}
                                    onClick={() => setPage(page + 1)}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Email Details Modal */}
            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <Mail className="h-6 w-6" />
                            Email Details
                        </DialogTitle>
                        <DialogDescription>
                            View email details and resend if needed
                        </DialogDescription>
                    </DialogHeader>

                    {selectedEmail && (
                        <div className="space-y-4">
                            {/* Email Meta Info */}
                            <div className="grid grid-cols-2 gap-4 p-5 bg-muted/50 rounded-lg">
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Recipient</div>
                                    <div className="font-semibold text-lg">{selectedEmail.recipientName || "-"}</div>
                                    <div className="text-sm text-muted-foreground">{selectedEmail.recipientEmail}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Role</div>
                                    <RoleBadge role={selectedEmail.recipientRole} />
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Status</div>
                                    <StatusBadge status={selectedEmail.status} />
                                    {selectedEmail.statusMessage && (
                                        <div className="text-xs text-muted-foreground mt-1">{selectedEmail.statusMessage}</div>
                                    )}
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Sent At</div>
                                    <div className="text-sm font-medium">{formatDate(selectedEmail.sentAt || selectedEmail.createdAt)}</div>
                                </div>
                                <div className="col-span-2">
                                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Email Type</div>
                                    <EmailTypeDisplay type={selectedEmail.emailType} />
                                </div>
                                <div className="col-span-2">
                                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Subject</div>
                                    <div className="font-semibold">{selectedEmail.emailSubject}</div>
                                </div>
                                {selectedEmail.acsMessageId && (
                                    <div className="col-span-2">
                                        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Azure Message ID</div>
                                        <div className="text-xs font-mono text-muted-foreground bg-gray-100 px-2 py-1 rounded inline-block">{selectedEmail.acsMessageId}</div>
                                    </div>
                                )}
                                {selectedEmail.resendCount > 0 && (
                                    <div className="col-span-2">
                                        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Resend History</div>
                                        <div className="text-sm flex items-center gap-2">
                                            <RotateCw className="h-4 w-4 text-amber-600" />
                                            <span>Resent {selectedEmail.resendCount} time(s)</span>
                                            {selectedEmail.lastResentAt && <span className="text-muted-foreground">- Last: {formatDate(selectedEmail.lastResentAt)}</span>}
                                            {selectedEmail.resentBy && <span className="text-muted-foreground">by {selectedEmail.resentBy}</span>}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Resend Result */}
                            {resendResult && (
                                <div className={`p-4 rounded-lg text-sm font-medium ${resendResult.success ? "bg-green-100 text-green-800 border border-green-300" : "bg-red-100 text-red-800 border border-red-300"}`}>
                                    {resendResult.success ? "✅ " : "❌ "}{resendResult.message}
                                </div>
                            )}

                            {/* Warning about spam */}
                            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <div className="font-semibold text-amber-800">Tip for Recipients</div>
                                        <div className="text-sm text-amber-700 mt-1">
                                            If the recipient reports not receiving the email, ask them to check their <strong>Spam</strong> or <strong>Junk</strong> folder.
                                            Emails from new senders are sometimes filtered automatically. They should also add the sender to their contacts.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4">
                        <Button variant="outline" size="lg" onClick={() => setPreviewOpen(false)}>
                            Close
                        </Button>
                        {selectedEmail && (
                            <Button
                                size="lg"
                                onClick={() => handleResend(selectedEmail)}
                                disabled={resendingId !== null}
                            >
                                {resendingId === selectedEmail.id ? (
                                    <>
                                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                        Resending...
                                    </>
                                ) : (
                                    <>
                                        <RotateCw className="h-4 w-4 mr-2" />
                                        Resend Email
                                    </>
                                )}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
