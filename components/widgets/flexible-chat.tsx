"use client"

import { useState, useEffect, useRef } from "react"
import useSWR, { mutate } from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Send, Reply, X, FileText, Loader2, Paperclip, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
    id: string | number
    senderRole: string
    receiverRole: string
    body: string
    createdAt: string
    parentMessageId?: number | null
    attachmentUrl?: string | null
    attachmentName?: string | null
    clientName?: string
    serviceCenterName?: string
}

interface ChatRecipient {
    role: string
    label: string
    color: string // Tailwind color class
}

interface FlexibleChatProps {
    clientId: string
    clientName?: string
    serviceCenterName?: string
    cpaName?: string
    serviceCenterId?: string | number  // For specific service center messaging
    cpaId?: string | number  // For specific CPA messaging
    currentUserRole: "ADMIN" | "CLIENT" | "SERVICE_CENTER" | "CPA"
    recipients: ChatRecipient[]
    height?: string
}

const AVATAR_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    ADMIN: { bg: "bg-violet-100", text: "text-violet-700", border: "border-violet-200" },
    CLIENT: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200" },
    SERVICE_CENTER: { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200" },
    CPA: { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200" },
}

const BUBBLE_COLORS: Record<string, string> = {
    ADMIN: "bg-violet-500",
    CLIENT: "bg-blue-500",
    SERVICE_CENTER: "bg-emerald-500",
    CPA: "bg-amber-500",
}

export function FlexibleChat({
    clientId,
    clientName,
    serviceCenterName,
    cpaName,
    serviceCenterId,
    cpaId,
    currentUserRole,
    recipients,
    height = "500px",
}: FlexibleChatProps) {
    const { toast } = useToast()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const [selectedRecipient, setSelectedRecipient] = useState<ChatRecipient>(recipients[0])
    const [messages, setMessages] = useState<Message[]>([])
    const [messageText, setMessageText] = useState("")
    const [replyingTo, setReplyingTo] = useState<Message | null>(null)
    const [isSending, setIsSending] = useState(false)
    const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
    const [isUploading, setIsUploading] = useState(false)

    // Update selectedRecipient when recipients prop changes (e.g., switching to a different SC/CPA)
    useEffect(() => {
        setSelectedRecipient(recipients[0])
    }, [recipients])

    // Determine active IDs based on the conversation context
    // We only attach specific IDs if we are explicitly chatting WITH that entity role
    // OR if we ARE that entity role (e.g. Service Center chatting with Admin/Client)
    const activeServiceCenterId = (selectedRecipient.role === "SERVICE_CENTER" || currentUserRole === "SERVICE_CENTER") ? serviceCenterId : undefined
    const activeCpaId = (selectedRecipient.role === "CPA" || currentUserRole === "CPA") ? cpaId : undefined

    // Check if recipient is assigned (for enhancing the UI)
    const isUnassigned =
        (selectedRecipient.role === "SERVICE_CENTER" && !serviceCenterId) ||
        (selectedRecipient.role === "CPA" && !cpaId);

    // Build the conversation key
    const conversationKey = `${currentUserRole},${selectedRecipient.role}`

    // Fetch messages for the current conversation
    const { data: msgsResponse, isLoading } = useSWR(
        clientId ? ["messages", clientId, conversationKey, activeServiceCenterId, activeCpaId] : null,
        async () => {
            let url = `/api/messages/get?clientId=${clientId}&conversationBetween=${conversationKey}`
            if (activeServiceCenterId) url += `&serviceCenterId=${activeServiceCenterId}`
            if (activeCpaId) url += `&cpaId=${activeCpaId}`
            const res = await fetch(url)
            const json = await res.json()
            return json.data || []
        },
        { refreshInterval: 5000 } // Refresh every 5 seconds
    )

    // Sync messages
    useEffect(() => {
        if (Array.isArray(msgsResponse)) {
            setMessages(
                msgsResponse.map((m: any) => ({
                    id: m.message_id,
                    senderRole: m.sender_role,
                    receiverRole: m.receiver_role,
                    body: m.body,
                    parentMessageId: m.parent_message_id,
                    attachmentUrl: m.attachment_url,
                    attachmentName: m.attachment_name,
                    createdAt: m.created_at,
                    clientName: m.client_name,
                    serviceCenterName: m.service_center_name,
                }))
            )
        }
    }, [msgsResponse])

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    // Handle file selection
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            if (file.size > 10 * 1024 * 1024) {
                toast({ title: "File too large", description: "Maximum file size is 10MB", variant: "destructive" })
                return
            }
            setAttachmentFile(file)
        }
    }

    // Send message
    const handleSendMessage = async () => {
        if ((!messageText.trim() && !attachmentFile) || !clientId) return

        setIsSending(true)
        setIsUploading(!!attachmentFile)

        try {
            let attachmentUrl = null
            let attachmentName = null

            // Upload attachment if exists
            if (attachmentFile) {
                const formData = new FormData()
                formData.append("clientId", clientId)
                formData.append("file", attachmentFile)

                const uploadRes = await fetch("/api/messages/upload-attachment", {
                    method: "POST",
                    body: formData,
                })

                const uploadJson = await uploadRes.json()

                if (!uploadJson.success) {
                    toast({ title: "Failed to upload attachment", variant: "destructive" })
                    setIsSending(false)
                    setIsUploading(false)
                    return
                }

                attachmentUrl = uploadJson.attachmentUrl
                attachmentName = uploadJson.attachmentName
            }

            await fetch("/api/messages/add", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    client_id: clientId,
                    sender_role: currentUserRole,
                    receiver_role: selectedRecipient.role,
                    body: messageText || (attachmentFile ? `Sent an attachment: ${attachmentFile.name}` : ""),
                    parent_message_id: replyingTo?.id,
                    attachment_url: attachmentUrl,
                    attachment_name: attachmentName,
                    service_center_id: activeServiceCenterId || null,
                    cpa_id: activeCpaId || null,
                }),
            })

            setMessageText("")
            setAttachmentFile(null)
            setReplyingTo(null)
            if (fileInputRef.current) fileInputRef.current.value = ""

            toast({ title: "Message sent" })
            mutate(["messages", clientId, conversationKey, activeServiceCenterId, activeCpaId])
        } catch (error) {
            toast({ title: "Failed to send message", variant: "destructive" })
        } finally {
            setIsSending(false)
            setIsUploading(false)
        }
    }

    // Get display name based on role
    const getDisplayName = (message: Message, role: string): string => {
        switch (role) {
            case "CLIENT":
                return message.clientName || clientName || "Client"
            case "SERVICE_CENTER":
                return message.serviceCenterName || serviceCenterName || "Service Center"
            case "ADMIN":
                return "Admin"
            case "CPA":
                return "Preparer"
            default:
                return role
        }
    }

    // Get abbreviation for avatar
    const getAbbreviation = (message: Message, role: string): string => {
        const name = getDisplayName(message, role)
        if (name.length <= 2) return name.toUpperCase()
        const words = name.split(" ")
        if (words.length >= 2) {
            return (words[0][0] + words[1][0]).toUpperCase()
        }
        return name.substring(0, 2).toUpperCase()
    }

    const myBubbleColor = BUBBLE_COLORS[currentUserRole] || "bg-blue-500"

    return (
        <Card className="flex flex-col" style={{ height }}>
            <CardHeader className="border-b px-4 py-3 shrink-0">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base font-semibold">Messages</CardTitle>
                        <p className="text-xs text-muted-foreground">
                            {clientName ? `Communication for ${clientName}` : "Select a recipient to start chatting"}
                        </p>
                    </div>
                </div>

                {/* Recipient Tabs */}
                {recipients.length > 1 && (
                    <div className="flex gap-2 mt-3">
                        {recipients.map((recipient) => (
                            <button
                                key={recipient.role}
                                onClick={() => {
                                    setSelectedRecipient(recipient)
                                    setReplyingTo(null)
                                }}
                                className={cn(
                                    "px-3 py-1.5 text-xs font-medium rounded-full transition-all",
                                    selectedRecipient.role === recipient.role
                                        ? `${recipient.color} text-white shadow-sm`
                                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                                )}
                            >
                                Chat with {recipient.label}
                            </button>
                        ))}
                    </div>
                )}
            </CardHeader>

            <CardContent className="flex-1 flex flex-col p-0 overflow-hidden bg-slate-50">
                {/* Messages List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin mr-2" />
                            Loading messages...
                        </div>
                    ) : messages.length === 0 ? (
                        <div className={cn("flex flex-col items-center justify-center h-full text-center space-y-2", isUnassigned ? "opacity-100" : "opacity-50")}>
                            <div className={cn("p-4 rounded-full", isUnassigned ? "bg-amber-100" : "bg-slate-200")}>
                                {isUnassigned ? (
                                    <AlertCircle className="size-6 text-amber-600" />
                                ) : (
                                    <Send className="size-6 text-slate-500" />
                                )}
                            </div>
                            <div>
                                <p className="font-medium text-slate-900">
                                    {isUnassigned ? "No Assignment Found" : "No messages yet"}
                                </p>
                                <p className={cn("text-sm", isUnassigned ? "text-amber-600 font-bold" : "text-slate-500")}>
                                    Start the conversation with {selectedRecipient.label}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {messages.map((m, index) => {
                                const isMe = m.senderRole === currentUserRole
                                const avatarStyle = AVATAR_COLORS[m.senderRole] || AVATAR_COLORS.ADMIN
                                const senderName = getDisplayName(m, m.senderRole)
                                const abbrev = getAbbreviation(m, m.senderRole)

                                return (
                                    <div
                                        key={`${m.id}-${index}`}
                                        className={`group flex w-full ${isMe ? "justify-end" : "justify-start"}`}
                                    >
                                        <div className={`flex flex-col max-w-[80%] ${isMe ? "items-end" : "items-start"}`}>
                                            <div className="flex items-end gap-2">
                                                {/* Avatar for others */}
                                                {!isMe && (
                                                    <div
                                                        className={cn(
                                                            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border shrink-0",
                                                            avatarStyle.bg,
                                                            avatarStyle.text,
                                                            avatarStyle.border
                                                        )}
                                                        title={senderName}
                                                    >
                                                        {abbrev}
                                                    </div>
                                                )}

                                                {/* Message Bubble */}
                                                <div
                                                    className={cn(
                                                        "relative px-4 py-2 rounded-2xl text-sm shadow-sm whitespace-pre-wrap",
                                                        isMe
                                                            ? `${myBubbleColor} text-white rounded-br-none`
                                                            : "bg-white text-slate-700 rounded-bl-none border"
                                                    )}
                                                >
                                                    {/* Sender name for incoming messages */}
                                                    {!isMe && (
                                                        <div className="text-[10px] font-semibold text-slate-500 mb-1">
                                                            {senderName}
                                                        </div>
                                                    )}

                                                    {/* Reply Reference */}
                                                    {m.parentMessageId && (() => {
                                                        const parentMsg = messages.find(msg => msg.id === m.parentMessageId)
                                                        if (parentMsg) {
                                                            const parentName = parentMsg.senderRole === currentUserRole
                                                                ? "You"
                                                                : getDisplayName(parentMsg, parentMsg.senderRole)
                                                            return (
                                                                <div
                                                                    className={cn(
                                                                        "mb-2 p-2 rounded-lg text-xs border-l-2",
                                                                        isMe ? "bg-white/20 border-white/50" : "bg-slate-100 border-slate-300"
                                                                    )}
                                                                >
                                                                    <span className={cn("font-semibold", isMe ? "text-white/80" : "text-slate-500")}>
                                                                        {parentName}
                                                                    </span>
                                                                    <p className={cn("truncate", isMe ? "text-white/70" : "text-slate-600")}>
                                                                        {parentMsg.body}
                                                                    </p>
                                                                </div>
                                                            )
                                                        }
                                                        return null
                                                    })()}

                                                    {m.body}

                                                    {/* Attachment Display */}
                                                    {m.attachmentUrl && m.attachmentName && (() => {
                                                        const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(m.attachmentName)

                                                        if (isImage) {
                                                            return (
                                                                <a
                                                                    href={m.attachmentUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="block mt-2"
                                                                >
                                                                    <img
                                                                        src={m.attachmentUrl}
                                                                        alt={m.attachmentName}
                                                                        className="max-w-[200px] max-h-[200px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                                                    />
                                                                </a>
                                                            )
                                                        }

                                                        return (
                                                            <a
                                                                href={m.attachmentUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className={cn(
                                                                    "flex items-center gap-2 mt-2 p-2 rounded-lg transition-colors",
                                                                    isMe ? "bg-white/20 hover:bg-white/30" : "bg-slate-100 hover:bg-slate-200"
                                                                )}
                                                            >
                                                                <FileText className={cn("size-4", isMe ? "text-white/80" : "text-slate-500")} />
                                                                <span className={cn("text-xs underline", isMe ? "text-white/90" : "text-slate-600")}>
                                                                    {m.attachmentName}
                                                                </span>
                                                            </a>
                                                        )
                                                    })()}

                                                    {/* Timestamp */}
                                                    <div
                                                        className={cn(
                                                            "text-[10px] mt-1 opacity-70",
                                                            isMe ? "text-white/80 text-right" : "text-slate-400"
                                                        )}
                                                    >
                                                        {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                    </div>
                                                </div>

                                                {/* Reply Button */}
                                                <button
                                                    onClick={() => setReplyingTo(m)}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full hover:bg-slate-200 text-slate-500"
                                                    title="Reply"
                                                >
                                                    <Reply className="size-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                            <div ref={messagesEndRef} />
                        </>
                    )}
                </div>

                {/* Input Area */}
                <div className="border-t bg-white p-3 shrink-0">
                    {/* Reply Banner */}
                    {replyingTo && (
                        <div className="flex items-center justify-between bg-blue-50 border-l-4 border-blue-500 p-2 mb-2 rounded-r text-sm">
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-blue-600">
                                    Replying to {replyingTo.senderRole === currentUserRole ? "Yourself" : getDisplayName(replyingTo, replyingTo.senderRole)}
                                </span>
                                <span className="text-slate-600 truncate max-w-xs">{replyingTo.body}</span>
                            </div>
                            <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-blue-100 rounded-full">
                                <X className="size-4 text-blue-500" />
                            </button>
                        </div>
                    )}

                    {/* Attachment Preview */}
                    {attachmentFile && (
                        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 p-2 mb-2 rounded-lg text-sm">
                            <div className="flex items-center gap-2">
                                <FileText className="size-4 text-amber-600" />
                                <span className="text-amber-800 truncate max-w-xs">{attachmentFile.name}</span>
                                <span className="text-amber-600 text-xs">({(attachmentFile.size / 1024).toFixed(1)} KB)</span>
                            </div>
                            <button
                                onClick={() => {
                                    setAttachmentFile(null)
                                    if (fileInputRef.current) fileInputRef.current.value = ""
                                }}
                                className="p-1 hover:bg-amber-100 rounded-full"
                            >
                                <X className="size-4 text-amber-600" />
                            </button>
                        </div>
                    )}

                    <div className="flex items-end gap-2 bg-slate-100 p-2 rounded-xl border border-transparent focus-within:border-blue-300 focus-within:bg-white transition-all">
                        {/* Hidden File Input */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            className="hidden"
                            accept="*"
                        />

                        {/* Attachment Button */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "h-9 w-9 rounded-full shrink-0",
                                attachmentFile ? "text-amber-600 bg-amber-50" : "text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                            )}
                            title="Attach file"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading || isUnassigned}
                        >
                            <Paperclip className="size-5" />
                        </Button>

                        <textarea
                            placeholder={isUnassigned ? "Recipient not assigned" : `Message ${selectedRecipient.label}...`}
                            className="flex-1 border-0 bg-transparent focus:outline-none focus:ring-0 px-2 py-2 min-h-[40px] max-h-32 resize-none text-sm"
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault()
                                    handleSendMessage()
                                }
                            }}
                            rows={1}
                            disabled={isSending || isUnassigned}
                            style={{ cursor: isUnassigned ? "not-allowed" : "auto" }}
                        />

                        <Button
                            onClick={handleSendMessage}
                            size="icon"
                            className={cn(
                                "h-9 w-9 rounded-full shrink-0 transition-all",
                                messageText.trim() || attachmentFile ? myBubbleColor + " hover:opacity-90" : "bg-slate-300 hover:bg-slate-400"
                            )}
                            disabled={(!messageText.trim() && !attachmentFile) || isSending || isUnassigned}
                        >
                            {isSending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                        </Button>
                    </div>
                    <div className="text-[10px] text-slate-400 text-center mt-2">
                        Enter to send, Shift + Enter for new line
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
