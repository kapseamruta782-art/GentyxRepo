// app/admin/clients/[id]/page.tsx
"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import useSWR from "swr";
import { ChevronDown } from "lucide-react"
import { mutate } from "swr"
import {
  fetchClient,
  fetchTasks,
  fetchDocuments,
  fetchMessages,
  fetchAuditLogs,
  fetchClientTasksSimple,
  fetchClientDocuments,
  fetchServiceCenters,   // ✅ ADD
  fetchCPAs              // ✅ ADD
} from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { StatusPill } from "@/components/widgets/status-pill";
import { ProgressRing } from "@/components/widgets/progress-ring";
import { FlexibleChat } from "@/components/widgets/flexible-chat";
import { DataTable, type Column } from "@/components/data-table";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import { useUIStore } from "@/store/ui-store";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2, Archive, ArchiveRestore } from "lucide-react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Pencil, Eye, EyeOff, Folder, FileText, FileImage, FileSpreadsheet, File as FileIcon, Reply, Paperclip, X, Smile, CheckCircle2, Layers, Building2, Landmark, AlertTriangle, Users, Plus, Mail, Phone, Lock, Shield, Upload, FolderOpen } from "lucide-react";
import { formatPhone } from "@/lib/formatters";
import { DocumentTreeExplorer } from "@/components/widgets/document-tree-explorer";


// ------------------ TYPES ------------------
type ClientTask = {
  task_id: number;
  task_title: string;
  assigned_to_role: string;
  status: string;
  due_date: string | null;
};

type ClientDocument = {
  id: number;
  name: string;
  type: string;
  status: string;
  notes: string | null;
};

type ClientMessage = {
  id: string | number;
  senderRole: string;
  body: string;
  createdAt: string;
  parentMessageId?: number | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
};

type AuditLog = {
  id: number;
  action: string;
  actorRole: string;
  at: string | Date;
};

type StageItem = {
  client_stage_id: number;
  stage_name: string;
  order_number: number;
  status: string;
};

