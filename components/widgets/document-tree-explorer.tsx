// components/widgets/document-tree-explorer.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import useSWR, { mutate } from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUIStore } from "@/store/ui-store";
import { useToast } from "@/hooks/use-toast";
import {
    ChevronRight,
    ChevronDown,
    Folder,
    FolderOpen,
    FileText,
    FileImage,
    FileSpreadsheet,
    File as FileIcon,
    Trash2,
    Upload,
    FolderPlus,
    Shield,
    Users,
    Layers,
    Lock,
    Eye,
    Loader2,
    ArrowLeft,
    ExternalLink,
} from "lucide-react";

/* ─────────────────── SECTION DEFINITIONS ─────────────────── */
export const SECTION_DEFS = [
    {
        key: "Admin Restricted",
        label: "Admin Restricted",
        description: "Internal files — Not visible to Client",
        visibility: "private" as const,
        Icon: Shield,
        stripe: "bg-rose-500",
        headerBg: "from-rose-50 to-rose-100/60",
        headerHover: "hover:from-rose-100/80 hover:to-rose-100/80",
        border: "border-rose-200/60",
        text: "text-rose-700",
        iconBg: "bg-rose-100",
        iconColor: "text-rose-600",
        badge: "bg-rose-100 text-rose-700",
        fileBg: "bg-rose-50",
        fileColor: "text-rose-500",
    },
    {
        key: "Legacy Uploaded",
        label: "Legacy Uploaded",
        description: "Uploaded by Legacy — Visible to both Admin and Client",
        visibility: "shared" as const,
        Icon: Layers,
        stripe: "bg-blue-500",
        headerBg: "from-blue-50 to-blue-100/60",
        headerHover: "hover:from-blue-100/80 hover:to-blue-100/80",
        border: "border-blue-200/60",
        text: "text-blue-700",
        iconBg: "bg-blue-100",
        iconColor: "text-blue-600",
        badge: "bg-blue-100 text-blue-700",
        fileBg: "bg-blue-50",
        fileColor: "text-blue-500",
    },
    {
        key: "Client Uploaded",
        label: "Client Uploaded",
        description: "Uploaded by Client — Visible to both Admin and Client",
        visibility: "shared" as const,
        Icon: Users,
        stripe: "bg-emerald-500",
        headerBg: "from-emerald-50 to-emerald-100/60",
        headerHover: "hover:from-emerald-100/80 hover:to-emerald-100/80",
        border: "border-emerald-200/60",
        text: "text-emerald-700",
        iconBg: "bg-emerald-100",
        iconColor: "text-emerald-600",
        badge: "bg-emerald-100 text-emerald-700",
        fileBg: "bg-emerald-50",
        fileColor: "text-emerald-500",
    },
] as const;

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
    if (!bytes || bytes === 0) return "—";
    const units = ["B", "KB", "MB", "GB"];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

/* ─────────────────── INLINE CREATE FOLDER ─────────────────── */
function InlineCreateFolder({
    clientId,
    parentFolder,
    section,
    onDone,
}: {
    clientId: string;
    parentFolder: string;
    section: typeof SECTION_DEFS[number];
    onDone: () => void;
}) {
    const { toast } = useToast();
    const [name, setName] = useState("");
    const [creating, setCreating] = useState(false);

    const handleCreate = async () => {
        if (!name.trim()) return;
        setCreating(true);
        try {
            const res = await fetch("/api/documents/create-folder", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientId,
                    folderName: name.trim(),
                    parentFolder,
                    role: "ADMIN",
                }),
            });
            const data = await res.json();
            if (data.success) {
                toast({ title: "Folder created" });
                mutate(
                    (key: any) => Array.isArray(key) && key[0] === "tree" && key[1] === clientId,
                    undefined,
                    { revalidate: true }
                );
                onDone();
            } else {
                toast({ title: "Failed", description: data.error || "Could not create folder", variant: "destructive" });
            }
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50/50 border-b border-amber-100">
            <FolderPlus className="size-4 text-amber-500 flex-shrink-0" />
            <Input
                placeholder="New folder name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-8 text-sm flex-1 max-w-xs border-amber-200 focus:border-amber-400 focus:ring-amber-400"
                autoFocus
                onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") onDone();
                }}
            />
            <Button
                size="sm"
                className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                onClick={handleCreate}
                disabled={creating || !name.trim()}
            >
                {creating ? <Loader2 className="size-3 animate-spin" /> : "Create"}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onDone}>
                Cancel
            </Button>
        </div>
    );
}

