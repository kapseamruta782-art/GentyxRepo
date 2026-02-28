"use client"

import * as React from "react"
import useSWR, { mutate } from "swr"
import { fetchEmailTemplates, createEmailTemplate, updateEmailTemplate, deleteEmailTemplate } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import {
  Plus, Edit2, Trash2, Upload, Search, Mail,
  FileCode, Check, Copy, ChevronRight, LayoutTemplate
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
// import { ScrollArea } from "@/components/ui/scroll-area" // Assuming this exists, if not I'll use div with overflow

export default function EmailTemplatesPage() {
  const { data } = useSWR(["templates"], () => fetchEmailTemplates())
  const [templates, setTemplates] = React.useState<any[]>([])
  const [selected, setSelected] = React.useState<string | null>(null)

  // Dialog States
  const [open, setOpen] = React.useState(false)
  const [uploadOpen, setUploadOpen] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null)

  // Form State
  const [formData, setFormData] = React.useState({ name: "", subject: "", body: "" })

  // Search State
  const [searchTerm, setSearchTerm] = React.useState("")

  const { toast } = useToast()

  // Sync data to local state
  React.useEffect(() => {
    if (data) {
      setTemplates(data);
      // Ensure selected template updates too if it was modified
      if (selected) {
        const updated = data.find((t: any) => t.id === selected);
        if (updated) setSelected(updated.id);
      }
    }
  }, [data, selected]);

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.subject.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const tpl = templates.find((t) => t.id === selected)

  function handleOpenDialog(template?: any) {
    if (template) {
      setEditingId(template.id)
      setFormData({ name: template.name, subject: template.subject, body: template.body })
    } else {
      setEditingId(null)
      setFormData({ name: "", subject: "", body: "" })
    }
    setOpen(true)
  }

  async function handleSave() {
    if (!formData.name.trim() || !formData.subject.trim() || !formData.body.trim()) {
      toast({ title: "Error", description: "All fields are required", variant: "destructive" });
      return;
    }

    try {
      setIsSaving(true);

      if (editingId) {
        await updateEmailTemplate({
          id: Number(editingId),
          ...formData
        });
        toast({ title: "Updated", description: "Template updated successfully" });
      } else {
        await createEmailTemplate(formData);
        toast({ title: "Created", description: "Template created successfully" });
      }

      mutate(["templates"]);
      setOpen(false);
    } catch (error) {
      toast({ title: "Error", description: "Failed to save template", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this template?")) return;

    await deleteEmailTemplate(id);
    toast({
      title: "Deleted",
      description: "Template deleted successfully",
    });
    setSelected(null);
    mutate(["templates"]);
  }

  async function handleUploadTemplate(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".html") && !file.name.endsWith(".txt")) {
      toast({
        title: "Error",
        description: "Only .html and .txt files are supported",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader()

    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const templateName = file.name.replace(/\.(html|txt)$/, "");

        await createEmailTemplate({
          name: templateName,
          subject: "Imported Template",
          body: content,
        });

        toast({
          title: "Uploaded",
          description: `Template "${templateName}" saved successfully`,
        });

        await mutate(["templates"]);
        setUploadOpen(false);

      } catch (err: any) {
        toast({
          title: "Upload failed",
          description: err.message || "Could not save template",
          variant: "destructive",
        });
      }
    };

    reader.readAsText(file);
  }

  return (
    <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Email Templates</h1>
          <p className="text-muted-foreground mt-1">
            Manage automated email responses and notifications here.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Upload className="size-4" /> Import
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Email Template</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="flex items-center justify-center border-2 border-dashed rounded-lg p-8 hover:bg-muted/50 transition-colors">
                  <Label htmlFor="file-upload" className="cursor-pointer text-center">
                    <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-foreground font-medium">Click to upload</span>
                    <span className="block text-xs text-muted-foreground mt-1">.html or .txt files</span>
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".html,.txt"
                      onChange={handleUploadTemplate}
                      className="hidden"
                    />
                  </Label>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} className="gap-2">
                <Plus className="size-4" /> New Template
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit Template" : "Create New Template"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-5 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="tpl-name">Friendly Name</Label>
                  <Input
                    id="tpl-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Welcome Email"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="tpl-subject">Email Subject Line</Label>
                  <Input
                    id="tpl-subject"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="e.g., Welcome to ClientHub!"
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="tpl-body">HTML Body</Label>
                    <span className="text-xs text-muted-foreground">Supports HTML & Inline Styles</span>
                  </div>
                  <Textarea
                    id="tpl-body"
                    value={formData.body}
                    onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                    placeholder="<html>...</html>"
                    rows={12}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="bg-muted/50 p-3 rounded-md border text-sm space-y-2">
                  <div className="font-semibold text-xs uppercase text-muted-foreground">Available Variables</div>
                  <div className="flex flex-wrap gap-2">
                    {["{{clientName}}", "{{taskTitle}}", "{{dueDate}}", "{{stageName}}"].map(v => (
                      <Badge key={v} variant="outline" className="bg-background cursor-copy" title="Click to copy">
                        {v}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? "Saving..." : editingId ? "Update Template" : "Create Template"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 flex-1 min-h-0">

        {/* LIST PANEL */}
        <Card className="md:col-span-4 lg:col-span-3 flex flex-col h-full border-r-0 md:border-r border-y-0 border-l-0 shadow-none md:shadow-sm rounded-none md:rounded-lg overflow-hidden">
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                className="pl-9 h-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredTemplates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No templates found.
              </div>
            ) : (
              filteredTemplates.map((t) => (
                <button
                  key={t.id}
                  className={cn(
                    "w-full text-left p-3 rounded-md transition-all border text-sm flex items-start gap-3 group",
                    selected === t.id
                      ? "bg-primary/5 border-primary/20 shadow-sm"
                      : "bg-transparent border-transparent hover:bg-muted"
                  )}
                  onClick={() => setSelected(t.id)}
                >
                  <div className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                    selected === t.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    <Mail className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={cn("font-medium truncate", selected === t.id ? "text-primary" : "text-foreground")}>
                      {t.name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {t.subject}
                    </div>
                  </div>
                  {selected === t.id && <ChevronRight className="h-4 w-4 text-primary opacity-50 self-center" />}
                </button>
              ))
            )}
          </div>
        </Card>

        {/* DETAILS/EDITOR PANEL */}
        <Card className="md:col-span-8 lg:col-span-9 flex flex-col h-full overflow-hidden border-0 md:border shadow-none md:shadow-sm">
          {tpl ? (
            <div className="flex flex-col h-full">
              {/* TOOLBAR */}
              <div className="flex items-center justify-between p-4 border-b bg-muted/10 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center">
                    <LayoutTemplate className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-lg">{tpl.name}</h2>
                    <p className="text-xs text-muted-foreground">Subject: <span className="font-medium text-foreground">{tpl.subject}</span></p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleOpenDialog(tpl)}>
                    <Edit2 className="mr-2 h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(tpl.id)}>
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </div>

              {/* PREVIEW CONTENT */}
              <div className="flex-1 overflow-y-auto p-0">
                <div className="grid grid-cols-1 lg:grid-cols-2 h-full divide-x">
                  {/* RAW CODE VIEW */}
                  <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950/50">
                    <div className="px-4 py-2 border-b bg-muted/20 text-xs font-semibold text-muted-foreground flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileCode className="h-3 w-3" /> Source Code
                      </div>
                    </div>
                    <div className="flex-1 p-4 font-mono text-xs overflow-auto whitespace-pre-wrap text-muted-foreground">
                      {tpl.body}
                    </div>
                  </div>

                  {/* LIVE PREVIEW (Simplified) */}
                  <div className="flex flex-col h-full bg-white dark:bg-background">
                    <div className="px-4 py-2 border-b bg-muted/20 text-xs font-semibold text-muted-foreground flex items-center gap-2">
                      <Mail className="h-3 w-3" /> Live Preview
                    </div>
                    <div className="flex-1 p-6 overflow-auto">
                      <div className="border rounded-lg p-6 shadow-sm min-h-[300px] bg-white text-black">
                        {/* 
                                            WARNING: dangerouslySetInnerHTML is used here for preview. 
                                            In a real app, sanitize this or use an iframe.
                                            For admin-only trusted content, it's acceptable for now.
                                         */}
                        <div
                          className="prose prose-sm max-w-none whitespace-pre-wrap"
                          dangerouslySetInnerHTML={{ __html: tpl.body }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
              <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4 text-muted-foreground/50">
                <Mail className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-medium text-foreground">No Template Selected</h3>
              <p className="text-sm max-w-xs text-center mt-2">
                Select a template from the list on the left to view, edit, or manage its content.
              </p>
              <Button variant="outline" className="mt-6" onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" /> Create New Template
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