/* ═══════════════════════════════════════════════════ */
/*  DOCUMENT CATEGORY SECTION (SharePoint-Style)      */
/* ═══════════════════════════════════════════════════ */
function DocumentCategorySection({
  category,
  clientId,
  selectedFolder,
  onDeleteDoc,
  toast,
}: {
  category: any;
  clientId: string;
  selectedFolder: string | null;
  onDeleteDoc: (doc: any) => void;
  toast: any;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const getFileIcon = (fileName: string) => {
    const lower = fileName.toLowerCase();
    if (lower.endsWith(".pdf")) return FileText;
    if (lower.match(/\.(jpg|jpeg|png|gif|svg|webp)$/)) return FileImage;
    if (lower.match(/\.(xls|xlsx|csv)$/)) return FileSpreadsheet;
    if (lower.match(/\.(doc|docx)$/)) return FileText;
    return FileIcon;
  };

  const formatSize = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`;
  };

  const handleView = async (doc: any) => {
    try {
      const lower = (doc.name || "").toLowerCase();
      const isOffice = /\.(doc|docx|ppt|pptx|xls|xlsx)$/i.test(lower);
      const fullPath = doc.path || doc.fullPath || (selectedFolder ? `${selectedFolder}/${doc.name}` : doc.name);

      const res = await fetch(
        `/api/documents/public-url?clientId=${encodeURIComponent(clientId)}&fullPath=${encodeURIComponent(fullPath)}`,
        { cache: "no-store" }
      );
      const json = await res.json();

      if (!res.ok || !json?.success || !json?.url) {
        toast({ title: "Preview failed", description: json?.error || "Could not generate preview link", variant: "destructive" });
        return;
      }

      if (isOffice) {
        window.open(`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(json.url)}`, "_blank", "noopener,noreferrer");
        return;
      }
      window.open(json.url, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      toast({ title: "Preview failed", description: err?.message || "Something went wrong", variant: "destructive" });
    }
  };

  return (
    <div className={`rounded-xl border ${category.border} overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200`}>
      {/* Category Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-200 bg-gradient-to-r ${category.headerGradient} hover:brightness-[0.98] group relative`}
      >
        {/* Left accent stripe */}
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${category.stripe} rounded-l-xl`} />

        {/* Expand/Collapse */}
        <ChevronDown className={`size-4 ${category.text} transition-transform duration-200 ${isExpanded ? "" : "-rotate-90"}`} />

        {/* Category Icon */}
        <div className={`p-1.5 rounded-lg ${category.iconBg}`}>
          {category.key === "admin-only" ? (
            <Shield className={`size-4 ${category.iconColor}`} />
          ) : category.key === "client-only" ? (
            <Users className={`size-4 ${category.iconColor}`} />
          ) : (
            <Layers className={`size-4 ${category.iconColor}`} />
          )}
        </div>

        {/* Label */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={`text-sm font-semibold ${category.text}`}>{category.label}</h3>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${category.badge}`}>
              {category.docs.length} {category.docs.length === 1 ? "file" : "files"}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 mt-0.5">{category.description}</p>
        </div>

        {/* Upload button (appears on hover) */}
        <div
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            useUIStore.getState().openDrawer("uploadDoc", {
              clientId,
              folderName: selectedFolder,
              visibility: category.uploadVisibility,
            });
          }}
        >
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium ${category.text} bg-white/80 hover:bg-white shadow-sm cursor-pointer`}>
            <Upload className="size-3" />
            Upload
          </span>
        </div>
      </button>

      {/* Category Content */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? "max-h-[3000px] opacity-100" : "max-h-0 opacity-0"}`}>
        {category.docs.length === 0 ? (
          <div className="flex items-center gap-3 px-6 py-5 text-gray-400 bg-white">
            <div className={`p-2 rounded-lg ${category.iconBg} opacity-50`}>
              <FileIcon className={`size-4 ${category.iconColor} opacity-50`} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-400">No documents</p>
              <p className="text-xs text-gray-350">{category.emptyText}</p>
            </div>
          </div>
        ) : (
          <div className="bg-white divide-y divide-gray-50">
            {category.docs.map((doc: any, idx: number) => {
              const Icon = getFileIcon(doc.name);
              const ext = doc.name.split(".").pop()?.toUpperCase() || "FILE";
              return (
                <div
                  key={doc.path || doc.fullPath || doc.name || idx}
                  className="group flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/80 transition-all duration-150"
                >
                  {/* Tree connector */}
                  <div className="pl-4">
                    <div className="w-3 h-px bg-gray-200" />
                  </div>

                  {/* File icon */}
                  <div className={`flex-shrink-0 p-1.5 rounded-md ${category.iconBg}`}>
                    <Icon className={`size-4 ${category.iconColor}`} />
                  </div>

                  {/* File name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate" title={doc.name}>
                      {doc.name}
                    </p>
                  </div>

                  {/* Type badge */}
                  <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600 uppercase tracking-wider">
                    {ext}
                  </span>

                  {/* Size */}
                  <span className="hidden md:inline text-xs font-mono text-gray-400 w-20 text-right">
                    {formatSize(doc.size || 0)}
                  </span>

                  {/* Visibility badge */}
                  <span className={`hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${category.visBg}`}>
                    {category.visIcon} {category.visLabel}
                  </span>

                  {/* Actions (show on hover) */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2.5 text-xs hover:bg-blue-50 hover:text-blue-600"
                      onClick={() => handleView(doc)}
                    >
                      View
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 hover:bg-red-50 hover:text-red-600"
                      onClick={() => onDeleteDoc(doc)}
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const openDrawer = useUIStore((s) => s.openDrawer);
  const { toast } = useToast();
  const router = useRouter();
  // ✅ Service Center & CPA Assignment State
  const [serviceCenters, setServiceCenters] = useState<any[]>([]);
  const [cpas, setCpas] = useState<any[]>([]);

  const [selectedServiceCenter, setSelectedServiceCenter] = useState<number | null>(null);
  const [selectedCPA, setSelectedCPA] = useState<number | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  // Delete/Archive Client State
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  // Associated Users State
  const [associatedUsers, setAssociatedUsers] = useState<any[]>([]);
  const [userSuggestions, setUserSuggestions] = useState<any[]>([]);
  const [isEditingUsers, setIsEditingUsers] = useState(false);
  const [isSavingUsers, setIsSavingUsers] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "Client User", phone: "" });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<any[]>([]);

  // ✅ Revalidate docs list (fixes "need refresh after upload/delete")
  const revalidateDocs = (clientId?: string | null, folder?: string | null) => {
    const cid = clientId ?? id;
    const f = folder ?? selectedFolder;

    if (!cid) return;

    // Revalidate both keys: root + current folder
    mutate(["docs", cid, null]);
    mutate(["docs", cid, f ?? null]);
  };

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      revalidateDocs(detail.clientId, detail.folderName ?? null);
    };

    window.addEventListener("clienthub:docs-updated", handler as EventListener);

    return () => {
      window.removeEventListener("clienthub:docs-updated", handler as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, selectedFolder]);

  useEffect(() => {
    fetchServiceCenters().then((res) => {
      if (res?.success) setServiceCenters(res.data || []);
    });

    fetchCPAs().then((res) => {
      if (res?.success) setCpas(res.data || []);
    });

    // Fetch user suggestions for autocomplete
    fetch("/api/users/suggestions")
      .then(res => res.json())
      .then(data => {
        if (data.success) setUserSuggestions(data.data || []);
      })
      .catch(err => console.error("Failed to fetch user suggestions:", err));
  }, []);


  // ----------------- FETCHING ------------------
  const { data: client } = useSWR(["client", id], () => fetchClient(id));

  // Populate associated users when client data loads
  useEffect(() => {
    if (client?.associated_users) {
      setAssociatedUsers(client.associated_users);
    }
  }, [client]);


  const { data: clientTasksResponse } = useSWR(
    ["clientTasksSimple", id],
    () => fetchClientTasksSimple(id)
  );


  const taskRows: ClientTask[] = clientTasksResponse?.data || [];

  // ----------------- TASK PAGINATION ------------------
  const [taskPage, setTaskPage] = useState(1);
  const [taskPageSize, setTaskPageSize] = useState(5);

  const totalTasks = taskRows.length;
  const totalTaskPages = Math.ceil(totalTasks / taskPageSize);

  const paginatedTasks = taskRows.slice(
    (taskPage - 1) * taskPageSize,
    taskPage * taskPageSize
  );


  // const { data: docsResponse } = useSWR(
  //   ["docs", id, selectedFolder],
  //   () =>
  //     selectedFolder
  //       ? fetch(`/api/documents/get?clientId=${id}&folder=${selectedFolder}`).then(r => r.json())
  //       : fetch(`/api/documents/get?clientId=${id}&mode=folders`).then(r => r.json())
  // );

  const { data: docsResponse } = useSWR(
    ["docs", id, selectedFolder],
    () => {
      const folderPath = selectedFolder ? selectedFolder : "";
      const qs = new URLSearchParams({
        clientId: String(id),
        folderPath: folderPath,
      });

      return fetch(`/api/documents/list?${qs.toString()}`, { cache: "no-store" }).then((r) =>
        r.json()
      );
    }
  );

  const docs = docsResponse?.items || [];

  const { data: msgsResponse } = useSWR(["msgs", id], () =>
    fetchMessages({ clientId: id })
  );

  const { data: auditsResponse } = useSWR(["audits", id], () =>
    fetchAuditLogs({ clientId: id })
  );
  //const audits: AuditLog[] = auditsResponse || [];
  const audits: AuditLog[] = Array.isArray(auditsResponse?.data)
    ? auditsResponse.data
    : [];


  const { data: stageData } = useSWR(
    ["clientStages", id],
    () => fetch(`/api/stages/client/get?clientId=${id}`).then((r) => r.json())
  );

  const stages = stageData?.data || [];
  const hasStages = Boolean(client?.stage_id);

  //const hasStages = stages.length > 0;  //new check for stages and new added line
  const subtasksFlat = stageData?.subtasks || [];

  const subtasksByStage = stages.map((stage: any) => ({
    ...stage,
    subtasks: subtasksFlat.filter(
      (s: any) => s.client_stage_id === stage.client_stage_id
    ),
  }));

  // ----------------- MESSAGES HANDLING ------------------
  const [messageText, setMessageText] = useState("");
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [openStage, setOpenStage] = useState<number | null>(null);
  const [replyingTo, setReplyingTo] = useState<ClientMessage | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Attachment states
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "File too large", description: "Maximum file size is 10MB", variant: "destructive" });
        return;
      }
      setAttachmentFile(file);
    }
  };

  // Common emojis for quick selection
  const commonEmojis = [
    "😊", "😂", "❤️", "👍", "🎉", "🔥", "✨", "💯",
    "😍", "🤔", "👏", "🙌", "💪", "🚀", "✅", "⭐",
    "😎", "🥳", "😇", "🤝", "📧", "📞", "💼", "📄"
  ];

  const toggleStage = (id: number) => {
    setOpenStage((prev) => (prev === id ? null : id));
  };

  const updateTaskStatus = async (taskId: number, newStatus: string) => {
    try {
      await fetch("/api/tasks/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId, status: newStatus }),
      });

      toast({ title: "Task updated" });
      mutate(["tasks", id]); // refresh tasks
      // mutateStages(); // refresh stages
    } catch (err) {
      toast({ title: "Failed to update task", variant: "destructive" });
    }
  };

  // useEffect(() => {
  //   if (msgsResponse?.data) setMessages(msgsResponse.data);
  //   else setMessages([]);
  // }, [msgsResponse]);
  useEffect(() => {
    if (Array.isArray(msgsResponse?.data)) {
      setMessages(
        msgsResponse.data.map((m: any) => ({
          id: m.message_id,
          senderRole: m.sender_role,
          body: m.body,
          parentMessageId: m.parent_message_id,
          attachmentUrl: m.attachment_url,
          attachmentName: m.attachment_name,
          createdAt: m.created_at, // ✅ correct mapping
        }))
      );
    } else {
      setMessages([]);
    }
  }, [msgsResponse]);


  const handleSendMessage = async () => {
    if (!messageText.trim() && !attachmentFile) return;

    setIsUploading(true);

    try {
      let attachmentUrl = null;
      let attachmentName = null;

      // Upload attachment if exists
      if (attachmentFile) {
        const formData = new FormData();
        formData.append("clientId", id);
        formData.append("file", attachmentFile);

        const uploadRes = await fetch("/api/messages/upload-attachment", {
          method: "POST",
          body: formData,
        });

        const uploadJson = await uploadRes.json();

        if (!uploadJson.success) {
          toast({ title: "Failed to upload attachment", variant: "destructive" });
          setIsUploading(false);
          return;
        }

        attachmentUrl = uploadJson.attachmentUrl;
        attachmentName = uploadJson.attachmentName;
      }

      await fetch("/api/messages/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: id,
          sender_role: "ADMIN",
          receiver_role: "CLIENT",
          body: messageText || (attachmentFile ? `Sent an attachment: ${attachmentFile.name}` : ""),
          parent_message_id: replyingTo?.id,
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
        }),
      });

      setMessageText("");
      setAttachmentFile(null);
      setReplyingTo(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast({ title: "Message sent" });

      mutate(["msgs", id]);
    } catch (error) {
      toast({ title: "Failed to send message", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };
  const STATUS_OPTIONS = ["Not Started", "In Progress", "Completed"] as const;

  const STATUS_COLORS: Record<string, string> = {
    "Not Started": "bg-amber-100 text-amber-700",
    "In Progress": "bg-blue-100 text-blue-700",
    "Completed": "bg-green-100 text-green-700",
  };

  // ----------------- TABLE COLUMNS ------------------
  const taskCols: Column<ClientTask>[] = [
    { key: "task_title", header: "Title" },

    { key: "assigned_to_role", header: "Assigned User" },

    {
      key: "due_date",
      header: "Due",
      render: (r) =>
        r.due_date ? new Date(r.due_date).toLocaleDateString() : "-",
    },

    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Select
          value={r.status || "Not Started"}
          onValueChange={async (value) => {
            try {
              await fetch("/api/tasks/update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  taskId: r.task_id,
                  status: value, // ✅ must match SQL CHECK constraint
                }),
              });

              mutate(["clientTasksSimple", id]); // ✅ refresh client task tab only
              toast({ title: "Task status updated" });
            } catch {
              toast({
                title: "Failed to update status",
                variant: "destructive",
              });
            }
          }}
        >
          <SelectTrigger
            className={`h-8 px-3 rounded-full text-xs font-medium border-0 ${STATUS_COLORS[r.status || "Not Started"]
              }`}
          >
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },

    // ✅ ACTIONS MUST ALWAYS BE LAST
    {
      key: "actions",
      header: "Actions",
      className: "text-center", // ✅ centers the HEADER
      render: (r) => (
        <div className="flex items-center justify-center gap-2 w-full">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              openDrawer("assignTask", {
                clientId: id,
                taskId: r.task_id,
              })
            }
          >
            Edit
          </Button>

          <Button
            size="sm"
            variant="destructive"
            onClick={async () => {
              if (!confirm("Delete this task?")) return;

              const res = await fetch("/api/tasks/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ task_id: r.task_id }),
              });

              if (res.ok) {
                toast({ title: "Task deleted" });
                mutate(["clientTasksSimple", id]);
              } else {
                toast({
                  title: "Failed to delete task",
                  variant: "destructive",
                });
              }
            }}
          >
            Delete
          </Button>
        </div>
      ),
    }
  ];

  // const getPreviewUrl = (fileUrl: string, fileName: string) => {
  //   const lower = fileName.toLowerCase();

  //   // Direct preview types
  //   if (lower.endsWith(".pdf")) return fileUrl;
  //   if (lower.match(/\.(jpg|jpeg|png|gif|svg|webp)$/)) return fileUrl;

  //   // Office / other docs -> Office viewer
  //   if (lower.match(/\.(doc|docx|ppt|pptx|xls|xlsx|csv)$/)) {
  //     return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(fileUrl)}`;
  //   }

  //   // Fallback: open the file itself (download/open by browser)
  //   return fileUrl;
  // };
  const getPreviewUrl = (fileUrl: string, fileName: string) => {
    const lower = fileName.toLowerCase();

    // Direct open types
    if (lower.endsWith(".pdf")) return fileUrl;
    if (lower.match(/\.(jpg|jpeg|png|gif|svg|webp)$/)) return fileUrl;

    // ✅ CSV should open directly (NOT Office viewer)
    if (lower.endsWith(".csv")) return fileUrl;

    // Office docs -> Office viewer
    if (lower.match(/\.(doc|docx|ppt|pptx|xls|xlsx)$/)) {
      return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(fileUrl)}`;
    }

    return fileUrl;
  };

  const docCols: Column<any>[] = [
    {
      key: "name",
      header: "Name",
      render: (row: any) => {
        const isFolder = row.type === "folder";

        let Icon = FileIcon;
        if (isFolder) Icon = Folder;
        else {
          const lowerName = (row.name || "").toLowerCase();
          if (lowerName.endsWith(".pdf")) Icon = FileText;
          else if (lowerName.match(/\.(jpg|jpeg|png|gif|svg|webp)$/)) Icon = FileImage;
          else if (lowerName.match(/\.(xls|xlsx|csv)$/)) Icon = FileSpreadsheet;
        }

        return (
          <button
            type="button"
            className="flex items-center gap-2 text-left w-full hover:underline"
            onClick={() => {
              if (!isFolder) return;
              const fullPath = selectedFolder ? `${selectedFolder}/${row.name}` : row.name;
              setSelectedFolder(fullPath);
            }}
          >
            {/* const isFolder = row.type === "folder"; */}
            <div
              className={`p-1.5 rounded-md
                ${isFolder
                  ? "bg-amber-50 text-amber-500"
                  : "bg-blue-50 text-blue-500"
                }
              `}
            >
              <Icon className="size-4" />
            </div>

            <span className="font-medium text-gray-700">{row.name}</span>
          </button>
        );
      },
    },
    {
      key: "type",
      header: "Type",
      render: (row: any) => {
        if (row.type === "folder") {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 uppercase tracking-wide">
              Folder
            </span>
          );
        }

        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 uppercase tracking-wide">
            {row.name.split(".").pop() || "FILE"}
          </span>
        );
      },
    },
    {
      key: "size",
      header: "Size",
      render: (row: any) => {
        if (row.type === "folder") return <span className="text-muted-foreground text-xs">—</span>;

        const bytes = row.size || 0;
        if (bytes === 0) return <span className="text-muted-foreground text-xs">0 B</span>;

        const units = ["B", "KB", "MB", "GB", "TB"];
        const k = 1024;
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        const size = parseFloat((bytes / Math.pow(k, i)).toFixed(2));

        return (
          <span className="font-mono text-xs text-muted-foreground">
            {size} {units[i]}
          </span>
        );
      },
    },
    {
      key: "visibility",
      header: "Visibility",
      render: (row: any) => {
        if (row.type === "folder") return <span className="text-muted-foreground text-xs">—</span>;

        const isPrivate = (row.visibility || "shared") === "private";

        return (
          <div className="flex items-center gap-1.5">
            {isPrivate ? (
              <>
                <Lock className="size-3.5 text-purple-600" />
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">
                  Private
                </span>
              </>
            ) : (
              <>
                <Eye className="size-3.5 text-blue-600" />
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                  Shared
                </span>
              </>
            )}
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "",
      className: "text-right w-[240px]",
      render: (row: any) => {
        const isFolder = row.type === "folder";

        return (
          <div className="flex items-center w-full">
            {!isFolder ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  try {
                    const lower = (row.name || "").toLowerCase();
                    const isOffice = /\.(doc|docx|ppt|pptx|xls|xlsx)$/i.test(lower);
                    const isCsv = /\.csv$/i.test(lower);

                    // ✅ Use row.path (returned by /api/documents/list) as the full blob path
                    // Fallback to row.fullPath for compatibility with get-by-client API
                    const fullPath =
                      row.path || row.fullPath ||
                      (selectedFolder ? `${selectedFolder}/${row.name}` : row.name);

                    const res = await fetch(
                      `/api/documents/public-url?clientId=${encodeURIComponent(
                        String(id)
                      )}&fullPath=${encodeURIComponent(fullPath)}`,
                      { cache: "no-store" }
                    );

                    const json = await res.json();

                    if (!res.ok || !json?.success || !json?.url) {
                      toast({
                        title: "Preview failed",
                        description: json?.error || "Could not generate preview link",
                        variant: "destructive",
                      });
                      return;
                    }

                    // ✅ Office files must go through Office viewer
                    // ✅ Office formats -> Office viewer (DOC/DOCX/XLS/XLSX/PPT/PPTX only)
                    if (isOffice) {
                      const viewer = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(
                        json.url
                      )}`;
                      window.open(viewer, "_blank", "noopener,noreferrer");
                      return;
                    }

                    // ✅ CSV (and any non-office file) -> open SAS directly (browser will show or download)
                    window.open(json.url, "_blank", "noopener,noreferrer");
                    return;

                    // ✅ PDFs, images, everything else → open SAS directly
                    window.open(json.url, "_blank", "noopener,noreferrer");
                  } catch (err: any) {
                    toast({
                      title: "Preview failed",
                      description: err?.message || "Something went wrong while previewing",
                      variant: "destructive",
                    });
                  }
                }}
              >
                View
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const fullPath = selectedFolder ? `${selectedFolder}/${row.name}` : row.name;
                  setSelectedFolder(fullPath);
                }}
              >
                Open
              </Button>
            )}

            <div className="flex-1" />

            <Button
              size="icon"
              variant="destructive"
              className="ml-4"
              onClick={() => {
                if (isFolder) {
                  const fullPath = selectedFolder ? `${selectedFolder}/${row.name}` : row.name;
                  if (!confirm(`Delete folder "${row.name}"?`)) return;

                  fetch("/api/documents/delete-folder", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ clientId: id, folderPath: fullPath }),
                  }).then(() => mutate(["docs", id, selectedFolder]));
                } else {
                  handleDeleteDocument(row);
                }
              }}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  async function handleDeleteDocument(doc: any) {
    if (!confirm(`Delete document "${doc.name}"?`)) return;

    console.log("🔥 Deleting document:", doc);

    // The backend expects: fullPath = "client-2/folder/file.png"
    // The list API returns this as "path" not "fullPath"
    const res = await fetch("/api/documents/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: id,
        fullPath: doc.path || doc.fullPath, // ✅ Use doc.path (list API) or doc.fullPath (get-by-client API)
      }),
    });

    const json = await res.json();
    console.log("DELETE RESPONSE:", json);

    if (!json.success) {
      alert("Failed to delete document.");
      return;
    }

    mutate(["docs", id, null]); // refresh root
    mutate(["docs", id, selectedFolder]); // refresh folder

    alert("Document deleted successfully!");
  }

  const items = [...docs].sort((a: any, b: any) => {
    // folders first
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    // then alphabetical
    return (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
  });


  // ----------------- CLIENT META ------------------
  const clientStatus = client?.status ?? "Not Started";
  const stageName = client?.stage_name ?? "—";
  const progress = client?.progress ?? 0;

  useEffect(() => {
    if (client?.service_center_id) {
      setSelectedServiceCenter(client.service_center_id);
    }

    if (client?.cpa_id) {
      setSelectedCPA(client.cpa_id);
    }
  }, [client]);

  async function handleSaveAssignment() {
    try {
      const res = await fetch("/api/clients/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: Number(id),
          service_center_id: selectedServiceCenter,
          cpa_id: selectedCPA,
        }),
      });

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || "Update failed");
      }

      toast({ title: "Service Center & CPA updated successfully" });

      // ✅ Refresh client data
      mutate(["client", id]);

    } catch (err) {
      console.error("SAVE ASSIGNMENT ERROR:", err);
      toast({
        title: "Failed to update assignment",
        variant: "destructive",
      });
    }
  }

  // ========== ASSOCIATED USERS HANDLERS ==========
  const handleNameInputChange = (value: string) => {
    setNewUser({ ...newUser, name: value });

    if (value.trim().length > 0) {
      const filtered = userSuggestions.filter((s) =>
        s.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (suggestion: any) => {
    setNewUser({
      name: suggestion.name,
      email: suggestion.email || "",
      role: suggestion.role || "Client User",
      phone: suggestion.phone || "",
    });
    setShowSuggestions(false);
  };

  const handleAddUser = () => {
    if (!newUser.name.trim() || !newUser.email.trim()) {
      toast({ title: "Name and email are required", variant: "destructive" });
      return;
    }

    // Check for duplicate email
    const exists = associatedUsers.some(
      (u) => u.email.toLowerCase() === newUser.email.toLowerCase()
    );
    if (exists) {
      toast({ title: "User with this email already exists", variant: "destructive" });
      return;
    }

    setAssociatedUsers([...associatedUsers, { ...newUser }]);
    setNewUser({ name: "", email: "", role: "Client User", phone: "" });
  };

  const handleRemoveUser = (index: number) => {
    setAssociatedUsers(associatedUsers.filter((_, i) => i !== index));
  };

  const handleSaveAssociatedUsers = async () => {
    setIsSavingUsers(true);
    try {
      const res = await fetch("/api/clients/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: Number(id),
          associatedUsers: associatedUsers,
        }),
      });

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || "Update failed");
      }

      toast({ title: "Associated users saved successfully" });
      setIsEditingUsers(false);
      mutate(["client", id]);

    } catch (err) {
      console.error("SAVE ASSOCIATED USERS ERROR:", err);
      toast({
        title: "Failed to save associated users",
        variant: "destructive",
      });
    } finally {
      setIsSavingUsers(false);
    }
  };

  const handleCancelEditUsers = () => {
    // Reset to original data
    setAssociatedUsers(client?.associated_users || []);
    setIsEditingUsers(false);
  };

  return (
    <div className="grid gap-4">
      {/* ---------- HEADER ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {client?.client_name ?? "Client"}
          </h1>

          <div className="mt-2 text-sm text-muted-foreground flex items-center gap-6">
            <span>
              {/* <b>Phone:</b> {formatPhone(client?.primary_contact_phone || "") || "—"} */}
              <b>Phone:</b>{" "}
              {client?.primary_contact_phone
                ? formatPhone(client.primary_contact_phone)
                : "—"}
            </span>

            <span>
              <b>Email:</b> {client?.primary_contact_email || "—"}
            </span>
          </div>

        </div>

        <div className="flex items-center gap-2">
          <ProgressRing
            value={progress}
            completedStages={client?.completed_stages}
            totalStages={client?.total_stages}
          />


          <Button
            variant="outline"
            onClick={() => router.push(`/admin/stages?clientId=${id}`)}
          >
            <Eye className="mr-2 h-4 w-4" />
            View Stage
          </Button>

          <Button
            onClick={() => {
              openDrawer("assignTask", {
                clientId: id,
                stageId: client?.stage_id,
              });
            }}
          >
            Assign Task
          </Button>

          <Button
            variant="outline"
            onClick={() => router.push(`/admin/clients/edit/${id}`)}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit Client
          </Button>

          {/* Archive/Restore Button */}
          {client?.is_archived ? (
            <Button
              variant="outline"
              onClick={() => setShowArchiveDialog(true)}
              className="text-green-600 hover:text-green-700 hover:bg-green-50"
            >
              <ArchiveRestore className="mr-2 h-4 w-4" />
              Restore Client
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => setShowArchiveDialog(true)}
              className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
            >
              <Archive className="mr-2 h-4 w-4" />
              Archive Client
            </Button>
          )}
        </div>

        {/* Archive Client Confirmation Dialog */}
        <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-orange-600">
                {client?.is_archived ? (
                  <>
                    <ArchiveRestore className="h-5 w-5 text-green-600" />
                    <span className="text-green-600">Restore Client?</span>
                  </>
                ) : (
                  <>
                    <Archive className="h-5 w-5" />
                    Archive Client?
                  </>
                )}
              </DialogTitle>
              <DialogDescription className="text-left pt-2">
                <div className="space-y-3">
                  <p className="font-medium text-gray-900">
                    {client?.is_archived ? (
                      <>You are about to restore <span className="text-green-600 font-bold">"{client?.client_name}"</span></>
                    ) : (
                      <>You are about to archive <span className="text-orange-600 font-bold">"{client?.client_name}"</span></>
                    )}
                  </p>

                  {client?.is_archived ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-sm font-semibold text-green-700 mb-2">✅ Restoring this client will:</p>
                      <ul className="text-sm text-green-600 space-y-1 list-disc list-inside">
                        <li>Set the client status back to Active</li>
                        <li>Make the client visible in the Active Clients list</li>
                        <li>All data and history will be preserved</li>
                      </ul>
                    </div>
                  ) : (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <p className="text-sm font-semibold text-orange-700 mb-2">📦 Archiving this client will:</p>
                      <ul className="text-sm text-orange-600 space-y-1 list-disc list-inside">
                        <li>Set the client status to Inactive</li>
                        <li>Move the client to the Archived Clients list</li>
                        <li>All data and history will be preserved</li>
                        <li>You can restore the client at any time</li>
                      </ul>
                    </div>
                  )}

                  <p className="text-sm text-gray-600 font-medium">
                    {client?.is_archived
                      ? "Are you sure you want to restore this client?"
                      : "Are you sure you want to archive this client?"
                    }
                  </p>
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setShowArchiveDialog(false)}
                disabled={isArchiving}
              >
                Cancel
              </Button>
              <Button
                variant={client?.is_archived ? "default" : "outline"}
                className={client?.is_archived
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-orange-600 hover:bg-orange-700 text-white"
                }
                onClick={async () => {
                  setIsArchiving(true);
                  try {
                    const res = await fetch("/api/clients/archive", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        clientId: Number(id),
                        archive: !client?.is_archived
                      }),
                    });
                    const json = await res.json();

                    if (json.success) {
                      toast({
                        title: client?.is_archived ? "Client Restored" : "Client Archived",
                        description: json.message,
                      });
                      setShowArchiveDialog(false);
                      mutate(["client", id]);
                    } else {
                      toast({
                        title: "Action Failed",
                        description: json.error || "Failed to update client status.",
                        variant: "destructive",
                      });
                    }
                  } catch (error: any) {
                    toast({
                      title: "Error",
                      description: error.message || "An error occurred.",
                      variant: "destructive",
                    });
                  } finally {
                    setIsArchiving(false);
                  }
                }}
                disabled={isArchiving}
              >
                {isArchiving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {client?.is_archived ? "Restoring..." : "Archiving..."}
                  </>
                ) : (
                  <>
                    {client?.is_archived ? (
                      <>
                        <ArchiveRestore className="mr-2 h-4 w-4" />
                        Yes, Restore Client
                      </>
                    ) : (
                      <>
                        <Archive className="mr-2 h-4 w-4" />
                        Yes, Archive Client
                      </>
                    )}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>



      {/* ---------- TABS ---------- */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {/* <TabsTrigger value="Stages">Stages & Associated Tasks</TabsTrigger> */}
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        {/* ---------- OVERVIEW ---------- */}
        <TabsContent value="overview" className="grid gap-4">
          {/* CLIENT SUMMARY */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Client Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Code */}
                <div className="bg-gradient-to-br from-slate-50 to-gray-100 border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="bg-slate-200 rounded-lg p-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                      </svg>
                    </div>
                    <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Code</span>
                  </div>
                  <p className="text-lg font-semibold text-slate-800">{client?.code || "—"}</p>
                </div>

                {/* Created */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="bg-blue-100 rounded-lg p-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="text-xs text-blue-600 font-medium uppercase tracking-wide">Created</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">
                    {client?.created_at
                      ? new Date(client.created_at).toLocaleDateString()
                      : "—"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {client?.created_at
                      ? new Date(client.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : ""}
                  </p>
                </div>

                {/* Last Updated */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="bg-amber-100 rounded-lg p-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-xs text-amber-600 font-medium uppercase tracking-wide">Last Updated</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">
                    {client?.updated_at
                      ? new Date(client.updated_at).toLocaleDateString()
                      : "—"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {client?.updated_at
                      ? new Date(client.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : ""}
                  </p>
                </div>

                {/* Progress */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="bg-emerald-100 rounded-lg p-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <span className="text-xs text-emerald-600 font-medium uppercase tracking-wide">Progress</span>
                  </div>
                  <div className="flex items-end gap-1">
                    <p className="text-2xl font-bold text-emerald-600">{progress}</p>
                    <p className="text-sm font-medium text-emerald-600 mb-0.5">%</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* STAGE TIMELINE */}
          <Card>
            <CardContent className="pt-6">
              {stages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="bg-muted/50 rounded-full p-3 mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">No onboarding stages have been set up yet.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/admin/stages?clientId=${id}`)}
                  >
                    Create Stages
                  </Button>
                </div>
              ) : (
                (() => {
                  // Calculate completed stages count
                  const sortedStages = stages.sort((a: any, b: any) => a.order_number - b.order_number);
                  const completedCount = sortedStages.filter((stage: any) => {
                    const stageWithSubtasks = subtasksByStage.find(
                      (s: any) => s.client_stage_id === stage.client_stage_id
                    );
                    const allSubtasksCompleted =
                      stageWithSubtasks?.subtasks?.length > 0 &&
                      stageWithSubtasks?.subtasks?.every(
                        (st: any) => st.status === "Completed"
                      );
                    return stage.status === "Completed" || allSubtasksCompleted;
                  }).length;
                  const totalStages = sortedStages.length;
                  const remainingCount = totalStages - completedCount;
                  const progressPercent = totalStages > 0 ? Math.round((completedCount / totalStages) * 100) : 0;

                  return (
                    <div className="space-y-4">
                      {/* Overall Progress Header */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                        <span className="text-sm font-semibold text-emerald-600">{progressPercent}%</span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${progressPercent}%`,
                            background: 'linear-gradient(90deg, #22c55e 0%, #4ade80 50%, #86efac 100%)',
                          }}
                        />
                      </div>

                      {/* Stage Count Text */}
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{completedCount} of {totalStages} stages completed</span>
                        <span>{remainingCount} remaining</span>
                      </div>

                      {/* Stage Pills */}
                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        {sortedStages.map((stage: any, index: number) => {
                          const stageWithSubtasks = subtasksByStage.find(
                            (s: any) => s.client_stage_id === stage.client_stage_id
                          );
                          const allSubtasksCompleted =
                            stageWithSubtasks?.subtasks?.length > 0 &&
                            stageWithSubtasks?.subtasks?.every(
                              (st: any) => st.status === "Completed"
                            );
                          const isCompleted = stage.status === "Completed" || allSubtasksCompleted;
                          const isInProgress = stage.status === "In Progress";

                          return (
                            <span key={stage.client_stage_id} className="flex items-center">
                              <span
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${isCompleted
                                  ? "bg-green-50 border border-green-400 text-green-700"
                                  : isInProgress
                                    ? "bg-blue-50 border border-blue-400 text-blue-700 animate-pulse"
                                    : "bg-gray-100 border border-gray-300 text-gray-600"
                                  }`}
                              >
                                {isCompleted && (
                                  <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                                {stage.stage_name}
                              </span>

                              {index < sortedStages.length - 1 && (
                                <span className="mx-2 text-gray-400">→</span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()
              )}
            </CardContent>
          </Card>


          {/* ✅ ASSIGN SERVICE CENTER & CPA */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Assigned Team
              </CardTitle>
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Service Center Card */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-blue-100 rounded-full p-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">Service Center</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-800">
                        {client?.service_center_name || "Not Assigned"}
                      </span>
                    </div>

                    {client?.service_center_email && (
                      <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <a href={`mailto:${client.service_center_email}`} className="text-sm text-blue-600 hover:underline">
                          {client.service_center_email}
                        </a>
                      </div>
                    )}

                    {!client?.service_center_name && (
                      <p className="text-xs text-gray-400 italic">No service center assigned yet</p>
                    )}
                  </div>
                </div>

                {/* CPA Card */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-emerald-100 rounded-full p-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide">Preparers</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-800">
                        {client?.cpa_name || "Not Assigned"}
                      </span>
                    </div>

                    {client?.cpa_email && (
                      <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <a href={`mailto:${client.cpa_email}`} className="text-sm text-emerald-600 hover:underline">
                          {client.cpa_email}
                        </a>
                      </div>
                    )}

                    {!client?.cpa_name && (
                      <p className="text-xs text-gray-400 italic">No Preparers assigned yet</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ASSOCIATED USERS SECTION */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Associated Users
                  <Badge variant="secondary" className="ml-2">
                    {associatedUsers.length}
                  </Badge>
                </CardTitle>
                <div className="flex items-center gap-2">
                  {isEditingUsers ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelEditUsers}
                        disabled={isSavingUsers}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveAssociatedUsers}
                        disabled={isSavingUsers}
                      >
                        {isSavingUsers ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save Users"
                        )}
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsEditingUsers(true)}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit Users
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Current Users List */}
              {associatedUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No associated users yet</p>
                  <p className="text-sm mt-1">
                    {isEditingUsers
                      ? "Add users using the form below"
                      : "Click 'Edit Users' to add team members"}
                  </p>
                </div>
              ) : (
                <div className="space-y-3 mb-6">
                  {associatedUsers.map((u, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-gradient-to-r from-slate-50 to-gray-50 border border-slate-200 rounded-lg p-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="bg-primary/10 rounded-full p-2.5">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{u.name}</p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Mail className="h-3.5 w-3.5" />
                              {u.email}
                            </span>
                            {u.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3.5 w-3.5" />
                                {formatPhone(u.phone)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary">{u.role}</Badge>
                        {isEditingUsers && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleRemoveUser(idx)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New User Form - Only visible in edit mode */}
              {isEditingUsers && (
                <div className="border-t pt-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add New User
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Name with autocomplete */}
                    <div className="relative">
                      <Label htmlFor="newUserName" className="text-xs text-muted-foreground">
                        Name *
                      </Label>
                      <Input
                        id="newUserName"
                        placeholder="Enter name"
                        value={newUser.name}
                        onChange={(e) => handleNameInputChange(e.target.value)}
                        onFocus={() => {
                          if (newUser.name.trim().length > 0) {
                            const filtered = userSuggestions.filter((s) =>
                              s.name.toLowerCase().includes(newUser.name.toLowerCase())
                            );
                            setFilteredSuggestions(filtered);
                            setShowSuggestions(filtered.length > 0);
                          }
                        }}
                        onBlur={() => {
                          // Delay hiding to allow click on suggestion
                          setTimeout(() => setShowSuggestions(false), 200);
                        }}
                      />
                      {/* Autocomplete dropdown */}
                      {showSuggestions && filteredSuggestions.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                          {filteredSuggestions.map((s, i) => (
                            <button
                              key={i}
                              type="button"
                              className="w-full px-3 py-2 text-left hover:bg-gray-100 flex flex-col"
                              onMouseDown={() => handleSelectSuggestion(s)}
                            >
                              <span className="font-medium text-sm">{s.name}</span>
                              <span className="text-xs text-muted-foreground">{s.email}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Email */}
                    <div>
                      <Label htmlFor="newUserEmail" className="text-xs text-muted-foreground">
                        Email *
                      </Label>
                      <Input
                        id="newUserEmail"
                        type="email"
                        placeholder="email@example.com"
                        value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      />
                    </div>

                    {/* Phone */}
                    <div>
                      <Label htmlFor="newUserPhone" className="text-xs text-muted-foreground">
                        Phone
                      </Label>
                      <Input
                        id="newUserPhone"
                        placeholder="(555) 555-5555"
                        value={newUser.phone}
                        onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                      />
                    </div>

                    {/* Add Button */}
                    <div className="flex items-end">
                      <Button
                        type="button"
                        onClick={handleAddUser}
                        className="w-full"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add User
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>


        {/* ---------- STAGES & TASKS ---------- */}



        <TabsContent value="Stages">
          <div className="grid gap-4">
            {stages.map((stage: any) => (
              <Card key={stage.client_stage_id} className="border rounded-lg">
                <CardHeader
                  onClick={() => toggleStage(stage.client_stage_id)}
                  className="cursor-pointer flex flex-row items-center justify-between"
                >
                  <div>
                    <CardTitle>{stage.stage_name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Status: {stage.status}
                    </p>
                  </div>
                  <ChevronDown
                    className={`transition-transform ${openStage === stage.client_stage_id ? "rotate-180" : ""
                      }`}
                  />
                </CardHeader>

                {openStage === stage.client_stage_id && (
                  <CardContent className="space-y-3">
                    {(stage.subtasks ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No subtasks for this stage.</p>
                    ) : (
                      (stage.subtasks ?? []).map((st: any) => (
                        <div
                          key={st.subtask_id}
                          className="flex items-center justify-between border p-2 rounded"
                        >
                          <div>
                            <p className="font-medium">{st.subtask_title}</p>
                            <p className="text-xs text-muted-foreground">
                              Order: {st.order_number ?? "-"}
                            </p>
                          </div>

                          <StatusPill status={st.status} />
                        </div>
                      ))
                    )}
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ---------- TASKS ---------- */}
        <TabsContent value="tasks">
          {/* ---------- TOP ACTION BAR FOR TASKS ---------- */}
          <div className="flex justify-end mb-4">
            {/* <Button
    onClick={() =>
      openDrawer("assignTask", {
        clientId: id,
        stageId: client?.stage_id,
      })
    }
  >
    Assign Task
  </Button> */}
          </div>

          {/* ---------- STAGE SUB-TASKS CARD ---------- */}
          <Card className="mt-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Onboarding Tasks</CardTitle>

              {/* ✅ SINGLE UPDATE SUB TASKS BUTTON - Only show when there are tasks */}
              {subtasksByStage.length > 0 && (
                <Button
                  size="sm"
                  onClick={() => router.push(`/admin/stages?clientId=${id}`)}
                >
                  Update Onboarding Tasks
                </Button>
              )}
            </CardHeader>


            <CardContent className="space-y-4">
              {subtasksByStage.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="bg-muted/50 rounded-full p-3 mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">No onboarding tasks have been created yet.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/admin/stages?clientId=${id}`)}
                  >
                    Add Onboarding Tasks
                  </Button>
                </div>
              )}

              {subtasksByStage.map((stage: any) => (
                <div
                  key={stage.client_stage_id}
                  className="border rounded-lg"
                >
                  <div
                    className="flex items-center justify-between p-3 cursor-pointer select-none hover:bg-muted transition"
                    onClick={() =>
                      setOpenStage((prev) =>
                        prev === stage.client_stage_id
                          ? null
                          : stage.client_stage_id
                      )
                    }
                  >
                    {/* LEFT SIDE */}
                    <div>
                      <p className="font-semibold">{stage.stage_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Status: {stage.status}
                      </p>
                    </div>

                    {/* RIGHT SIDE (ARROW ONLY – NO CLICK HANDLER HERE) */}
                    <ChevronDown
                      className={`transition-transform ${openStage === stage.client_stage_id
                        ? "rotate-180"
                        : ""
                        }`}
                    />
                  </div>



                  {/* Subtasks */}
                  {openStage === stage.client_stage_id && (
                    <div className="border-t p-3 space-y-2">
                      {stage.subtasks.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          No subtasks in this stage.
                        </p>
                      )}

                      {stage.subtasks.map((st: any) => (
                        <div
                          key={st.subtask_id}
                          className="flex items-center justify-between border p-2 rounded"
                        >
                          <div>
                            <p className="font-medium">
                              {st.subtask_title}
                            </p>

                            <div className="flex gap-4 text-xs text-muted-foreground">
                              {/* <span>Order: {st.order_number ?? "-"}</span> */}

                              <span>
                                Due : {" "}
                                {st.due_date
                                  ? new Date(st.due_date).toLocaleDateString()
                                  : "—"}
                              </span>
                            </div>
                          </div>

                          <StatusPill status={st.status} />
                        </div>
                      ))}

                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* ---------- CLIENT TASKS CARD ---------- */}
          <Card className="mt-4">
            {/* <CardHeader>
      <CardTitle>Client Tasks</CardTitle>
    </CardHeader>  */}

            <CardHeader className="flex items-center justify-between">
              <CardTitle>Stand-Alone Assigned Tasks</CardTitle>

              {/* Only show when there are tasks */}
              {taskRows.length > 0 && (
                <Button
                  size="sm"
                  onClick={() => {
                    openDrawer("assignTask", {
                      clientId: id,
                      stageId: client?.stage_id,
                    });
                  }}
                >
                  Assign Task
                </Button>
              )}

            </CardHeader>

            <CardContent className="space-y-4">

              {taskRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="bg-muted/50 rounded-full p-3 mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">No stand-alone tasks have been assigned to this client.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      openDrawer("assignTask", {
                        clientId: id,
                        stageId: client?.stage_id,
                      });
                    }}
                  >
                    Assign First Task
                  </Button>
                </div>
              ) : (
                <>
                  {/* ---------- TABLE ---------- */}
                  <DataTable
                    columns={taskCols}
                    rows={paginatedTasks}
                  />


                  {/* ---------- PAGINATION UI ---------- */}
                  <div className="flex items-center justify-between py-2 text-sm text-muted-foreground">

                    {/* Items per page */}
                    <div className="flex items-center gap-2">
                      <span>Items per page:</span>
                      <select
                        className="border rounded px-2 py-1"
                        value={taskPageSize}
                        onChange={(e) => {
                          setTaskPageSize(Number(e.target.value));
                          setTaskPage(1);
                        }}
                      >
                        {[5, 10, 20, 50].map((size) => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Page info */}
                    <div>
                      {`${(taskPage - 1) * taskPageSize + 1}–${Math.min(
                        taskPage * taskPageSize,
                        totalTasks
                      )} of ${totalTasks} items`}
                    </div>

                    {/* Prev / Next buttons */}
                    <div className="flex items-center gap-2">
                      <span>Page {taskPage} of {totalTaskPages}</span>

                      <Button
                        variant="outline"
                        size="sm"
                        disabled={taskPage <= 1}
                        onClick={() => setTaskPage(taskPage - 1)}
                      >
                        Prev
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        disabled={taskPage >= totalTaskPages}
                        onClick={() => setTaskPage(taskPage + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              )}

            </CardContent>
          </Card>



        </TabsContent>


        {/* ---------- DOCUMENTS (SharePoint-Style Tree Explorer) ---------- */}
        <TabsContent value="documents">
          <Card className="shadow-md border-0 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-amber-100 to-amber-200 p-2.5 rounded-xl shadow-sm">
                  <Folder className="size-5 text-amber-700" />
                </div>
                <div>
                  <CardTitle className="text-base">Document Explorer</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    SharePoint-style file library with role-based sections
                  </p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-5 bg-gray-50/30">
              <DocumentTreeExplorer
                clientId={id}
                clientName={client?.client_name}
              />
            </CardContent>
          </Card>
        </TabsContent>



        {/* ---------- MESSAGES ---------- */}
        <TabsContent value="messages">
          <div className="space-y-6">
            {/* Chat with Client */}
            <FlexibleChat
              clientId={id}
              clientName={client?.client_name ?? undefined}
              currentUserRole="ADMIN"
              recipients={[
                { role: "CLIENT", label: client?.client_name || "Client", color: "bg-blue-500" },
              ]}
              height="500px"
            />

            {/* Links to Service Center and CPA Chat */}
            <Card>
              <CardContent className="py-6">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <p className="text-sm text-muted-foreground">Need to message the assigned team?</p>
                  <div className="flex items-center gap-3">
                    {client?.service_center_id ? (
                      <a
                        href={`/admin/messages?tab=service-centers&scId=${client.service_center_id}`}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                      >
                        <Building2 className="size-4" />
                        Chat with {client?.service_center_name || "Service Center"}
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-400 bg-gray-100 rounded-lg cursor-not-allowed">
                        <Building2 className="size-4" />
                        No Service Center Assigned
                      </span>
                    )}
                    {client?.cpa_id ? (
                      <a
                        href={`/admin/messages?tab=cpas&cpaId=${client.cpa_id}`}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                      >
                        <Landmark className="size-4" />
                        Chat with {client?.cpa_name || "CPA"}
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-400 bg-gray-100 rounded-lg cursor-not-allowed">
                        <Landmark className="size-4" />
                        No CPA Assigned
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---------- AUDIT LOG ---------- */}
        <TabsContent value="audit">
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Activity Log</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Complete history of all actions performed on this client
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  {audits.length} {audits.length === 1 ? "entry" : "entries"}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {audits.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="bg-slate-100 p-4 rounded-full mb-4">
                    <FileText className="size-8 text-slate-400" />
                  </div>
                  <p className="font-medium text-slate-700">No activity yet</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Actions like task updates, document uploads, and messages will appear here.
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {audits.map((a) => {
                    // Determine icon and color based on action
                    const getActionStyle = (action: string) => {
                      if (action.includes("Task created")) return { icon: "📋", bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" };
                      if (action.includes("Task") && action.includes("completed")) return { icon: "✅", bg: "bg-green-50", border: "border-green-200", text: "text-green-700" };
                      if (action.includes("Task updated")) return { icon: "✏️", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700" };
                      if (action.includes("Task deleted")) return { icon: "🗑️", bg: "bg-red-50", border: "border-red-200", text: "text-red-700" };
                      if (action.includes("Stage")) return { icon: "🎯", bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700" };
                      if (action.includes("Document") || action.includes("Folder")) return { icon: "📁", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700" };
                      if (action.includes("Message")) return { icon: "💬", bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700" };
                      if (action.includes("Service Center") || action.includes("CPA")) return { icon: "👤", bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-700" };
                      if (action.includes("Client")) return { icon: "🏢", bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-700" };
                      return { icon: "📝", bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-600" };
                    };

                    const style = getActionStyle(a.action);

                    const date = new Date(a.at);
                    const dateStr = date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });
                    const timeStr = date.toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    });

                    return (
                      <div
                        key={a.id}
                        className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors gap-4"
                      >
                        <div className="flex items-start gap-4">
                          {/* Icon */}
                          <div className={`w-10 h-10 rounded-full ${style.bg} ${style.border} border flex items-center justify-center text-lg shrink-0`}>
                            {style.icon}
                          </div>

                          {/* Content */}
                          <div>
                            <p className={`font-medium ${style.text}`}>
                              {a.action}
                            </p>
                            {a.actorRole && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium mt-1">
                                {a.actorRole}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Date/Time */}
                        <div className="text-right text-xs whitespace-nowrap">
                          <div className="font-medium text-slate-600">{dateStr}</div>
                          <div className="text-slate-400">{timeStr}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
