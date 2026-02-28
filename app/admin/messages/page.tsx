"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { FlexibleChat } from "@/components/widgets/flexible-chat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, MessageSquare, Building2, Landmark, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { fetchClients, fetchServiceCenters, fetchCPAs } from "@/lib/api";

interface Client {
    client_id: number;
    client_name: string;
    primary_contact_email?: string;
    last_message_at?: string;
    last_message_body?: string;
    last_message_sender_role?: string;
}

interface ServiceCenter {
    service_center_id: number;
    center_name: string;
    center_code?: string;
    email?: string;
    last_message_at?: string;
    last_message_body?: string;
    last_message_sender_role?: string;
}

interface CPA {
    cpa_id: number;
    cpa_name: string;
    email?: string;
    last_message_at?: string;
    last_message_body?: string;
    last_message_sender_role?: string;
}

export default function AdminMessages() {
    const [activeTab, setActiveTab] = useState("clients");

    // Read Status State (Local Storage)
    const [readStatus, setReadStatus] = useState<Record<string, string>>({});

    useEffect(() => {
        try {
            const stored = localStorage.getItem("sage_admin_read_status");
            if (stored) {
                setReadStatus(JSON.parse(stored));
            }
        } catch (e) {
            console.error("Failed to load read status", e);
        }
    }, []);

    const markAsRead = (key: string) => {
        const newState = { ...readStatus, [key]: new Date().toISOString() };
        setReadStatus(newState);
        localStorage.setItem("sage_admin_read_status", JSON.stringify(newState));
    };

    const isUnread = (key: string, lastMsgAt?: string, senderRole?: string, triggerRole?: string) => {
        if (!lastMsgAt || senderRole !== triggerRole) return false;
        const lastRead = readStatus[key];
        if (!lastRead) return true;
        // Compare dates (strings work if ISO, ensuring safety)
        return new Date(lastMsgAt) > new Date(lastRead);
    };

    // Client states
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [clientSearch, setClientSearch] = useState("");

    // Service Center states
    const [selectedSC, setSelectedSC] = useState<ServiceCenter | null>(null);
    const [scSearch, setSCSearch] = useState("");

    // CPA states
    const [selectedCPA, setSelectedCPA] = useState<CPA | null>(null);
    const [cpaSearch, setCPASearch] = useState("");

    // Fetch Lists
    const { data: clientsData, isLoading: clientsLoading } = useSWR(
        ["admin-clients-messages", clientSearch], // Key
        () => fetchClients({ page: 1, pageSize: 50, q: clientSearch }) // Fetcher
    );
    const clients: Client[] = clientsData?.data || [];

    const { data: scData, isLoading: scLoading } = useSWR(
        "admin-sc-messages",
        fetchServiceCenters
    );
    const serviceCenters: ServiceCenter[] = scData?.data || [];
    const filteredSCs = serviceCenters.filter(sc =>
        sc.center_name.toLowerCase().includes(scSearch.toLowerCase())
    );

    const { data: cpaData, isLoading: cpaLoading } = useSWR(
        "admin-cpas-messages",
        fetchCPAs
    );
    const cpas: CPA[] = cpaData?.data || [];
    const filteredCPAs = cpas.filter(cpa =>
        cpa.cpa_name.toLowerCase().includes(cpaSearch.toLowerCase())
    );

    // Format Time Helper
    const formatTime = (dateStr?: string) => {
        if (!dateStr) return "";
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                    <MessageSquare className="h-6 w-6 text-primary" />
                    Messages
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Communicate with clients, service centers, and Preparers
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full max-w-3xl grid-cols-3">
                    <TabsTrigger value="clients" className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Chat with Clients
                    </TabsTrigger>
                    <TabsTrigger value="service-centers" className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Chat with Service Centers
                    </TabsTrigger>
                    <TabsTrigger value="cpas" className="flex items-center gap-2">
                        <Landmark className="h-4 w-4" />
                        Chat with Preparers
                    </TabsTrigger>
                </TabsList>

                {/* CLIENTS TAB */}
                <TabsContent value="clients" className="mt-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                            <CardContent className="p-0 max-h-[550px] overflow-y-auto">
                                {clientsLoading ? (
                                    <div className="p-4 text-sm text-muted-foreground text-center">Loading...</div>
                                ) : clients.length === 0 ? (
                                    <div className="p-4 text-sm text-muted-foreground text-center">No clients found</div>
                                ) : (
                                    <div className="divide-y relative">
                                        {clients.map((client) => {
                                            const unread = isUnread(`client-${client.client_id}`, client.last_message_at, client.last_message_sender_role, "CLIENT");
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
                        <div className="lg:col-span-2">
                            {selectedClient ? (
                                <FlexibleChat
                                    clientId={selectedClient.client_id.toString()}
                                    clientName={selectedClient.client_name}
                                    currentUserRole="ADMIN"
                                    recipients={[
                                        { role: "CLIENT", label: selectedClient.client_name, color: "bg-blue-500" },
                                    ]}
                                    serviceCenterId={undefined}
                                    cpaId={undefined}
                                    height="550px"
                                />
                            ) : (
                                <Card className="h-[550px] flex items-center justify-center">
                                    <div className="text-center space-y-3 opacity-50">
                                        <div className="bg-blue-100 p-4 rounded-full inline-block">
                                            <Users className="size-8 text-blue-500" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-900">Select a client to chat</p>
                                        </div>
                                    </div>
                                </Card>
                            )}
                        </div>
                    </div>
                </TabsContent>

                {/* SERVICE CENTERS TAB */}
                <TabsContent value="service-centers" className="mt-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <Card className="lg:col-span-1">
                            <CardHeader className="pb-3 border-b">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-emerald-600" />
                                    Service Centers ({serviceCenters.length})
                                </CardTitle>
                                <div className="relative mt-3">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search service centers..."
                                        value={scSearch}
                                        onChange={(e) => setSCSearch(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                            </CardHeader>
                            <CardContent className="p-0 max-h-[550px] overflow-y-auto">
                                {scLoading ? (
                                    <div className="p-4 text-sm text-muted-foreground text-center">Loading...</div>
                                ) : filteredSCs.length === 0 ? (
                                    <div className="p-4 text-sm text-muted-foreground text-center">No service centers found</div>
                                ) : (
                                    <div className="divide-y relative">
                                        {filteredSCs.map((sc) => {
                                            const unread = isUnread(`sc-${sc.service_center_id}`, sc.last_message_at, sc.last_message_sender_role, "SERVICE_CENTER");
                                            return (
                                                <button
                                                    key={sc.service_center_id}
                                                    onClick={() => {
                                                        setSelectedSC(sc);
                                                        markAsRead(`sc-${sc.service_center_id}`);
                                                    }}
                                                    className={cn(
                                                        "w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors",
                                                        selectedSC?.service_center_id === sc.service_center_id && "bg-emerald-50 border-l-4 border-emerald-500"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "h-12 w-12 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 relative",
                                                        selectedSC?.service_center_id === sc.service_center_id
                                                            ? "bg-emerald-500 text-white"
                                                            : "bg-emerald-100 text-emerald-700"
                                                    )}>
                                                        {sc.center_name.substring(0, 2).toUpperCase()}
                                                        {unread && (
                                                            <span className="absolute top-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-white ring-2 ring-white"></span>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-start">
                                                            <p className={cn(
                                                                "font-medium truncate text-sm",
                                                                selectedSC?.service_center_id === sc.service_center_id && "text-emerald-700",
                                                                unread && "font-bold text-slate-900"
                                                            )}>
                                                                {sc.center_name}
                                                            </p>
                                                            {sc.last_message_at && (
                                                                <span className={cn("text-[10px] whitespace-nowrap ml-2", unread ? "text-green-600 font-bold" : "text-muted-foreground")}>
                                                                    {formatTime(sc.last_message_at)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className={cn(
                                                            "text-xs truncate mt-1 w-full",
                                                            unread ? "text-slate-900 font-medium" : "text-muted-foreground"
                                                        )}>
                                                            {sc.last_message_body ? (
                                                                sc.last_message_body.length > 35
                                                                    ? sc.last_message_body.substring(0, 35) + "..."
                                                                    : sc.last_message_body
                                                            ) : (
                                                                sc.center_code ? `Code: ${sc.center_code}` : "No messages yet"
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
                        <div className="lg:col-span-2">
                            {selectedSC ? (
                                <FlexibleChat
                                    clientId="0"
                                    serviceCenterName={selectedSC.center_name}
                                    serviceCenterId={selectedSC.service_center_id}
                                    currentUserRole="ADMIN"
                                    recipients={[
                                        { role: "SERVICE_CENTER", label: selectedSC.center_name, color: "bg-emerald-500" },
                                    ]}
                                    height="550px"
                                />
                            ) : (
                                <Card className="h-[550px] flex items-center justify-center">
                                    <div className="text-center space-y-3 opacity-50">
                                        <div className="bg-emerald-100 p-4 rounded-full inline-block">
                                            <Building2 className="size-8 text-emerald-500" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-900">Select a service center to chat</p>
                                        </div>
                                    </div>
                                </Card>
                            )}
                        </div>
                    </div>
                </TabsContent>

                {/* CPAs TAB */}
                <TabsContent value="cpas" className="mt-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <Card className="lg:col-span-1">
                            <CardHeader className="pb-3 border-b">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Landmark className="h-4 w-4 text-amber-600" />
                                    Preparers ({cpas.length})
                                </CardTitle>
                                <div className="relative mt-3">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search Preparers..."
                                        value={cpaSearch}
                                        onChange={(e) => setCPASearch(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                            </CardHeader>
                            <CardContent className="p-0 max-h-[550px] overflow-y-auto">
                                {cpaLoading ? (
                                    <div className="p-4 text-sm text-muted-foreground text-center">Loading...</div>
                                ) : filteredCPAs.length === 0 ? (
                                    <div className="p-4 text-sm text-muted-foreground text-center">No Preparers found</div>
                                ) : (
                                    <div className="divide-y relative">
                                        {filteredCPAs.map((cpa) => {
                                            const unread = isUnread(`cpa-${cpa.cpa_id}`, cpa.last_message_at, cpa.last_message_sender_role, "CPA");
                                            return (
                                                <button
                                                    key={cpa.cpa_id}
                                                    onClick={() => {
                                                        setSelectedCPA(cpa);
                                                        markAsRead(`cpa-${cpa.cpa_id}`);
                                                    }}
                                                    className={cn(
                                                        "w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors",
                                                        selectedCPA?.cpa_id === cpa.cpa_id && "bg-amber-50 border-l-4 border-amber-500"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "h-12 w-12 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 relative",
                                                        selectedCPA?.cpa_id === cpa.cpa_id
                                                            ? "bg-amber-500 text-white"
                                                            : "bg-amber-100 text-amber-700"
                                                    )}>
                                                        {cpa.cpa_name.substring(0, 2).toUpperCase()}
                                                        {unread && (
                                                            <span className="absolute top-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-white ring-2 ring-white"></span>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-start">
                                                            <p className={cn(
                                                                "font-medium truncate text-sm",
                                                                selectedCPA?.cpa_id === cpa.cpa_id && "text-amber-700",
                                                                unread && "font-bold text-slate-900"
                                                            )}>
                                                                {cpa.cpa_name}
                                                            </p>
                                                            {cpa.last_message_at && (
                                                                <span className={cn("text-[10px] whitespace-nowrap ml-2", unread ? "text-green-600 font-bold" : "text-muted-foreground")}>
                                                                    {formatTime(cpa.last_message_at)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className={cn(
                                                            "text-xs truncate mt-1 w-full",
                                                            unread ? "text-slate-900 font-medium" : "text-muted-foreground"
                                                        )}>
                                                            {cpa.last_message_body ? (
                                                                cpa.last_message_body.length > 35
                                                                    ? cpa.last_message_body.substring(0, 35) + "..."
                                                                    : cpa.last_message_body
                                                            ) : (
                                                                cpa.email || "No messages yet"
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
                        <div className="lg:col-span-2">
                            {selectedCPA ? (
                                <FlexibleChat
                                    clientId="0"
                                    cpaId={selectedCPA.cpa_id}
                                    currentUserRole="ADMIN"
                                    recipients={[
                                        { role: "CPA", label: selectedCPA.cpa_name, color: "bg-amber-500" },
                                    ]}
                                    height="550px"
                                />
                            ) : (
                                <Card className="h-[550px] flex items-center justify-center">
                                    <div className="text-center space-y-3 opacity-50">
                                        <div className="bg-amber-100 p-4 rounded-full inline-block">
                                            <Landmark className="size-8 text-amber-500" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-900">Select a Preparer to chat</p>
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
