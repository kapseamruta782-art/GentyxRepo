// app/admin/documents/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import useSWR, { mutate } from "swr";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUIStore } from "@/store/ui-store";
import { useToast } from "@/hooks/use-toast";
import { fetchClients } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Folder,
  FolderOpen,
  FileText,
  FileImage,
  FileSpreadsheet,
  File as FileIcon,
  Trash2,
  Upload,
  CheckCircle2,
  Layers,
  Users,
  ChevronsUpDown,
  Building2,
  Landmark,
  ChevronRight,
  ChevronDown,
  Lock,
  Share2,
  UserCircle,
  Eye,
  EyeOff,
  FolderPlus,
  Shield,
  Globe,
  User,
  HardDrive,
} from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandInput,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

/* ─────────────────── CONSTANTS ─────────────────── */
const ASSIGNED_TASK_FOLDER = "Assigned Task Completion Documents";
const ASSIGNED_TASK_CPA_FOLDER = "Assigned Task Completion Documents - CPA";
const ASSIGNED_TASK_SC_FOLDER = "Assigned Task Completion Documents - Service Center";
const ONBOARDING_FOLDER = "Onboarding Stage Completion Documents";

/* ─────────────────── CATEGORY DEFINITIONS ─────────────────── */
type DocumentCategory = "admin-only" | "legacy-client-shared" | "client-only";

const CATEGORY_CONFIG: Record<DocumentCategory, {
  label: string;
  description: string;
  icon: any;
  colorScheme: {
    bg: string;
    bgHover: string;
    border: string;
    borderHover: string;
    text: string;
    iconBg: string;
    iconColor: string;
    badge: string;
    badgeText: string;
    headerGradient: string;
    stripe: string;
  };
}> = {
  "admin-only": {
    label: "Admin Restricted",
    description: "Internal files — Not visible to Client",
    icon: Shield,
    colorScheme: {
      bg: "bg-rose-50/40",
      bgHover: "hover:bg-rose-50/70",
      border: "border-rose-200/60",
      borderHover: "hover:border-rose-300",
      text: "text-rose-700",
      iconBg: "bg-rose-100",
      iconColor: "text-rose-600",
      badge: "bg-rose-100",
      badgeText: "text-rose-700",
      headerGradient: "from-rose-50 to-rose-100/50",
      stripe: "bg-rose-500",
    },
  },
  "legacy-client-shared": {
    label: "Legacy Uploaded",
    description: "Uploaded by Legacy — Visible to both Admin and Client",
    icon: Globe,
    colorScheme: {
      bg: "bg-blue-50/40",
      bgHover: "hover:bg-blue-50/70",
      border: "border-blue-200/60",
      borderHover: "hover:border-blue-300",
      text: "text-blue-700",
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      badge: "bg-blue-100",
      badgeText: "text-blue-700",
      headerGradient: "from-blue-50 to-blue-100/50",
      stripe: "bg-blue-500",
    },
  },
  "client-only": {
    label: "Client Uploaded",
    description: "Uploaded by Client — Visible to both Admin and Client",
    icon: User,
    colorScheme: {
      bg: "bg-emerald-50/40",
      bgHover: "hover:bg-emerald-50/70",
      border: "border-emerald-200/60",
      borderHover: "hover:border-emerald-300",
      text: "text-emerald-700",
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      badge: "bg-emerald-100",
      badgeText: "text-emerald-700",
      headerGradient: "from-emerald-50 to-emerald-100/50",
      stripe: "bg-emerald-500",
    },
  },
};

/* ─────────────────── HELPERS ─────────────────── */
function getFileIcon(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return FileText;
  if (lower.match(/\.(jpg|jpeg|png|gif|svg|webp)$/)) return FileImage;
  if (lower.match(/\.(xls|xlsx|csv)$/)) return FileSpreadsheet;
  if (lower.match(/\.(doc|docx)$/)) return FileText;
  return FileIcon;
}

function formatFileSize(bytes: number) {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
  return `${size} ${units[i]}`;
}