/* ─────────────────── TREE FILE ROW ─────────────────── */
function TreeFileRow({
    file,
    clientId,
    depth,
    section,
}: {
    file: any;
    clientId: string;
    depth: number;
    section: typeof SECTION_DEFS[number];
}) {
    const { toast } = useToast();
    const Icon = getFileIcon(file.name);
    const ext = file.name.split(".").pop()?.toUpperCase() || "FILE";

    const handleView = async () => {
        try {
            const lower = (file.name || "").toLowerCase();
            const isOffice = /\.(doc|docx|ppt|pptx|xls|xlsx)$/i.test(lower);
            const fullPath = file.path || file.fullPath || file.name;

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

    const handleDelete = async () => {
        if (!confirm(`Delete "${file.name}"?`)) return;
        const fullPath = file.path || file.fullPath;
        const res = await fetch("/api/documents/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientId, fullPath }),
        });
        const json = await res.json();
        if (json.success) {
            toast({ title: "Document deleted" });
            mutate(
                (key: any) => Array.isArray(key) && key[0] === "tree" && key[1] === clientId,
                undefined,
                { revalidate: true }
            );
        } else {
            toast({ title: "Delete failed", variant: "destructive" });
        }
    };

    return (
        <div
            className="group flex items-center gap-2 py-1.5 pr-3 hover:bg-gray-50/80 transition-colors duration-100"
            style={{ paddingLeft: `${depth * 24 + 16}px` }}
        >
            {/* Tree connector */}
            <div className="w-4 flex items-center justify-center flex-shrink-0">
                <div className="w-3 h-px bg-gray-200" />
            </div>

            {/* File icon */}
            <div className={`flex-shrink-0 p-1 rounded ${section.fileBg}`}>
                <Icon className={`size-3.5 ${section.fileColor}`} />
            </div>

            {/* File name */}
            <span className="flex-1 text-sm text-gray-700 truncate min-w-0" title={file.name}>
                {file.name}
            </span>

            {/* Type + Size (visible on wider screens) */}
            <span className="hidden sm:inline text-[10px] font-mono uppercase text-gray-400 px-1.5 py-0.5 rounded bg-gray-50">
                {ext}
            </span>
            <span className="hidden md:inline text-[11px] font-mono text-gray-400 w-16 text-right">
                {formatFileSize(file.size || 0)}
            </span>

            {/* Hover actions */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                <button
                    onClick={handleView}
                    className="px-2 py-0.5 text-[11px] font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                    View
                </button>
                <button
                    onClick={handleDelete}
                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    title="Delete"
                >
                    <Trash2 className="size-3" />
                </button>
            </div>
        </div>
    );
}

/* ─────────────────── TREE SUBFOLDER NODE ─────────────────── */
function TreeSubfolderNode({
    folder,
    clientId,
    folderPath,
    depth,
    section,
}: {
    folder: any;
    clientId: string;
    folderPath: string;
    depth: number;
    section: typeof SECTION_DEFS[number];
}) {
    const [expanded, setExpanded] = useState(false);
    const [showCreateFolder, setShowCreateFolder] = useState(false);

    return (
        <div>
            {/* Folder row */}
            <div
                className="group flex items-center gap-2 py-1.5 pr-3 cursor-pointer hover:bg-amber-50/50 transition-colors duration-100"
                style={{ paddingLeft: `${depth * 24 + 16}px` }}
                onClick={() => setExpanded(!expanded)}
            >
                {/* Chevron */}
                <div className="w-4 flex items-center justify-center flex-shrink-0">
                    {expanded ? (
                        <ChevronDown className="size-3.5 text-gray-500" />
                    ) : (
                        <ChevronRight className="size-3.5 text-gray-400" />
                    )}
                </div>

                {/* Folder icon */}
                <div className="flex-shrink-0 p-1 rounded bg-amber-50">
                    {expanded ? (
                        <FolderOpen className="size-3.5 text-amber-500" />
                    ) : (
                        <Folder className="size-3.5 text-amber-500" />
                    )}
                </div>

                {/* Folder name */}
                <span className="flex-1 text-sm font-medium text-gray-700 truncate">
                    {folder.name}
                </span>

                {/* Hover actions — includes Create Folder, Upload, Delete */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setExpanded(true);
                            setShowCreateFolder(true);
                        }}
                        className="px-2 py-0.5 text-[11px] font-medium text-amber-600 hover:bg-amber-50 rounded transition-colors"
                        title="Create subfolder"
                    >
                        <FolderPlus className="size-3 inline mr-0.5" />
                        Folder
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            useUIStore.getState().openDrawer("uploadDoc", {
                                clientId,
                                folderName: folderPath,
                                visibility: section.visibility,
                            });
                        }}
                        className="px-2 py-0.5 text-[11px] font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                        Upload
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (!confirm(`Delete folder "${folder.name}"?`)) return;
                            fetch("/api/documents/delete-folder", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ clientId, folderPath }),
                            }).then(() => {
                                mutate(
                                    (key: any) => Array.isArray(key) && key[0] === "tree" && key[1] === clientId,
                                    undefined,
                                    { revalidate: true }
                                );
                            });
                        }}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Delete folder"
                    >
                        <Trash2 className="size-3" />
                    </button>
                </div>
            </div>

            {/* Inline create folder inside subfolder */}
            {showCreateFolder && expanded && (
                <div style={{ paddingLeft: `${(depth + 1) * 24}px` }}>
                    <InlineCreateFolder
                        clientId={clientId}
                        parentFolder={folderPath}
                        section={section}
                        onDone={() => setShowCreateFolder(false)}
                    />
                </div>
            )}

            {/* Children (lazy loaded) */}
            {expanded && (
                <FolderContents
                    clientId={clientId}
                    folderPath={folderPath}
                    depth={depth + 1}
                    section={section}
                />
            )}
        </div>
    );
}

