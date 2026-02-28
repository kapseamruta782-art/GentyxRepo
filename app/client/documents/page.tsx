// app/client/documents/page.tsx
"use client";

import { useEffect, useState } from "react";
import useSWR, { mutate } from "swr";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/data-table";
import { useUIStore } from "@/store/ui-store";
import { useToast } from "@/hooks/use-toast";
import {
  Folder,
  FileText,
  FileImage,
  FileSpreadsheet,
  File as FileIcon,
  Trash2,
  Upload,
  CheckCircle2,
  Layers,
  Lock,
  Eye,
} from "lucide-react";

// Special folder names for task completion documents
const ASSIGNED_TASK_FOLDER = "Assigned Task Completion Documents";
const ONBOARDING_FOLDER = "Onboarding Stage Completion Documents";

function getPreviewUrl(fileUrl: string, fileName?: string) {
  if (!fileUrl) return "";

  const name = (fileName || "").toLowerCase();

  // Direct preview types
  const isPdf = name.endsWith(".pdf");
  const isImage = /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(name);

  // ✅ Office viewer formats (CSV REMOVED on purpose)
  const isOffice = /\.(doc|docx|ppt|pptx|xls|xlsx)$/i.test(name);

  // ✅ CSV should open directly (browser download/open), not Office viewer
  const isCsv = name.endsWith(".csv");

  if (isPdf || isImage) return fileUrl;

  if (isOffice) {
    return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(
      fileUrl
    )}`;
  }

  if (isCsv) {
    return fileUrl;
  }

  // Fallback
  return fileUrl;
}

export default function ClientDocuments() {
  const role = useUIStore((s) => s.role);
  const currentClientId = useUIStore((s) => s.currentClientId);
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const [clientId, setClientId] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Wait for client context from login
  useEffect(() => {
    if (role === "CLIENT" && currentClientId) {
      setClientId(currentClientId);
    }
  }, [role, currentClientId]);

  // Check for folder path in URL query parameter
  useEffect(() => {
    const folderPath = searchParams.get("folder");
    if (folderPath) {
      setSelectedFolder(decodeURIComponent(folderPath));
    }
  }, [searchParams]);

  // Fetch documents using the same API as admin
  const { data: docsResponse, isLoading } = useSWR(
    clientId ? ["docs", clientId, selectedFolder] : null,
    () =>
      selectedFolder
        ? fetch(`/api/documents/get-by-client?id=${clientId}&folder=${encodeURIComponent(selectedFolder)}&role=CLIENT`).then((r) => r.json())
        : fetch(`/api/documents/get-by-client?id=${clientId}&role=CLIENT`).then((r) => r.json()),
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    const refreshDocs = () => {
      mutate(["docs", clientId, null]);                // root
      mutate(["docs", clientId, selectedFolder]);      // current folder
    };

    window.addEventListener("clienthub:docs-updated", refreshDocs);
    return () => window.removeEventListener("clienthub:docs-updated", refreshDocs);
  }, [clientId, selectedFolder]);

  const docs = docsResponse?.data || [];

  // Document columns with icons
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
            <div
              className={`p-1.5 rounded-md ${isFolder ? "bg-amber-50 text-amber-500" : "bg-blue-50 text-blue-500"
                }`}
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
            {row.name?.split(".").pop() || "FILE"}
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
                onClick={() => window.open(getPreviewUrl(row.url, row.name), "_blank")}
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
                  const localPath = selectedFolder ? `${selectedFolder}/${row.name}` : row.name;
                  // Resolve to the actual blob path using the section returned by API
                  const section = row._section || "Client Uploaded";
                  const fullPath = `${section}/${localPath}`;
                  if (!confirm(`Delete folder "${row.name}"?`)) return;

                  fetch("/api/documents/delete-folder", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ clientId, folderPath: fullPath }),
                  }).then(() => mutate(["docs", clientId, selectedFolder]));
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

    const res = await fetch("/api/documents/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: clientId,
        fullPath: doc.fullPath,
      }),
    });

    const json = await res.json();

    if (!json.success) {
      toast({ title: "Failed to delete document", variant: "destructive" });
      return;
    }

    mutate(["docs", clientId, null]);
    mutate(["docs", clientId, selectedFolder]);
    toast({ title: "Document deleted successfully" });
  }

  if (!clientId) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
          <div className="flex items-center gap-2">
            <div className="bg-amber-100 p-2 rounded-lg">
              <Folder className="size-5 text-amber-600" />
            </div>
            <div>
              <CardTitle>My Documents</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Manage your onboarding files and folders
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* CREATE FOLDER BUTTON */}
            <Button variant="outline" size="sm" onClick={() => setShowCreateFolder(true)}>
              ➕ Create Folder
            </Button>

            {/* UPLOAD DOCUMENT BUTTON */}
            <Button
              size="sm"
              onClick={() => {
                // Auto-route to "Client Uploaded" section in blob storage
                const uploadFolder = selectedFolder
                  ? `Client Uploaded/${selectedFolder}`
                  : "Client Uploaded";
                useUIStore.getState().openDrawer("uploadDoc", {
                  clientId: clientId,
                  folderName: uploadFolder,
                });
              }}
            >
              <span className="flex items-center gap-2">
                <Upload className="size-4" /> Upload Document
              </span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {/* CREATE FOLDER MODAL */}
          {showCreateFolder && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-in fade-in duration-200">
              <div className="bg-white p-6 rounded-xl shadow-xl w-[350px] space-y-4 border">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Folder className="size-5 text-amber-500" /> New Folder
                  </h2>
                </div>

                <Input
                  placeholder="Folder name..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="border-gray-200 focus:border-amber-500 focus:ring-amber-500"
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
                    onClick={async () => {
                      if (!newFolderName.trim()) return;

                      // Auto-route to "Client Uploaded" section
                      const parentPath = selectedFolder
                        ? `Client Uploaded/${selectedFolder}`
                        : "Client Uploaded";

                      const res = await fetch("/api/documents/create-folder", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          clientId: clientId,
                          folderName: newFolderName,
                          parentFolder: parentPath,
                          role: role,
                        }),
                      });

                      const data = await res.json();

                      if (data.success) {
                        toast({ title: "Folder created successfully" });
                        mutate(["docs", clientId, selectedFolder]);
                        setShowCreateFolder(false);
                        setNewFolderName("");
                      } else {
                        toast({
                          title: "Folder creation failed",
                          description: data.error || "Unable to create folder",
                          variant: "destructive",
                        });
                      }
                    }}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    Create
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* FOLDER NAVIGATION / BREADCRUMB UI */}
          {selectedFolder && (
            <div className="mb-6 flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="pl-0 hover:bg-transparent hover:text-primary"
                onClick={() => setSelectedFolder(null)}
              >
                ← All Documents
              </Button>
              <span className="text-muted-foreground">/</span>
              <span className="font-semibold text-gray-800 flex items-center gap-2">
                <Folder className="size-4 text-amber-500" />
                {selectedFolder.split("/").pop()}
              </span>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Loading documents...</div>
            </div>
          ) : (
            <>
              {/* FOLDERS GRID */}
              {/* FILES TABLE */}
              {/* FILES TABLE (folders + files like Admin) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                    Files ({docs.length})
                  </h3>
                </div>

                {docs.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed rounded-xl bg-gray-50/50">
                    <div className="flex flex-col items-center gap-2">
                      <FileIcon className="size-8 text-gray-300" />
                      <p className="text-gray-500 font-medium">No files or folders</p>
                      <p className="text-sm text-gray-400">Upload a document or create a folder to get started</p>

                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowCreateFolder(true)}
                        >
                          ➕ Create Folder
                        </Button>

                        <Button
                          size="sm"
                          onClick={() => {
                            const uploadFolder = selectedFolder
                              ? `Client Uploaded/${selectedFolder}`
                              : "Client Uploaded";
                            useUIStore.getState().openDrawer("uploadDoc", {
                              clientId: clientId,
                              folderName: uploadFolder,
                            });
                          }}
                        >
                          <Upload className="mr-2 size-4" />
                          Upload Document
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden shadow-sm">
                    <DataTable columns={docCols} rows={docs} />
                  </div>
                )}
              </div>

            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