function categorizeDocument(doc: any): DocumentCategory {
  const visibility = (doc.visibility || "shared").toLowerCase();
  const uploadedBy = (doc.uploadedBy || "unknown").toUpperCase();

  // Admin-uploaded with private visibility → Admin Only
  if (visibility === "private" && uploadedBy === "ADMIN") {
    return "admin-only";
  }

  // Client uploaded docs → Client Only
  if (uploadedBy === "CLIENT") {
    return "client-only";
  }

  // Everything else (admin shared, system, legacy) → Legacy + Client Shared
  return "legacy-client-shared";
}

function categorizeFolder(_folder: any): DocumentCategory[] {
  // Folders can belong to multiple categories or default to "legacy-client-shared"
  return ["admin-only", "legacy-client-shared", "client-only"];
}

/* ─────────────────── MAIN COMPONENT ─────────────────── */
export default function AdminDocumentsPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();

  // Read clientId and folder from URL query parameters
  const urlClientId = searchParams.get("clientId");
  const urlFolder = searchParams.get("folder");

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [clientOpen, setClientOpen] = useState(false);

  // Category expansion state
  const [expandedCategories, setExpandedCategories] = useState<Record<DocumentCategory, boolean>>({
    "admin-only": true,
    "legacy-client-shared": true,
    "client-only": true,
  });

  // Track expanded folders within each category
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Upload state
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingClientId, setPendingClientId] = useState<string>("");
  const [pendingFolderName, setPendingFolderName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Upload target category (determines visibility)
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory>("legacy-client-shared");

  const doUpload = async (action: "ask" | "replace" | "skip") => {
    if (!pendingClientId || !pendingFile) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("clientId", pendingClientId);
      if (pendingFolderName) fd.append("folderName", pendingFolderName);
      fd.append("file", pendingFile);
      fd.append("duplicateAction", action);

      // Set visibility based on category
      if (uploadCategory === "admin-only") {
        fd.append("visibility", "private");
      } else {
        fd.append("visibility", "shared");
      }

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: fd,
      });

      const json = await res.json();

      if (res.status === 409 && json?.duplicate) {
        setDuplicateOpen(true);
        return;
      }

      if (!json?.success) return;

      setDuplicateOpen(false);

      window.dispatchEvent(
        new CustomEvent("clienthub:docs-updated", {
          detail: {
            clientId: pendingClientId,
            folderName: pendingFolderName ?? null,
          },
        })
      );

      setPendingFile(null);
    } catch (e: any) {
      // Error handled silently
    } finally {
      setUploading(false);
    }
  };

  // Revalidate docs list
  const revalidateDocs = (clientId?: string | null, folder?: string | null) => {
    const cid = clientId ?? selectedClientId;
    const f = folder ?? selectedFolder;

    if (!cid) return;

    mutate(["docs", cid, null]);
    mutate(["docs", cid, f ?? null]);
  };

  // Listen for upload success event
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      revalidateDocs(detail.clientId, detail.folderName ?? null);
    };

    window.addEventListener("clienthub:docs-updated", handler as EventListener);
    return () => window.removeEventListener("clienthub:docs-updated", handler as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId, selectedFolder]);

  // Initialize from URL on mount
  useEffect(() => {
    if (urlClientId) setSelectedClientId(urlClientId);
    if (urlFolder) setSelectedFolder(decodeURIComponent(urlFolder));
  }, [urlClientId, urlFolder]);

  // Fetch clients list
  const { data: clientsData } = useSWR(["clients"], () =>
    fetchClients({ page: 1, pageSize: 500 })
  );
  const clients = clientsData?.data || [];

  // Fetch documents for selected client
  const { data: docsResponse, isLoading } = useSWR(
    selectedClientId ? ["docs", selectedClientId, selectedFolder] : null,
    () =>
      selectedFolder
        ? fetch(`/api/documents/get-by-client?id=${selectedClientId}&folder=${encodeURIComponent(selectedFolder)}`).then((r) => r.json())
        : fetch(`/api/documents/get-by-client?id=${selectedClientId}`).then((r) => r.json()),
    { revalidateOnFocus: false }
  );

  const docs = docsResponse?.data || [];

  // Categorize documents
  const categorizedDocs = {
    "admin-only": docs.filter((d: any) => d.type === "file" && categorizeDocument(d) === "admin-only"),
    "legacy-client-shared": docs.filter((d: any) => d.type === "file" && categorizeDocument(d) === "legacy-client-shared"),
    "client-only": docs.filter((d: any) => d.type === "file" && categorizeDocument(d) === "client-only"),
  };

  // Get folders
  const folders = docs.filter((d: any) => d.type === "folder");

  // Get client name
  const getClientName = (clientId: string | null) => {
    if (!clientId) return "Select a client";
    const client = clients.find((c: any) => c.client_id === Number(clientId));
    return client?.client_name || `Client #${clientId}`;
  };

  // Toggle category expansion
  const toggleCategory = (category: DocumentCategory) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  // Toggle folder expansion
  const toggleFolder = (folderKey: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderKey)) {
        next.delete(folderKey);
      } else {
        next.add(folderKey);
      }
      return next;
    });
  };

  /* ─────────── DELETE DOCUMENT ─────────── */
  async function handleDeleteDocument(doc: any) {
    if (!confirm(`Delete document "${doc.name}"?`)) return;

    const res = await fetch("/api/documents/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: selectedClientId,
        fullPath: doc.fullPath,
      }),
    });

    const json = await res.json();

    if (!json.success) {
      toast({ title: "Failed to delete document", variant: "destructive" });
      return;
    }

    mutate(["docs", selectedClientId, null]);
    mutate(["docs", selectedClientId, selectedFolder]);
    toast({ title: "Document deleted successfully" });
  }

  /* ─────────── CREATE FOLDER ─────────── */
  async function handleCreateFolder() {
    if (!newFolderName.trim() || !selectedClientId) return;

    const res = await fetch("/api/documents/create-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: selectedClientId,
        folderName: newFolderName,
        parentFolder: selectedFolder,
      }),
    });

    const data = await res.json();

    if (data.success) {
      toast({ title: "Folder created successfully" });
      mutate(["docs", selectedClientId, selectedFolder]);
      setShowCreateFolder(false);
      setNewFolderName("");
    } else {
      toast({
        title: "Folder creation failed",
        description: data.error || "Unable to create folder",
        variant: "destructive",
      });
    }
  }

  /* ─────────── VIEW FILE ─────────── */
  async function handleViewFile(doc: any) {
    try {
      const lower = (doc.name || "").toLowerCase();
      const isOffice = /\.(doc|docx|ppt|pptx|xls|xlsx|csv)$/i.test(lower);

      const res = await fetch(
        `/api/documents/public-url?clientId=${encodeURIComponent(
          selectedClientId || ""
        )}&fullPath=${encodeURIComponent(doc.fullPath)}`,
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

      if (isOffice) {
        const viewer = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(
          json.url
        )}`;
        window.open(viewer, "_blank", "noopener,noreferrer");
        return;
      }

      window.open(json.url, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      toast({
        title: "Preview failed",
        description: err?.message || "Something went wrong while previewing",
        variant: "destructive",
      });
    }
  }

  /* ─────────── RENDER: FILE ROW ─────────── */
  function FileRow({ doc, category }: { doc: any; category: DocumentCategory }) {
    const config = CATEGORY_CONFIG[category];
    const Icon = getFileIcon(doc.name);
    const extension = doc.name.split(".").pop()?.toUpperCase() || "FILE";

    return (
      <div
        className={cn(
          "group flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 last:border-b-0",
          "hover:bg-gray-50/80 transition-all duration-150"
        )}
      >
        {/* Tree indent lines */}
        <div className="flex items-center gap-0 pl-6">
          <div className="w-4 h-px bg-gray-300"></div>
        </div>

        {/* File icon */}
        <div className={cn("flex-shrink-0 p-1.5 rounded-md", config.colorScheme.iconBg)}>
          <Icon className={cn("size-4", config.colorScheme.iconColor)} />
        </div>

        {/* File name */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-700 truncate" title={doc.name}>
            {doc.name}
          </p>
        </div>

        {/* File type badge */}
        <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600 uppercase tracking-wider">
          {extension}
        </span>

        {/* File size */}
        <span className="hidden md:inline text-xs font-mono text-gray-400 w-20 text-right">
          {formatFileSize(doc.size || 0)}
        </span>

        {/* Visibility badge */}
        <span className={cn(
          "hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
          category === "admin-only"
            ? "bg-rose-50 text-rose-600"
            : "bg-emerald-50 text-emerald-600"
        )}>
          {category === "admin-only" ? (
            <><EyeOff className="size-2.5" /> Private</>
          ) : (
            <><Eye className="size-2.5" /> Shared</>
          )}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2.5 text-xs hover:bg-blue-50 hover:text-blue-600"
            onClick={() => handleViewFile(doc)}
          >
            View
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 hover:bg-red-50 hover:text-red-600"
            onClick={() => handleDeleteDocument(doc)}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  /* ─────────── RENDER: FOLDER ROW ─────────── */
  function FolderRow({ folder }: { folder: any }) {
    const fullPath = selectedFolder
      ? `${selectedFolder}/${folder.name}`
      : folder.name;

    // Determine special folder styling
    let folderColorClass = "text-amber-500";
    let folderBgClass = "bg-amber-50";

    if (folder.name === ASSIGNED_TASK_FOLDER) {
      folderColorClass = "text-green-500";
      folderBgClass = "bg-green-50";
    } else if (folder.name === ASSIGNED_TASK_CPA_FOLDER) {
      folderColorClass = "text-purple-500";
      folderBgClass = "bg-purple-50";
    } else if (folder.name === ASSIGNED_TASK_SC_FOLDER) {
      folderColorClass = "text-indigo-500";
      folderBgClass = "bg-indigo-50";
    } else if (folder.name === ONBOARDING_FOLDER) {
      folderColorClass = "text-blue-500";
      folderBgClass = "bg-blue-50";
    }

    return (
      <div
        className={cn(
          "group flex items-center gap-3 px-4 py-2.5 border-b border-gray-100",
          "hover:bg-gray-50/80 cursor-pointer transition-all duration-150"
        )}
        onClick={() => setSelectedFolder(fullPath)}
      >
        {/* Folder icon */}
        <div className={cn("flex-shrink-0 p-1.5 rounded-md", folderBgClass)}>
          <Folder className={cn("size-4", folderColorClass)} />
        </div>

        {/* Folder name */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-700 truncate" title={folder.name}>
            {folder.name}
          </p>
          {(folder.name === ASSIGNED_TASK_FOLDER ||
            folder.name === ASSIGNED_TASK_CPA_FOLDER ||
            folder.name === ASSIGNED_TASK_SC_FOLDER ||
            folder.name === ONBOARDING_FOLDER) && (
              <p className="text-[10px] text-gray-400 mt-0.5">System Folder</p>
            )}
        </div>

        {/* Type badge */}
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 uppercase tracking-wider">
          Folder
        </span>

        {/* Navigate arrow */}
        <ChevronRight className="size-4 text-gray-300 group-hover:text-gray-500 transition-colors" />

        {/* Delete button */}
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition-all"
          onClick={(e) => {
            e.stopPropagation();
            if (!confirm(`Delete folder "${folder.name}"?`)) return;
            fetch("/api/documents/delete-folder", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                clientId: selectedClientId,
                folderPath: fullPath,
              }),
            }).then(() => mutate(["docs", selectedClientId, selectedFolder]));
          }}
          title="Delete folder"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  /* ─────────── RENDER: CATEGORY SECTION ─────────── */
  function CategorySection({
    category,
    documents,
  }: {
    category: DocumentCategory;
    documents: any[];
  }) {
    const config = CATEGORY_CONFIG[category];
    const isExpanded = expandedCategories[category];
    const CategoryIcon = config.icon;
    const fileCount = documents.length;

    return (
      <div className={cn(
        "rounded-xl border overflow-hidden transition-all duration-200",
        config.colorScheme.border,
        "shadow-sm hover:shadow-md"
      )}>
        {/* Category Header - Clickable to expand/collapse */}
        <button
          onClick={() => toggleCategory(category)}
          className={cn(
            "w-full flex items-center gap-3 px-5 py-3.5 text-left transition-all duration-200",
            `bg-gradient-to-r ${config.colorScheme.headerGradient}`,
            config.colorScheme.bgHover,
            "group"
          )}
        >
          {/* Left stripe accent */}
          <div className={cn(
            "absolute left-0 top-0 bottom-0 w-1 rounded-l-xl",
            config.colorScheme.stripe
          )} style={{ position: "absolute" }} />

          {/* Expand/Collapse chevron */}
          <div className={cn(
            "flex-shrink-0 p-0.5 rounded transition-transform duration-200",
            isExpanded ? "rotate-0" : "-rotate-90"
          )}>
            <ChevronDown className={cn("size-4", config.colorScheme.text)} />
          </div>

          {/* Category Icon */}
          <div className={cn("flex-shrink-0 p-2 rounded-lg", config.colorScheme.iconBg)}>
            <CategoryIcon className={cn("size-4", config.colorScheme.iconColor)} />
          </div>

          {/* Category Label & Description */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className={cn("text-sm font-semibold", config.colorScheme.text)}>
                {config.label}
              </h3>
              <span className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold",
                config.colorScheme.badge, config.colorScheme.badgeText
              )}>
                {fileCount} {fileCount === 1 ? "file" : "files"}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">{config.description}</p>
          </div>

          {/* Upload button for this category */}
          {selectedClientId && (
            <Button
              size="sm"
              variant="ghost"
              className={cn(
                "h-8 px-3 text-xs opacity-0 group-hover:opacity-100 transition-opacity",
                config.colorScheme.text,
                `hover:${config.colorScheme.bg}`
              )}
              onClick={(e) => {
                e.stopPropagation();
                setUploadCategory(category);

                // Determine folder name based on category if at root
                let targetFolder = selectedFolder;
                if (!targetFolder) {
                  if (category === "admin-only") targetFolder = "Admin Restricted";
                  else if (category === "client-only") targetFolder = "Client Uploaded";
                  else if (category === "legacy-client-shared") targetFolder = "Legacy Uploaded";
                }

                useUIStore.getState().openDrawer("uploadDoc", {
                  clientId: selectedClientId,
                  folderName: targetFolder,
                  visibility: category === "admin-only" ? "private" : "shared",
                });
              }}
            >
              <Upload className="size-3.5 mr-1.5" />
              Upload
            </Button>
          )}
        </button>

        {/* Category Content */}
        <div
          className={cn(
            "overflow-hidden transition-all duration-300 ease-in-out",
            isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
          )}
        >
          {documents.length === 0 ? (
            <div className="flex items-center gap-3 px-8 py-6 text-gray-400">
              <div className={cn("p-2 rounded-lg", config.colorScheme.iconBg, "opacity-50")}>
                <FileIcon className={cn("size-4", config.colorScheme.iconColor, "opacity-50")} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-400">No documents</p>
                <p className="text-xs text-gray-350">
                  {category === "admin-only"
                    ? "Upload confidential files here — Clients will not see them."
                    : category === "client-only"
                      ? "Documents uploaded by the client will appear here."
                      : "Shared documents for collaboration will appear here."}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white">
              {documents.map((doc: any, idx: number) => (
                <FileRow key={doc.fullPath || doc.name || idx} doc={doc} category={category} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════════ */
  /*                                 RENDER                                    */
  /* ═══════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-0 overflow-hidden">
        {/* ─── HEADER ─── */}
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-amber-100 to-amber-200 p-2.5 rounded-xl shadow-sm">
              <HardDrive className="size-5 text-amber-700" />
            </div>
            <div>
              <CardTitle className="text-lg">Document Explorer</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                SharePoint-style document management with role-based access
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* CREATE FOLDER BUTTON */}
            {selectedClientId && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 border-gray-200 hover:border-gray-300 shadow-sm"
                onClick={() => setShowCreateFolder(true)}
              >
                <FolderPlus className="size-4 mr-1.5 text-amber-500" />
                New Folder
              </Button>
            )}

            {/* UPLOAD DOCUMENT BUTTON */}
            {selectedClientId && (
              <Button
                size="sm"
                className="h-9 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-sm"
                onClick={() =>
                  useUIStore.getState().openDrawer("uploadDoc", {
                    clientId: selectedClientId,
                    folderName: selectedFolder,
                  })
                }
              >
                <Upload className="size-4 mr-1.5" />
                Upload Document
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-6 bg-gray-50/30">
          {/* ─── CLIENT SELECTOR ─── */}
          <div className={cn(
            "mb-6 p-4 rounded-xl border transition-all duration-200",
            selectedClientId
              ? "border-blue-200 bg-gradient-to-r from-blue-50/50 to-white shadow-sm"
              : "border-gray-200 bg-white"
          )}>
            <div className="flex items-center gap-4">
              <div className={cn(
                "p-3 rounded-xl transition-all duration-200",
                selectedClientId
                  ? "bg-blue-100 shadow-sm"
                  : "bg-gray-100"
              )}>
                <Users className={cn(
                  "h-6 w-6 transition-colors",
                  selectedClientId ? "text-blue-600" : "text-gray-500"
                )} />
              </div>

              <div className="flex-1">
                <Label className="text-sm font-medium mb-2 block text-gray-600">
                  {selectedClientId ? "Viewing Documents For:" : "Select a Client to View Documents"}
                </Label>

                <Popover open={clientOpen} onOpenChange={setClientOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full max-w-md justify-between h-11 text-left border-gray-300 hover:bg-gray-50 shadow-sm"
                    >
                      <div className="flex items-center gap-2">
                        {selectedClientId ? (
                          <>
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                            <span className="font-medium">{getClientName(selectedClientId)}</span>
                          </>
                        ) : (
                          <span className="text-gray-500">Select a client...</span>
                        )}
                      </div>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-gray-400" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="🔍 Search clients by name..." className="h-12" />
                      <CommandList className="max-h-[300px]">
                        <CommandEmpty>No client found.</CommandEmpty>
                        <CommandGroup heading="Clients">
                          {clients.map((c: any) => (
                            <CommandItem
                              key={c.client_id}
                              value={c.client_name}
                              onSelect={() => {
                                setSelectedClientId(c.client_id.toString());
                                setSelectedFolder(null);
                                setClientOpen(false);
                              }}
                              className="py-3 cursor-pointer"
                            >
                              <CheckCircle2 className={cn("mr-3 h-5 w-5", selectedClientId === String(c.client_id) ? "text-green-500 opacity-100" : "opacity-0")} />
                              <div className="flex flex-col">
                                <span className="font-medium">{c.client_name}</span>
                                {c.primary_contact_email && (
                                  <span className="text-xs text-muted-foreground">{c.primary_contact_email}</span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {selectedClientId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedClientId(null);
                    setSelectedFolder(null);
                  }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  Change Client
                </Button>
              )}
            </div>
          </div>

          {/* ─── NO CLIENT SELECTED ─── */}
          {!selectedClientId && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="bg-gradient-to-br from-gray-100 to-gray-200 p-6 rounded-2xl mb-4 shadow-inner">
                  <HardDrive className="h-12 w-12 text-gray-400" />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-amber-100 p-2 rounded-full shadow-sm">
                  <Folder className="h-4 w-4 text-amber-500" />
                </div>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-gray-700">No Client Selected</h3>
              <p className="text-muted-foreground text-sm text-center max-w-md">
                Select a client from the dropdown above to explore their document library.
              </p>
            </div>
          )}

          {/* ─── CREATE FOLDER MODAL ─── */}
          {showCreateFolder && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
              <div className="bg-white p-6 rounded-2xl shadow-2xl w-[380px] space-y-4 border">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-100 p-2.5 rounded-xl">
                    <FolderPlus className="size-5 text-amber-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">New Folder</h2>
                    <p className="text-xs text-gray-400">Create a new folder in the current directory</p>
                  </div>
                </div>

                <Input
                  placeholder="Enter folder name..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="border-gray-200 focus:border-amber-500 focus:ring-amber-500 h-11"
                  autoFocus
                />

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowCreateFolder(false);
                      setNewFolderName("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateFolder}
                    className="bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                  >
                    Create Folder
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ─── DUPLICATE FILE DIALOG ─── */}
          {duplicateOpen && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
              <div className="bg-white p-6 rounded-2xl shadow-2xl w-[380px] space-y-4 border">
                <h2 className="text-lg font-semibold">File Already Exists</h2>
                <p className="text-sm text-gray-500">
                  A file with this name already exists. What would you like to do?
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setDuplicateOpen(false);
                      setPendingFile(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={() => doUpload("replace")}
                    disabled={uploading}
                  >
                    Replace
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ═══════ DOCUMENT EXPLORER CONTENT ═══════ */}
          {selectedClientId && (
            <>
              {/* ─── BREADCRUMB ─── */}
              {selectedFolder && (
                <div className="mb-5 flex items-center gap-2 bg-white/80 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-gray-100 shadow-sm">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="pl-0 hover:bg-transparent hover:text-blue-600 text-gray-500 font-medium"
                    onClick={() => setSelectedFolder(null)}
                  >
                    <HardDrive className="size-3.5 mr-1.5" />
                    Root
                  </Button>
                  {selectedFolder.split("/").map((part, idx, arr) => (
                    <span key={idx} className="flex items-center gap-1.5">
                      <ChevronRight className="size-3 text-gray-300" />
                      {idx === arr.length - 1 ? (
                        <span className="flex items-center gap-1.5 font-semibold text-gray-700 text-sm">
                          <FolderOpen className="size-3.5 text-amber-500" />
                          {part}
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 text-gray-500 hover:text-blue-600 text-sm"
                          onClick={() => {
                            const path = selectedFolder.split("/").slice(0, idx + 1).join("/");
                            setSelectedFolder(path);
                          }}
                        >
                          {part}
                        </Button>
                      )}
                    </span>
                  ))}
                </div>
              )}

              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="relative">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-blue-500"></div>
                  </div>
                  <p className="mt-4 text-sm text-gray-500 font-medium">Loading documents...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* ─── FOLDERS SECTION (common across categories) ─── */}
                  {folders.length > 0 && (
                    <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                      {/* Folders header */}
                      <div className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-amber-50/80 to-white border-b border-gray-100">
                        <div className="bg-amber-100 p-1.5 rounded-lg">
                          <Folder className="size-4 text-amber-600" />
                        </div>
                        <h3 className="text-sm font-semibold text-amber-800">
                          Folders
                        </h3>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                          {folders.length}
                        </span>
                      </div>

                      {/* Folder items */}
                      <div className="bg-white">
                        {folders.map((folder: any) => (
                          <FolderRow key={folder.name} folder={folder} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ─── DOCUMENT CATEGORY SECTIONS ─── */}
                  {(["admin-only", "legacy-client-shared", "client-only"] as DocumentCategory[]).map(
                    (category) => (
                      <CategorySection
                        key={category}
                        category={category}
                        documents={categorizedDocs[category]}
                      />
                    )
                  )}

                  {/* Empty state when no files and no folders */}
                  {docs.length === 0 && (
                    <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-200">
                      <div className="flex flex-col items-center gap-3">
                        <div className="bg-gray-100 p-4 rounded-2xl">
                          <HardDrive className="size-8 text-gray-300" />
                        </div>
                        <div>
                          <p className="text-gray-500 font-medium">This directory is empty</p>
                          <p className="text-sm text-gray-400 mt-1">Upload documents or create folders to get started</p>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="shadow-sm"
                            onClick={() => setShowCreateFolder(true)}
                          >
                            <FolderPlus className="size-4 mr-1.5 text-amber-500" />
                            New Folder
                          </Button>
                          <Button
                            size="sm"
                            className="bg-gradient-to-r from-blue-600 to-blue-700 shadow-sm"
                            onClick={() =>
                              useUIStore.getState().openDrawer("uploadDoc", {
                                clientId: selectedClientId,
                                folderName: selectedFolder,
                              })
                            }
                          >
                            <Upload className="size-4 mr-1.5" />
                            Upload Document
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
