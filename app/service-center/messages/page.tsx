"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { FlexibleChat } from "@/components/widgets/flexible-chat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUIStore } from "@/store/ui-store";
import { Users, MessageSquare, Search, Building2, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Client {
    client_id: number;
    client_name: string;
    primary_contact_email?: string;
    last_message_at?: string;
    last_message_body?: string;
    last_message_sender_role?: string;
}

export default function ServiceCenterMessages() {
    const currentServiceCenterId = useUIStore((s) => s.currentServiceCenterId);
    const [activeTab, setActiveTab] = useState("clients");
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [clientSearch, setClientSearch] = useState("");

    // Read Status Logic
    const [readStatus, setReadStatus] = useState<Record<string, string>>({});

    useEffect(() => {
        try {
            const stored = localStorage.getItem("sage_sc_read_status");
            if (stored) setReadStatus(JSON.parse(stored));
        } catch (e) { console.error(e); }
    }, []);

    const markAsRead = (key: string) => {
        const newState = { ...readStatus, [key]: new Date().toISOString() };
        setReadStatus(newState);
        localStorage.setItem("sage_sc_read_status", JSON.stringify(newState));
    };

    const isUnread = (key: string, lastMsgAt?: string, senderRole?: string) => {
        if (!lastMsgAt || senderRole !== "CLIENT") return false;
        const lastRead = readStatus[key];
        if (!lastRead) return true;
        return new Date(lastMsgAt) > new Date(lastRead);
    };

    // Fetch clients assigned to this SC
    // ...
    const { data: clientsData, isLoading: clientsLoading } = useSWR(
        currentServiceCenterId ? ["sc-clients-messages", currentServiceCenterId] : null,
        async () => {
            const res = await fetch(`/api/clients/get-by-service-center?serviceCenterId=${currentServiceCenterId}`);
            const json = await res.json();
            return { data: json.data || [] };
        }
    );

    const clients: Client[] = clientsData?.data || [];

    // Filter clients
    const filteredClients = clients.filter((c) =>
        c.client_name.toLowerCase().includes(clientSearch.toLowerCase())
    );

    const formatTime = (dateStr?: string) => {
        if (!dateStr) return "";
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    if (!currentServiceCenterId) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-3 text-muted-foreground">Loading...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                    <MessageSquare className="h-6 w-6 text-primary" />
                    Messages
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Communicate with Admin and your assigned clients
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="admin" className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Chat with Admin
                    </TabsTrigger>
                    <TabsTrigger value="clients" className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Chat with Clients
                    </TabsTrigger>
                </TabsList>

                {/* ADMIN TAB */}
                <TabsContent value="admin" className="mt-4">
                    <FlexibleChat
                        clientId="0"
                        serviceCenterId={currentServiceCenterId}
                        currentUserRole="SERVICE_CENTER"
                        recipients={[
                            { role: "ADMIN", label: "Admin", color: "bg-violet-500" },
                        ]}
                        height="600px"
                    />
                </TabsContent>

                {/* CLIENTS TAB */}
                <TabsContent value="clients" className="mt-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Client List */}
                        <Card className="lg:col-span-1">
                            <CardHeader className="pb-3 border-b">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Users className="h-4 w-4 text-blue-600" />
                                    Clients ({clients.length})
                                </CardTitle>
                                <div className="relative mt-3">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search clients..."
                                        value={clientSearch}
                                        onChange={(e) => setClientSearch(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                            </CardHeader>
                            <CardContent className="p-0 max-h-[500px] overflow-y-auto">
                                {clientsLoading ? (
                                    <div className="p-4 text-sm text-muted-foreground text-center">Loading...</div>
                                ) : filteredClients.length === 0 ? (
                                    <div className="p-4 text-sm text-muted-foreground text-center">
                                        {clients.length === 0 ? "No clients assigned" : "No clients found"}
                                    </div>
                                ) : (
                                    <div className="divide-y relative">
                                        {filteredClients.map((client) => {
                                            const unread = isUnread(`client-${client.client_id}`, client.last_message_at, client.last_message_sender_role);
                                            return (
                                                <button
                                                    key={client.client_id}
                                                    onClick={() => {
                                                        setSelectedClient(client);
                                                        markAsRead(`client-${client.client_id}`);
                                                    }}
                                                    className={cn(
                                                        "w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors",
                                                        selectedClient?.client_id === client.client_id && "bg-blue-50 border-l-4 border-blue-500"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "h-12 w-12 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 relative",
                                                        selectedClient?.client_id === client.client_id
                                                            ? "bg-blue-500 text-white"
                                                            : "bg-blue-100 text-blue-700"
                                                    )}>
                                                        {client.client_name.substring(0, 2).toUpperCase()}
                                                        {unread && (
                                                            <span className="absolute top-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-white ring-2 ring-white"></span>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-start">
                                                            <p className={cn(
                                                                "font-medium truncate text-sm",
                                                                selectedClient?.client_id === client.client_id && "text-blue-700",
                                                                unread && "font-bold text-slate-900"
                                                            )}>
                                                                {client.client_name}
                                                            </p>
                                                            {client.last_message_at && (
                                                                <span className={cn("text-[10px] whitespace-nowrap ml-2", unread ? "text-green-600 font-bold" : "text-muted-foreground")}>
                                                                    {formatTime(client.last_message_at)}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <p className={cn(
                                                            "text-xs truncate mt-1 w-full",
                                                            unread ? "text-slate-900 font-medium" : "text-muted-foreground"
                                                        )}>
                                                            {client.last_message_body ? (
                                                                client.last_message_body.length > 35
                                                                    ? client.last_message_body.substring(0, 35) + "..."
                                                                    : client.last_message_body
                                                            ) : (
                                                                client.primary_contact_email || "No messages yet"
                                                            )}
                                                        </p>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Chat Area */}
                        <div className="lg:col-span-2">
                            {selectedClient ? (
                                <FlexibleChat
                                    clientId={selectedClient.client_id.toString()}
                                    clientName={selectedClient.client_name}
                                    currentUserRole="SERVICE_CENTER"
                                    recipients={[
                                        { role: "CLIENT", label: selectedClient.client_name, color: "bg-blue-500" },
                                        { role: "ADMIN", label: "Admin", color: "bg-violet-500" },
                                    ]}
                                    height="600px"
                                />
                            ) : (
                                <Card className="h-[600px] flex items-center justify-center">
                                    <div className="text-center space-y-3 opacity-50">
                                        <div className="bg-emerald-100 p-4 rounded-full inline-block">
                                            <Building2 className="size-8 text-emerald-500" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-900">Select a client to chat</p>
                                            <p className="text-sm text-slate-500">Choose from the list on the left</p>
                                        </div>
                                    </div>
                                </Card>
                            )}
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
