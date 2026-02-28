// components/widgets/upload-doc-form.tsx
"use client";

import type React from "react";
import { useState, useRef } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useUIStore } from "@/store/ui-store";
import { Upload, File, X, Lock, Eye } from "lucide-react";

const Schema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(2),
  type: z.enum(["PDF", "XLSX", "DOCX", "IMG", "OTHER"]),
});

export function UploadDocForm({ context }: { context?: Record<string, any> }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderName = context?.folderName || null;

  const { toast } = useToast();
  const closeDrawer = useUIStore((s) => s.closeDrawer);
  const role = useUIStore((s) => s.role);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<{ file: File; folderPath: string | null }[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploadResults, setUploadResults] = useState<{ name: string; success: boolean; error?: string }[]>([]);
  const [uploadMode, setUploadMode] = useState<"files" | "folder">("files");
  const [visibility, setVisibility] = useState<"shared" | "private">(
    context?.visibility === "private" ? "private" : "shared"
  );

  // ✅ Duplicate popup control using a Promise resolver
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [dupDisplayName, setDupDisplayName] = useState("");

  // We only allow two actions from the popup:
  // - "replace" (overwrite existing)
  // - "cancel"  (do nothing, do not treat as failure)
  const [dupResolver, setDupResolver] = useState<null | ((action: "replace" | "cancel") => void)>(null);

  function askDuplicate(displayName: string) {
    setDupDisplayName(displayName);
    setDuplicateOpen(true);

    return new Promise<"replace" | "cancel">((resolve) => {
      setDupResolver(() => resolve);
    });
  }

  const form = useForm<z.infer<typeof Schema>>({
    resolver: zodResolver(Schema),
    defaultValues: {
      clientId: context?.clientId || "",
      name: "",
      type: "PDF",
    },
  });

  /* ------------------------------
        FILE SELECTION HANDLERS
  ------------------------------*/
  function handleFilesSelect(files: FileList | null, fromFolderInput: boolean = false) {
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files).map((file) => {
      // Extract folder path from webkitRelativePath
      // webkitRelativePath format: "SelectedFolder/SubFolder/file.pdf"
      // We skip the first part (the selected folder name) and keep only subfolders
      let extractedFolderPath: string | null = null;

      if (fromFolderInput && (file as any).webkitRelativePath) {
        const relativePath = (file as any).webkitRelativePath as string;
        const pathParts = relativePath.split("/");
        // pathParts = ["SelectedFolder", "SubFolder", "file.pdf"]
        // Skip first element (selected folder) and last element (filename)
        // Keep only middle parts (subfolders)
        if (pathParts.length > 2) {
          // Has subfolders: keep them
          extractedFolderPath = pathParts.slice(1, -1).join("/");
        }
        // If pathParts.length === 2, file is directly in root folder, no subfolder needed
      }

      return {
        file,
        folderPath: extractedFolderPath,
      };
    });

    setSelectedFiles(prev => [...prev, ...newFiles]);

    // Auto-detect type from first file for the form
    if (newFiles.length === 1) {
      type FileType = "PDF" | "XLSX" | "DOCX" | "IMG" | "OTHER";
      const ext = newFiles[0].file.name.split(".").pop()?.toLowerCase() || "";
      const typeMap: Record<string, FileType> = {
        pdf: "PDF",
        xlsx: "XLSX",
        xls: "XLSX",
        docx: "DOCX",
        doc: "DOCX",
        jpg: "IMG",
        jpeg: "IMG",
        png: "IMG",
        gif: "IMG",
        bmp: "IMG",
        webp: "IMG",
        svg: "IMG",
      };
      const detected: FileType = typeMap[ext] || "OTHER";
      form.setValue("name", newFiles[0].file.name);
      form.setValue("type", detected);
    } else {
      form.setValue("name", `${newFiles.length} files selected`);
    }
  }

  function removeFile(index: number) {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    handleFilesSelect(e.target.files, false);
    e.target.value = "";
  }

  function handleFolderInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    handleFilesSelect(e.target.files, true);
    e.target.value = "";
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }

  // Helper function to recursively read folder entries
  async function readEntriesRecursively(
    entry: FileSystemEntry,
    path: string = ""
  ): Promise<{ file: File; folderPath: string | null }[]> {
    const results: { file: File; folderPath: string | null }[] = [];

    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      const file = await new Promise<File>((resolve, reject) => {
        fileEntry.file(resolve, reject);
      });
      results.push({
        file,
        folderPath: path || null,
      });
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry;
      const reader = dirEntry.createReader();
      const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
        reader.readEntries(resolve, reject);
      });

      for (const childEntry of entries) {
        const childPath = path ? `${path}/${childEntry.name}` : "";
        const childResults = await readEntriesRecursively(
          childEntry,
          childEntry.isDirectory ? (path ? `${path}/${childEntry.name}` : childEntry.name) : path
        );
        results.push(...childResults);
      }
    }

    return results;
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const items = e.dataTransfer.items;
    const filesWithPaths: { file: File; folderPath: string | null }[] = [];

    // Check if we can use webkitGetAsEntry (for folder support)
    if (items && items.length > 0 && typeof items[0].webkitGetAsEntry === 'function') {
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry();
        if (entry) {
          try {
            const results = await readEntriesRecursively(entry, "");
            filesWithPaths.push(...results);
          } catch (err) {
            console.error("Error reading dropped item:", err);
          }
        }
      }

      if (filesWithPaths.length > 0) {
        setSelectedFiles(prev => [...prev, ...filesWithPaths]);
        form.setValue("name", `${filesWithPaths.length} files selected`);
        return;
      }
    }

    // Fallback: regular file handling (no folder support)
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const newFiles = Array.from(files).map(file => ({
        file,
        folderPath: null,
      }));
      setSelectedFiles(prev => [...prev, ...newFiles]);
      form.setValue("name", `${files.length} files selected`);
    }
  }

  async function uploadSingle(formData: FormData) {
    const res = await fetch("/api/documents/upload", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    // Duplicate case
    if (res.status === 409 && data?.duplicate) {
      return { type: "DUPLICATE" as const, data };
    }

    return { type: "DONE" as const, data };
  }

  /* --------------------------------
        FINAL SUBMIT → CALL API
  --------------------------------*/
  async function onSubmit(values: z.infer<typeof Schema>) {
    if (selectedFiles.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one file",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadResults([]);

    const results: { name: string; success: boolean; error?: string }[] = [];
    const totalFiles = selectedFiles.length;

    for (let i = 0; i < selectedFiles.length; i++) {
      const { file, folderPath: fileFolderPath } = selectedFiles[i];
      setUploadProgress(Math.round(((i) / totalFiles) * 100));

      // Detect file type for each file
      type FileType = "PDF" | "XLSX" | "DOCX" | "IMG" | "OTHER";
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const typeMap: Record<string, FileType> = {
        pdf: "PDF",
        xlsx: "XLSX",
        xls: "XLSX",
        docx: "DOCX",
        doc: "DOCX",
        jpg: "IMG",
        jpeg: "IMG",
        png: "IMG",
        gif: "IMG",
        bmp: "IMG",
        webp: "IMG",
        svg: "IMG",
      };
      const fileType: FileType = typeMap[ext] || "OTHER";

      // Combine context folderName with file's folder path (for folder uploads)
      let uploadFolderPath: string | null = folderName;
      if (fileFolderPath) {
        uploadFolderPath = folderName
          ? `${folderName}/${fileFolderPath}`
          : fileFolderPath;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("clientId", values.clientId);
      formData.append("fileType", fileType);
      if (role) formData.append("role", role);
      if (uploadFolderPath) {
        formData.append("folderName", uploadFolderPath);
      }
      formData.append("visibility", visibility);

      // ✅ NEW: handle duplicate using backend 409 + centered popup
      formData.append("duplicateAction", "ask");

      const displayName = fileFolderPath ? `${fileFolderPath}/${file.name}` : file.name;



      try {
        // 1) First attempt: ask
        const uploadResult = await uploadSingle(formData);

        // 2) If duplicate → ask user via popup, then retry (replace) or cancel
        if (uploadResult.type === "DUPLICATE") {
          const decision = await askDuplicate(displayName);

          // ✅ Cancel means: do nothing, do NOT mark as failed
          if (decision === "cancel") {
            results.push({
              name: displayName,
              success: false,
              error: "Cancelled",
            });
            continue;
          }

          // decision === "replace" → retry with duplicateAction=replace
          const retryFormData = new FormData();
          retryFormData.append("file", file);
          retryFormData.append("clientId", values.clientId);
          retryFormData.append("fileType", fileType);
          if (role) retryFormData.append("role", role);
          if (uploadFolderPath) retryFormData.append("folderName", uploadFolderPath);
          retryFormData.append("visibility", visibility);
          retryFormData.append("duplicateAction", "replace");

          const retryResult = await uploadSingle(retryFormData);

          if (!retryResult.data?.success) {
            results.push({
              name: displayName,
              success: false,
              error: retryResult.data?.error || "Replace failed",
            });
          } else {
            results.push({ name: displayName, success: true });

            // ✅ Force list refresh wherever the docs list is displayed
            window.dispatchEvent(
              new CustomEvent("clienthub:docs-updated", {
                detail: {
                  clientId: values.clientId,
                  folderName: uploadFolderPath ?? null,
                },
              })
            );
          }

          continue;
        }

        // 3) Normal success/fail
        if (!uploadResult.data?.success) {
          results.push({
            name: displayName,
            success: false,
            error: uploadResult.data?.error || "Upload failed",
          });
        } else {
          results.push({ name: displayName, success: true });

          window.dispatchEvent(
            new CustomEvent("clienthub:docs-updated", {
              detail: {
                clientId: values.clientId,
                folderName: uploadFolderPath ?? null,
              },
            })
          );
        }
      } catch (error: any) {
        results.push({
          name: displayName,
          success: false,
          error: error?.message || "Upload failed",
        });
      }
    }

    setUploadProgress(100);
    setUploadResults(results);

    const successCount = results.filter((r) => r.success).length;

    // ✅ Cancelled should NOT be treated as a failed upload
    const cancelledCount = results.filter((r) => !r.success && r.error === "Cancelled").length;

    // ✅ Only real failures count as failures
    const failCount = results.filter((r) => !r.success && r.error !== "Cancelled").length;

    if (failCount === 0 && successCount > 0) {
      toast({
        title: "Success",
        description:
          cancelledCount > 0
            ? `${successCount} file(s) uploaded. ${cancelledCount} cancelled.`
            : `${successCount} file(s) uploaded successfully.`,
      });
      setSelectedFiles([]);
      form.reset();
      closeDrawer();
    } else if (successCount === 0 && failCount > 0) {
      toast({
        title: "Error",
        description: `All ${failCount} file(s) failed to upload.`,
        variant: "destructive",
      });
    } else if (successCount === 0 && cancelledCount > 0 && failCount === 0) {
      toast({
        title: "Cancelled",
        description: `${cancelledCount} file(s) cancelled.`,
      });
    } else {
      toast({
        title: "Partial Success",
        description:
          cancelledCount > 0
            ? `${successCount} uploaded, ${failCount} failed, ${cancelledCount} cancelled.`
            : `${successCount} uploaded, ${failCount} failed.`,
        variant: "destructive",
      });
    }
    setUploading(false);
  }

  /* --------------------------------
                UI
  --------------------------------*/
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
      {/* Client ID */}
      {/* <div className="grid gap-2">
        <Label htmlFor="clientId">Client ID</Label>
        <Input {...form.register("clientId")} placeholder="2" />
      </div> */}
      {/* Client Name Header */}
      <div className="text-lg font-semibold mb-2">
        {context?.clientName || "Client"}
      </div>

      {/* Upload Box */}
      <div className="grid gap-3">
        <div className="space-y-3">
          {/* Title + helper text */}
          <div>
            <Label className="text-base">Upload</Label>
            <p className="text-xs text-muted-foreground">
              Multiple files supported
            </p>
          </div>

          {/* Mode Switch (full width, new line) */}
          <div className="w-full inline-flex rounded-lg border bg-background p-1">
            <button
              type="button"
              onClick={() => setUploadMode("files")}
              className={`flex-1 px-3 py-2 text-sm rounded-md transition ${uploadMode === "files"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Upload Files
            </button>
            <button
              type="button"
              onClick={() => setUploadMode("folder")}
              className={`flex-1 px-3 py-2 text-sm rounded-md transition ${uploadMode === "folder"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Upload Folder
            </button>
          </div>
        </div>

        {/* FILES MODE */}
        {uploadMode === "files" && (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer ${dragActive ? "border-primary bg-primary/5" : "border-border"
              }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileInputChange}
              className="hidden"
              accept="*"
            />

            <div className="flex flex-col items-center gap-2">
              <Upload className="size-6 text-muted-foreground" />
              <div className="text-sm">
                <span className="font-medium">Click to upload</span> or drag and drop
              </div>
              <div className="text-xs text-muted-foreground">
                PDFs, Word, Excel, Images
              </div>
            </div>
          </div>
        )}

        {/* FOLDER MODE */}
        {uploadMode === "folder" && (
          <div className="rounded-lg border p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-muted-foreground">📁</div>
              <div className="flex-1">
                <div className="text-sm font-medium">Upload an entire folder</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Keeps subfolders structure (useful when you have many files organized in folders).
                </div>

                <label
                  htmlFor="folder-upload"
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted cursor-pointer"
                >
                  Select Folder
                </label>

                <input
                  id="folder-upload"
                  type="file"
                  // @ts-ignore
                  webkitdirectory=""
                  // @ts-ignore
                  directory=""
                  multiple
                  onChange={handleFolderInputChange}
                  className="hidden"
                />
              </div>
            </div>
          </div>
        )}
      </div>


      {/* Preview */}
      {selectedFiles.length > 0 && (
        <div className="grid gap-2 max-h-48 overflow-y-auto">
          <Label>Selected Files ({selectedFiles.length})</Label>
          {selectedFiles.map(({ file, folderPath }, index) => (
            <div key={index} className="flex items-center gap-2 rounded-md bg-muted p-2">
              <File className="size-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 text-sm min-w-0">
                <div className="font-medium truncate">
                  {folderPath ? `${folderPath}/${file.name}` : file.name}
                </div>
                <div className="text-xs text-muted-foreground flex gap-2">
                  <span>{(file.size / 1024).toFixed(1)} KB</span>
                  {folderPath && (
                    <span className="text-primary">📁 from folder</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="p-1 hover:bg-destructive/10 rounded-md text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Visibility Toggle - Only show for ADMIN role */}
      {role === "ADMIN" && selectedFiles.length > 0 && (
        <div className="grid gap-2 p-4 border rounded-lg bg-muted/30">
          <Label className="text-sm font-semibold">Document Visibility</Label>
          <p className="text-xs text-muted-foreground mb-2">
            Choose who can see these documents
          </p>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setVisibility("shared")}
              className={`flex items-center gap-2 p-3 rounded-md border-2 transition-all ${visibility === "shared"
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-border bg-background hover:border-blue-300"
                }`}
            >
              <Eye className="size-4 flex-shrink-0" />
              <div className="text-left flex-1">
                <div className="text-sm font-medium">Shared</div>
                <div className="text-xs opacity-80">Visible to you and client</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setVisibility("private")}
              className={`flex items-center gap-2 p-3 rounded-md border-2 transition-all ${visibility === "private"
                ? "border-purple-500 bg-purple-50 text-purple-700"
                : "border-border bg-background hover:border-purple-300"
                }`}
            >
              <Lock className="size-4 flex-shrink-0" />
              <div className="text-left flex-1">
                <div className="text-sm font-medium">Private</div>
                <div className="text-xs opacity-80">Only visible to you</div>
              </div>
            </button>
          </div>
        </div>
      )}



      {/* Upload Progress */}
      {uploading && (
        <div className="grid gap-1">
          <div className="text-xs text-muted-foreground">
            Uploading... {Math.round(uploadProgress)}%
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="outline" type="button" onClick={closeDrawer}>
          Cancel
        </Button>
        <Button type="submit" disabled={uploading || selectedFiles.length === 0}>
          {uploading ? "Uploading..." : "Upload"}
        </Button>
      </div>
      {/* ✅ Step D: Duplicate popup (centered) */}
      {/* ✅ Duplicate popup (centered) */}
      <Dialog
        open={duplicateOpen}
        onOpenChange={(open) => {
          setDuplicateOpen(open);

          // If user closes via X / outside click → treat as Cancel
          if (!open) {
            dupResolver?.("cancel");
            setDupResolver(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-amber-600">⚠️</span> File already exists
            </DialogTitle>
            <DialogDescription className="pt-2">
              <span className="font-medium">{dupDisplayName}</span> already exists in this folder.
              <br />
              Do you want to replace it?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setDuplicateOpen(false);
                dupResolver?.("cancel");
                setDupResolver(null);
              }}
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={() => {
                setDuplicateOpen(false);
                dupResolver?.("replace");
                setDupResolver(null);
              }}
            >
              Replace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
