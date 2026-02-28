// components/widgets/client-documents-viewer.tsx
"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Folder,
    File,
    ChevronRight,
    ChevronDown,
    FileText,
    FileSpreadsheet,
    Image as ImageIcon,
    ArrowLeft,
    Download,
    FolderOpen,
    ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
    clientId: string;
    clientName?: string;
    /** Base folder to show (e.g., "Assigned Task Completion Documents") */
    baseFolderPath?: string;
    /** Whether to show folder navigation breadcrumb */
    showBreadcrumb?: boolean;
    /** Height of the component */
    height?: string;
};

type DocumentItem = {
    name: string;
    type: "folder" | "file";
    folderPath?: string;
    size?: number;
    lastModified?: string;
    url?: string;
    fileType?: string;
};

const FILE_TYPE_ICONS: Record<string, any> = {
    PDF: FileText,
    XLSX: FileSpreadsheet,
    XLS: FileSpreadsheet,
    DOCX: FileText,
    DOC: FileText,
    IMG: ImageIcon,
    PNG: ImageIcon,
    JPG: ImageIcon,
    JPEG: ImageIcon,
    DEFAULT: File,
};

export function ClientDocumentsViewer({
    clientId,
    clientName,
    baseFolderPath = "",
    showBreadcrumb = true,
    height = "400px",
}: Props) {
    const [currentPath, setCurrentPath] = useState(baseFolderPath);

    // Fetch documents for current path
    const { data: documentsData, isLoading } = useSWR(
        clientId ? [`client-documents-${clientId}`, currentPath] : null,
        async () => {
            // Use the same API as admin documents page which supports folder navigation
            const params = new URLSearchParams({ id: clientId });
            if (currentPath) {
                params.append("folder", currentPath);
            }
            const res = await fetch(`/api/documents/get-by-client?${params}`);
            const json = await res.json();
            return json.data || [];
        },
        { revalidateOnFocus: false }
    );

    const documents: DocumentItem[] = documentsData || [];

    // Separate folders and files
    const folders = documents.filter((d) => d.type === "folder");
    const files = documents.filter((d) => d.type === "file");

    // Navigate into folder
    const openFolder = (folderName: string) => {
        const newPath = currentPath ? `${currentPath}/${folderName}` : folderName;
        setCurrentPath(newPath);
    };

    // Navigate back - but not above baseFolderPath
    const goBack = () => {
        if (currentPath === baseFolderPath || !currentPath) return;
        const parts = currentPath.split("/");
        parts.pop();
        const newPath = parts.join("/");
        // Don't go above baseFolderPath
        if (baseFolderPath && !newPath.startsWith(baseFolderPath) && newPath !== baseFolderPath) {
            setCurrentPath(baseFolderPath);
        } else {
            setCurrentPath(newPath || baseFolderPath);
        }
    };

    // Check if we can go back (only if we're deeper than baseFolderPath)
    const canGoBack = currentPath && currentPath !== baseFolderPath &&
        (baseFolderPath ? currentPath.length > baseFolderPath.length : currentPath.includes("/"));

    // Get breadcrumb parts - only show parts after baseFolderPath
    const getBreadcrumbParts = () => {
        if (!currentPath) return [];
        if (!baseFolderPath) return currentPath.split("/");

        // Remove baseFolderPath prefix and get remaining parts
        const relativePath = currentPath.replace(baseFolderPath, "").replace(/^\//, "");
        return relativePath ? relativePath.split("/") : [];
    };
    const breadcrumbParts = getBreadcrumbParts();

    // Get file icon based on type
    const getFileIcon = (fileName: string) => {
        const ext = fileName.split(".").pop()?.toUpperCase() || "";
        const IconComponent = FILE_TYPE_ICONS[ext] || FILE_TYPE_ICONS.DEFAULT;
        return <IconComponent className="h-5 w-5" />;
    };

    // Format file size
    const formatSize = (bytes?: number) => {
        if (!bytes) return "-";
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                        <FolderOpen className="h-4 w-4" />
                        Documents {clientName && `- ${clientName}`}
                    </CardTitle>
                </div>

                {/* Breadcrumb Navigation - only show if we're deeper than baseFolderPath */}
                {showBreadcrumb && breadcrumbParts.length > 0 && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2 flex-wrap">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => setCurrentPath(baseFolderPath)}
                        >
                            {baseFolderPath ? baseFolderPath.split("/").pop() : "Root"}
                        </Button>
                        {breadcrumbParts.map((part, index) => (
                            <div key={index} className="flex items-center gap-1">
                                <ChevronRight className="h-3 w-3" />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        "h-6 px-2",
                                        index === breadcrumbParts.length - 1 && "font-medium text-foreground"
                                    )}
                                    onClick={() => {
                                        const pathParts = breadcrumbParts.slice(0, index + 1);
                                        const newPath = baseFolderPath
                                            ? `${baseFolderPath}/${pathParts.join("/")}`
                                            : pathParts.join("/");
                                        setCurrentPath(newPath);
                                    }}
                                >
                                    {part}
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </CardHeader>

            <CardContent>
                <div
                    className="border rounded-lg overflow-hidden"
                    style={{ height, overflowY: "auto" }}
                >
                    {isLoading ? (
                        <div className="flex items-center justify-center py-10">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                            <span className="ml-2 text-muted-foreground">
                                Loading documents...
                            </span>
                        </div>
                    ) : documents.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">
                            <Folder className="h-10 w-10 mx-auto mb-3 opacity-50" />
                            <p className="font-medium">No documents found</p>
                            <p className="text-sm mt-1">
                                {currentPath === baseFolderPath
                                    ? "Documents will appear here once tasks are completed with document uploads."
                                    : "This folder is empty."
                                }
                            </p>
                            {canGoBack && (
                                <Button
                                    variant="link"
                                    size="sm"
                                    onClick={goBack}
                                    className="mt-2"
                                >
                                    <ArrowLeft className="h-3 w-3 mr-1" />
                                    Go back
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="divide-y">
                            {/* Back button when in subfolder deeper than baseFolderPath */}
                            {canGoBack && (
                                <button
                                    onClick={goBack}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                                >
                                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                                        <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <span className="text-sm text-muted-foreground">..</span>
                                </button>
                            )}

                            {/* Folders */}
                            {folders.map((folder) => (
                                <button
                                    key={folder.name}
                                    onClick={() => openFolder(folder.name)}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left group"
                                >
                                    <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center">
                                        <Folder className="h-4 w-4 text-amber-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate" title={folder.name}>{folder.name}</p>
                                        <p className="text-xs text-muted-foreground">Folder</p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            ))}

                            {/* Files */}
                            {files.map((file) => (
                                <div
                                    key={file.name}
                                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                                >
                                    <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                                        {getFileIcon(file.name)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate">{file.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {formatSize(file.size)}
                                            {file.lastModified &&
                                                ` • ${new Date(file.lastModified).toLocaleDateString()}`}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {file.url && (
                                            <>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 w-7 p-0"
                                                    title="Open in new tab"
                                                    onClick={() => window.open(file.url, "_blank")}
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 w-7 p-0"
                                                    title="Download"
                                                    onClick={() => {
                                                        const a = document.createElement("a");
                                                        a.href = file.url!;
                                                        a.download = file.name;
                                                        a.click();
                                                    }}
                                                >
                                                    <Download className="h-4 w-4" />
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