/* ─────────────────── FOLDER CONTENTS (recursive) ─────────────────── */
function FolderContents({
    clientId,
    folderPath,
    depth,
    section,
}: {
    clientId: string;
    folderPath: string;
    depth: number;
    section: typeof SECTION_DEFS[number];
}) {
    const { data, isLoading } = useSWR(
        ["tree", clientId, folderPath],
        () =>
            fetch(
                `/api/documents/list?clientId=${clientId}&folderPath=${encodeURIComponent(folderPath)}`
            ).then((r) => r.json()),
        { revalidateOnFocus: false }
    );

    const items = data?.items || [];
    const folders = items.filter((d: any) => d.type === "folder");
    const files = items.filter((d: any) => d.type === "file");

    if (isLoading) {
        return (
            <div
                className="flex items-center gap-2 py-2 text-gray-400"
                style={{ paddingLeft: `${depth * 24 + 40}px` }}
            >
                <Loader2 className="size-3 animate-spin" />
                <span className="text-xs">Loading...</span>
            </div>
        );
    }

    if (folders.length === 0 && files.length === 0) {
        return (
            <div
                className="py-2 text-xs text-gray-400 italic"
                style={{ paddingLeft: `${depth * 24 + 40}px` }}
            >
                Empty folder
            </div>
        );
    }

    return (
        <div>
            {folders.map((folder: any) => (
                <TreeSubfolderNode
                    key={folder.name}
                    folder={folder}
                    clientId={clientId}
                    folderPath={`${folderPath}/${folder.name}`}
                    depth={depth}
                    section={section}
                />
            ))}
            {files.map((file: any, idx: number) => (
                <TreeFileRow
                    key={file.path || file.name || idx}
                    file={file}
                    clientId={clientId}
                    depth={depth}
                    section={section}
                />
            ))}
        </div>
    );
}

