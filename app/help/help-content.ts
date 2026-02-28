import { Shield, User, FileCheck, Headphones, LucideIcon, Handshake, LogIn, UserPlus, Users, ListTodo, ClipboardList, Activity, MessageSquare, CheckCircle, Mail, LayoutDashboard, ClipboardCheck, Upload, MessageCircle, TrendingUp, PartyPopper, UserCheck, FileSearch, FilePlus, Clock, ArrowRight, HelpCircle } from "lucide-react";

export type FlowStep = {
    title: string;
    description: string;
};

export type FAQItem = {
    question: string;
    answer: string;
};

export type RoleHelpContent = {
    id: string;
    title: string;
    icon: LucideIcon;
    description: string;
    responsibilities: string[];
    flow: FlowStep[];
    faqs: FAQItem[];
    color: string;
};

// Icon mapping for dynamic icon loading
export const ICON_MAP: Record<string, LucideIcon> = {
    Shield, User, FileCheck, Headphones, LogIn, UserPlus, Users, ListTodo,
    ClipboardList, Activity, MessageSquare, CheckCircle, Mail, LayoutDashboard,
    ClipboardCheck, Upload, MessageCircle, TrendingUp, PartyPopper, UserCheck,
    FileSearch, FilePlus, Clock, ArrowRight, HelpCircle, Handshake
};

export const ROLE_CONTENT: Record<string, RoleHelpContent> = {
    ADMIN: {
        id: "ADMIN",
        title: "Admin",
        icon: Shield,
        description: "Full system access and administrative control. Oversees the entire onboarding lifecycle.",
        color: "text-blue-600 dark:text-blue-400",
        responsibilities: [
            "Create and manage Client, Preparer, and Service Center profiles",
            "Configure onboarding stages and associated tasks",
            "Assign Preparer and Service Center to clients",
            "Oversee documents, reports, communications, and audit logs",
        ],
        flow: [
            {
                title: "Create Client",
                description: "Admin creates a new client profile. Credentials are auto-generated.",
            },
            {
                title: "Assign Roles",
                description: "Assign a Preparer and Service Center to the client for support and compliance.",
            },
            {
                title: "Configure Onboarding",
                description: "Set up onboarding stages and create specific tasks.",
            },
            {
                title: "Monitor Progress",
                description: "Track completion of tasks and review uploaded documents via the Dashboard.",
            },
        ],
        faqs: [
            {
                question: "How do I reset a user's password?",
                answer: "Go to the Client/Preparer/Service Center list in the Dashboard, select the user, and click 'Edit'. You can set a new temporary password there.",
            },
            {
                question: "Can I delete a client?",
                answer: "Yes, but proceed with caution. Deleting a client removes all associated tasks, documents, and history. This cannot be undone.",
            },
            {
                question: "How do I change the onboarding stages?",
                answer: "Navigate to the 'Onboarding Stages' tab. You can reorder, add, or remove stages for future clients. Existing clients won't be affected.",
            },
        ],
    },
    CLIENT: {
        id: "CLIENT",
        title: "Client",
        icon: Handshake,
        description: "The end-user organization undergoing the onboarding process.",
        color: "text-green-600 dark:text-green-400",
        responsibilities: [
            "Complete assigned onboarding tasks",
            "Upload required documentation",
            "Communicate with assigned Preparer and Service Center",
        ],
        flow: [
            {
                title: "Receive Credentials",
                description: "Log in using the email and password provided by the Admin.",
            },
            {
                title: "Access Dashboard",
                description: "View pending tasks and current onboarding stage progress.",
            },
            {
                title: "Execute Tasks",
                description: "Complete tasks and upload mandatory documents where required.",
            },
            {
                title: "Communication",
                description: "Send messages to Preparer or Service Center if clarification is needed.",
            },
        ],
        faqs: [
            {
                question: "I forgot my password.",
                answer: "Please contact your Admin or Service Center representative to request a password reset.",
            },
            {
                question: "Why is my task 'locked'?",
                answer: "Some tasks may dependent on previous stages. Ensure all prior tasks are completed or check if a document upload is required.",
            },
            {
                question: "How do I upload a document?",
                answer: "Click on the specific task. If a document is required, you will see an upload area. Drag and drop your file or click to browse.",
            }
        ]
    },
    CPA: {
        id: "CPA",
        title: "Preparer",
        icon: FileCheck,
        description: "Compliance and review role responsible for validating client tasks and documents.",
        color: "text-purple-600 dark:text-purple-400",
        responsibilities: [
            "Review client tasks and submitted documents",
            "Upload documents when assigned specific Preparer tasks",
            "Communicate with clients for validation",
        ],
        flow: [
            {
                title: "Client Assignment",
                description: "Receive notification of new client assignment from Admin.",
            },
            {
                title: "Review Tasks",
                description: "Monitor client progress and review completed tasks.",
            },
            {
                title: "Validate Docs",
                description: "Check uploaded documents for accuracy and compliance.",
            },
            {
                title: "Provide Feedback",
                description: "Message client for corrections or mark tasks as verified.",
            },
        ],
        faqs: [
            {
                question: "How do I approve a document?",
                answer: "Open the client's task list, view the uploaded document, and mark the task as 'Verified' or 'Completed' if it meets requirements.",
            },
            {
                question: "Can I upload documents for the client?",
                answer: "Yes, Preparers can upload documents to client folders if necessary, usually under the 'Documents' tab or specific tasks assigned to Preparer.",
            }
        ]
    },
    SERVICE_CENTER: {
        id: "SERVICE_CENTER",
        title: "Service Center",
        icon: Headphones,
        description: "Operational support role assisting clients through the onboarding journey.",
        color: "text-orange-600 dark:text-orange-400",
        responsibilities: [
            "Provide operational support for assigned clients",
            "Review and complete assigned tasks",
            "Upload documents for Service Center-specific steps",
        ],
        flow: [
            {
                title: "Support Assignment",
                description: "Assigned to a client to facilitate the onboarding process.",
            },
            {
                title: "Task Execution",
                description: "Complete specific Service Center tasks and upload internal docs.",
            },
            {
                title: "Client Assistance",
                description: "Guide the client through complex steps via messaging.",
            },
            {
                title: "Stage Progression",
                description: "Ensure all support tasks are cleared for stage advancement.",
            },
        ],
        faqs: [
            {
                question: "What if a client is stuck?",
                answer: "Use the messaging feature to reach out. You can also view their dashboard to see exactly which task is blocking progress.",
            },
            {
                question: "Can I move a client to the next stage?",
                answer: "Stage progression happens automatically once all required tasks are complete. Ensure all tasks in the current stage are checked off.",
            }
        ]
    },
};