/* ─────────────────── SECTION NODE (top-level) ─────────────────── */
function SectionNode({
    section,
    clientId,
    clientName,
    onOpenSection,
}: {
    section: typeof SECTION_DEFS[number];
    clientId: string;
    clientName?: string;
    onOpenSection: (sectionKey: string) => void;
}) {
    const { toast } = useToast();
    const [expanded, setExpanded] = useState(false);
    const [showCreateFolder, setShowCreateFolder] = useState(false);
    const SectionIcon = section.Icon;

    const { data } = useSWR(
        expanded ? ["tree", clientId, section.key] : null,
        () =>
            fetch(
                `/api/documents/list?clientId=${clientId}&folderPath=${encodeURIComponent(section.key)}`
            ).then((r) => r.json()),
        { revalidateOnFocus: false }
    );

    const itemCount = data?.items?.length || 0;

    return (
        <div
            className={`rounded-xl border ${section.border} overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200`}
        >
            {/* Section Header */}
            <div className="relative">
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${section.stripe} rounded-l-xl z-10`} />

                <div
                    className={`w-full flex items-center gap-3 pl-5 pr-4 py-3 transition-all duration-200 bg-gradient-to-r ${section.headerBg}`}
                >
                    {/* Chevron (clickable to expand/collapse) */}
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                        <ChevronDown
                            className={`size-4 ${section.text} transition-transform duration-200 flex-shrink-0 ${expanded ? "" : "-rotate-90"
                                }`}
                        />

                        <div className={`p-1.5 rounded-lg ${section.iconBg} flex-shrink-0`}>
                            <SectionIcon className={`size-4 ${section.iconColor}`} />
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <h3 className={`text-sm font-semibold ${section.text}`}>{section.label}</h3>
                                {expanded && (
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${section.badge}`}>
                                        {itemCount} {itemCount === 1 ? "item" : "items"}
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] text-gray-500 mt-0.5">{section.description}</p>
                        </div>
                    </button>

                    {/* Action buttons (always visible) */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                            onClick={() => onOpenSection(section.key)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium ${section.text} bg-white/80 hover:bg-white shadow-sm cursor-pointer transition-colors border border-transparent hover:border-gray-200`}
                            title={`Open ${section.label} section`}
                        >
                            <ExternalLink className="size-3" />
                            Open
                        </button>
                        <button
                            onClick={() => {
                                setExpanded(true);
                                setShowCreateFolder(true);
                            }}
                            className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium ${section.text} bg-white/80 hover:bg-white shadow-sm cursor-pointer transition-colors border border-transparent hover:border-gray-200`}
                        >
                            <FolderPlus className="size-3" />
                            Folder
                        </button>
                        <button
                            onClick={() => {
                                useUIStore.getState().openDrawer("uploadDoc", {
                                    clientId,
                                    clientName,
                                    folderName: section.key,
                                    visibility: section.visibility,
                                });
                            }}
                            className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium ${section.text} bg-white/80 hover:bg-white shadow-sm cursor-pointer transition-colors border border-transparent hover:border-gray-200`}
                        >
                            <Upload className="size-3" />
                            Upload
                        </button>
                    </div>
                </div>
            </div>

            {/* Section Content */}
            <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${expanded ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0"
                    }`}
            >
                {showCreateFolder && (
                    <InlineCreateFolder
                        clientId={clientId}
                        parentFolder={section.key}
                        section={section}
                        onDone={() => setShowCreateFolder(false)}
                    />
                )}

                {expanded && (
                    <div className="bg-white py-1">
                        <FolderContents
                            clientId={clientId}
                            folderPath={section.key}
                            depth={1}
                            section={section}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

/* ─────────────────── FOCUSED SECTION VIEW ─────────────────── */
function FocusedSectionView({
    section,
    clientId,
    clientName,
    onBack,
}: {
    section: typeof SECTION_DEFS[number];
    clientId: string;
    clientName?: string;
    onBack: () => void;
}) {
    const { toast } = useToast();
    const [showCreateFolder, setShowCreateFolder] = useState(false);
    const SectionIcon = section.Icon;

    return (
        <div className="space-y-3">
            {/* Back + Section Header */}
            <div className={`rounded-xl border ${section.border} overflow-hidden shadow-sm`}>
                <div className="relative">
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${section.stripe} rounded-l-xl z-10`} />

                    <div className={`flex items-center gap-3 pl-5 pr-4 py-3 bg-gradient-to-r ${section.headerBg}`}>
                        {/* Back button */}
                        <button
                            onClick={onBack}
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium text-gray-600 bg-white/80 hover:bg-white shadow-sm transition-colors border border-transparent hover:border-gray-200"
                        >
                            <ArrowLeft className="size-3.5" />
                            Back
                        </button>

                        <div className={`p-1.5 rounded-lg ${section.iconBg} flex-shrink-0`}>
                            <SectionIcon className={`size-4 ${section.iconColor}`} />
                        </div>

                        <div className="flex-1 min-w-0">
                            <h3 className={`text-sm font-semibold ${section.text}`}>{section.label}</h3>
                            <p className="text-[11px] text-gray-500 mt-0.5">{section.description}</p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                                onClick={() => setShowCreateFolder(true)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium ${section.text} bg-white/80 hover:bg-white shadow-sm cursor-pointer transition-colors border border-transparent hover:border-gray-200`}
                            >
                                <FolderPlus className="size-3" />
                                New Folder
                            </button>
                            <button
                                onClick={() => {
                                    useUIStore.getState().openDrawer("uploadDoc", {
                                        clientId,
                                        clientName,
                                        folderName: section.key,
                                        visibility: section.visibility,
                                    });
                                }}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium ${section.text} bg-white/80 hover:bg-white shadow-sm cursor-pointer transition-colors border border-transparent hover:border-gray-200`}
                            >
                                <Upload className="size-3" />
                                Upload Document
                            </button>
                        </div>
                    </div>
                </div>

                {/* Inline create folder */}
                {showCreateFolder && (
                    <InlineCreateFolder
                        clientId={clientId}
                        parentFolder={section.key}
                        section={section}
                        onDone={() => setShowCreateFolder(false)}
                    />
                )}

                {/* Full section content */}
                <div className="bg-white py-1">
                    <FolderContents
                        clientId={clientId}
                        folderPath={section.key}
                        depth={1}
                        section={section}
                    />
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════ */
/*                 DOCUMENT TREE EXPLORER (MAIN)                  */
/* ═══════════════════════════════════════════════════════════════ */
export function DocumentTreeExplorer({
    clientId,
    clientName,
}: {
    clientId: string;
    clientName?: string;
}) {
    const [sectionsReady, setSectionsReady] = useState(false);
    const [focusedSection, setFocusedSection] = useState<string | null>(null);

    // Auto-create the 3 section folders on mount
    useEffect(() => {
        if (!clientId) return;

        fetch("/api/documents/ensure-sections", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientId }),
        })
            .then((r) => r.json())
            .then((data) => {
                if (data.success) setSectionsReady(true);
            })
            .catch(() => setSectionsReady(true));
    }, [clientId]);

    // Listen for upload events and revalidate
    useEffect(() => {
        const handler = () => {
            mutate(
                (key: any) => Array.isArray(key) && key[0] === "tree" && key[1] === clientId,
                undefined,
                { revalidate: true }
            );
        };

        window.addEventListener("clienthub:docs-updated", handler as EventListener);
        return () => window.removeEventListener("clienthub:docs-updated", handler as EventListener);
    }, [clientId]);

    if (!sectionsReady) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="size-5 animate-spin text-gray-400 mr-2" />
                <span className="text-sm text-gray-500">Preparing document sections...</span>
            </div>
        );
    }

    // If a section is focused, show only that section
    if (focusedSection) {
        const section = SECTION_DEFS.find((s) => s.key === focusedSection);
        if (section) {
            return (
                <FocusedSectionView
                    section={section}
                    clientId={clientId}
                    clientName={clientName}
                    onBack={() => setFocusedSection(null)}
                />
            );
        }
    }

    return (
        <div className="space-y-3">
            {SECTION_DEFS.map((section) => (
                <SectionNode
                    key={section.key}
                    section={section}
                    clientId={clientId}
                    clientName={clientName}
                    onOpenSection={(key) => setFocusedSection(key)}
                />
            ))}
        </div>
    );
}
