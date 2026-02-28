-- Create Help Content Table for Legacy ClientHub
-- Run this script in your Azure SQL Database

-- Main Help Roles Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'help_roles')
BEGIN
    CREATE TABLE dbo.help_roles (
        role_id INT IDENTITY(1,1) PRIMARY KEY,
        role_key NVARCHAR(50) NOT NULL UNIQUE,  -- ADMIN, CLIENT, CPA, SERVICE_CENTER
        title NVARCHAR(100) NOT NULL,
        description NVARCHAR(MAX) NOT NULL,
        icon_name NVARCHAR(50) NOT NULL DEFAULT 'HelpCircle',
        color_class NVARCHAR(100) NOT NULL DEFAULT 'text-blue-600 dark:text-blue-400',
        display_order INT NOT NULL DEFAULT 0,
        is_active BIT NOT NULL DEFAULT 1,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
    );
    PRINT 'Created table: help_roles';
END
GO

-- Responsibilities Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'help_responsibilities')
BEGIN
    CREATE TABLE dbo.help_responsibilities (
        responsibility_id INT IDENTITY(1,1) PRIMARY KEY,
        role_id INT NOT NULL FOREIGN KEY REFERENCES dbo.help_roles(role_id) ON DELETE CASCADE,
        description NVARCHAR(MAX) NOT NULL,
        display_order INT NOT NULL DEFAULT 0,
        created_at DATETIME2 DEFAULT GETDATE()
    );
    PRINT 'Created table: help_responsibilities';
END
GO

-- Process Flow Steps Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'help_flow_steps')
BEGIN
    CREATE TABLE dbo.help_flow_steps (
        step_id INT IDENTITY(1,1) PRIMARY KEY,
        role_id INT NOT NULL FOREIGN KEY REFERENCES dbo.help_roles(role_id) ON DELETE CASCADE,
        title NVARCHAR(200) NOT NULL,
        description NVARCHAR(MAX) NOT NULL,
        icon_name NVARCHAR(50) NULL,             -- Optional icon for visual flowchart
        step_type NVARCHAR(50) DEFAULT 'action', -- action, decision, start, end
        display_order INT NOT NULL DEFAULT 0,
        created_at DATETIME2 DEFAULT GETDATE()
    );
    PRINT 'Created table: help_flow_steps';
END
GO

-- FAQs Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'help_faqs')
BEGIN
    CREATE TABLE dbo.help_faqs (
        faq_id INT IDENTITY(1,1) PRIMARY KEY,
        role_id INT NOT NULL FOREIGN KEY REFERENCES dbo.help_roles(role_id) ON DELETE CASCADE,
        question NVARCHAR(500) NOT NULL,
        answer NVARCHAR(MAX) NOT NULL,
        display_order INT NOT NULL DEFAULT 0,
        created_at DATETIME2 DEFAULT GETDATE()
    );
    PRINT 'Created table: help_faqs';
END
GO

-- Insert Default Data for Admin Role
IF NOT EXISTS (SELECT 1 FROM dbo.help_roles WHERE role_key = 'ADMIN')
BEGIN
    INSERT INTO dbo.help_roles (role_key, title, description, icon_name, color_class, display_order)
    VALUES ('ADMIN', 'Admin', 'Full system access and administrative control. Oversees the entire onboarding lifecycle, manages users, configures stages, and monitors progress.', 'Shield', 'text-blue-600 dark:text-blue-400', 1);
    
    DECLARE @AdminRoleId INT = SCOPE_IDENTITY();
    
    -- Admin Responsibilities
    INSERT INTO dbo.help_responsibilities (role_id, description, display_order) VALUES
    (@AdminRoleId, 'Create and manage Client, Preparer, and Service Center profiles', 1),
    (@AdminRoleId, 'Configure onboarding stages and associated tasks', 2),
    (@AdminRoleId, 'Assign Preparer and Service Center to clients', 3),
    (@AdminRoleId, 'Monitor client onboarding progress via Dashboard', 4),
    (@AdminRoleId, 'Oversee documents, reports, communications, and audit logs', 5),
    (@AdminRoleId, 'Manage default stage templates for new clients', 6);
    
    -- Admin Flow Steps
    INSERT INTO dbo.help_flow_steps (role_id, title, description, icon_name, step_type, display_order) VALUES
    (@AdminRoleId, 'Login to Dashboard', 'Access the Admin Dashboard using your credentials. View overview statistics and pending items.', 'LogIn', 'start', 1),
    (@AdminRoleId, 'Create Client', 'Navigate to Clients menu and create a new client profile. System auto-generates login credentials.', 'UserPlus', 'action', 2),
    (@AdminRoleId, 'Assign Support Roles', 'Assign a Preparer and Service Center to the client for compliance and operational support.', 'Users', 'action', 3),
    (@AdminRoleId, 'Configure Onboarding Stages', 'Set up onboarding stages from templates or create custom stages for the client.', 'ListTodo', 'action', 4),
    (@AdminRoleId, 'Create & Assign Tasks', 'Add specific tasks under each stage with due dates and document requirements.', 'ClipboardList', 'action', 5),
    (@AdminRoleId, 'Monitor Progress', 'Track completion of tasks and stages via Dashboard. Review uploaded documents.', 'Activity', 'action', 6),
    (@AdminRoleId, 'Handle Communications', 'Monitor and participate in messaging between clients and support roles.', 'MessageSquare', 'action', 7),
    (@AdminRoleId, 'Complete Onboarding', 'Mark client onboarding as completed when all stages are finished.', 'CheckCircle', 'end', 8);
    
    -- Admin FAQs
    INSERT INTO dbo.help_faqs (role_id, question, answer, display_order) VALUES
    (@AdminRoleId, 'How do I reset a user''s password?', 'Go to the Client/Preparer/Service Center list in the Dashboard, select the user, and click ''Edit''. You can set a new temporary password there. Users can also reset their password through the Settings page after logging in.', 1),
    (@AdminRoleId, 'Can I delete a client?', 'Yes, but proceed with caution. Deleting a client removes all associated tasks, documents, messages, and history. This action cannot be undone. Consider deactivating the client instead if you may need the data later.', 2),
    (@AdminRoleId, 'How do I change the onboarding stages?', 'Navigate to the ''Onboarding Stages'' tab. You can reorder, add, or remove stages. Changes to default templates apply to future clients only. Existing clients retain their current stage configuration.', 3),
    (@AdminRoleId, 'How do I assign tasks to specific roles?', 'When creating or editing a task, use the ''Assigned To'' dropdown to select whether the task should be completed by the Client, Preparer, or Service Center. Each role will only see their assigned tasks.', 4),
    (@AdminRoleId, 'Can I create custom stage templates?', 'Yes! Go to Default Stage Templates under the admin menu. You can create reusable templates with predefined stages and tasks that can be quickly applied to new clients.', 5),
    (@AdminRoleId, 'How do I view the audit log?', 'Access the Reports section from the admin navigation. The audit log shows all system activities including user logins, task completions, document uploads, and configuration changes.', 6);
    
    PRINT 'Inserted Admin role data';
END
GO

-- Insert Default Data for Client Role
IF NOT EXISTS (SELECT 1 FROM dbo.help_roles WHERE role_key = 'CLIENT')
BEGIN
    INSERT INTO dbo.help_roles (role_key, title, description, icon_name, color_class, display_order)
    VALUES ('CLIENT', 'Client', 'The end-user organization undergoing the onboarding process. Complete tasks, upload documents, and communicate with support team.', 'User', 'text-green-600 dark:text-green-400', 2);
    
    DECLARE @ClientRoleId INT = SCOPE_IDENTITY();
    
    -- Client Responsibilities
    INSERT INTO dbo.help_responsibilities (role_id, description, display_order) VALUES
    (@ClientRoleId, 'Complete assigned onboarding tasks on time', 1),
    (@ClientRoleId, 'Upload all required documentation', 2),
    (@ClientRoleId, 'Communicate with assigned Preparer and Service Center', 3),
    (@ClientRoleId, 'Track onboarding progress through your Dashboard', 4),
    (@ClientRoleId, 'Respond to feedback and requests promptly', 5);
    
    -- Client Flow Steps
    INSERT INTO dbo.help_flow_steps (role_id, title, description, icon_name, step_type, display_order) VALUES
    (@ClientRoleId, 'Receive Credentials', 'You will receive login credentials (email and temporary password) from the Admin via email.', 'Mail', 'start', 1),
    (@ClientRoleId, 'First Login', 'Log in using provided credentials. Change your password in Settings for security.', 'LogIn', 'action', 2),
    (@ClientRoleId, 'View Dashboard', 'Access your Dashboard to see pending tasks, current stage, and overall progress.', 'LayoutDashboard', 'action', 3),
    (@ClientRoleId, 'Execute Tasks', 'Click on pending tasks to view details. Complete actions and upload required documents.', 'ClipboardCheck', 'action', 4),
    (@ClientRoleId, 'Upload Documents', 'For document-required tasks, upload files using drag-and-drop or file browser.', 'Upload', 'action', 5),
    (@ClientRoleId, 'Communicate', 'Use the messaging feature to contact your Preparer or Service Center if you need help.', 'MessageCircle', 'action', 6),
    (@ClientRoleId, 'Track Progress', 'Monitor your progress bar and stage timeline. Celebrate completed stages!', 'TrendingUp', 'action', 7),
    (@ClientRoleId, 'Complete Onboarding', 'Once all tasks and stages are complete, your onboarding is finished.', 'PartyPopper', 'end', 8);
    
    -- Client FAQs
    INSERT INTO dbo.help_faqs (role_id, question, answer, display_order) VALUES
    (@ClientRoleId, 'I forgot my password. What should I do?', 'Please contact your Admin or Service Center representative to request a password reset. They can set a new temporary password for you. Once logged in, go to Settings to change it to something memorable.', 1),
    (@ClientRoleId, 'Why is my task locked or disabled?', 'Some tasks may depend on completing previous tasks or stages first. This ensures the onboarding process follows the correct order. Check if there are earlier tasks that need completion, or if a required document upload is missing.', 2),
    (@ClientRoleId, 'How do I upload a document?', 'Click on the specific task that requires a document. You will see an upload area. Either drag and drop your file into the zone, or click to browse your computer. Supported formats include PDF, DOC, DOCX, XLS, XLSX, and common image formats.', 3),
    (@ClientRoleId, 'What file formats are supported?', 'You can upload PDF, Word documents (DOC, DOCX), Excel spreadsheets (XLS, XLSX), and images (JPG, PNG, GIF). Maximum file size is typically 25MB per file.', 4),
    (@ClientRoleId, 'How do I know when a task is due?', 'Each task displays its due date. Tasks approaching the deadline are highlighted, and overdue tasks appear in red. You can also see all your upcoming tasks on the Dashboard.', 5),
    (@ClientRoleId, 'Can I edit a completed task?', 'Once a task is marked as completed, you cannot edit it directly. If you need to make changes, contact your Preparer or Service Center to request the task be reopened.', 6),
    (@ClientRoleId, 'How do I contact my support team?', 'Use the Messages or Inbox feature to send secure messages to your assigned Preparer or Service Center. They can help with questions, clarifications, or issues with your tasks.', 7);
    
    PRINT 'Inserted Client role data';
END
GO

-- Insert Default Data for CPA Role
IF NOT EXISTS (SELECT 1 FROM dbo.help_roles WHERE role_key = 'CPA')
BEGIN
    INSERT INTO dbo.help_roles (role_key, title, description, icon_name, color_class, display_order)
    VALUES ('CPA', 'Preparer', 'Compliance and review role responsible for validating client tasks and documents. Ensure accuracy and regulatory compliance.', 'FileCheck', 'text-purple-600 dark:text-purple-400', 3);
    
    DECLARE @CpaRoleId INT = SCOPE_IDENTITY();
    
    -- CPA Responsibilities
    INSERT INTO dbo.help_responsibilities (role_id, description, display_order) VALUES
    (@CpaRoleId, 'Review client tasks and submitted documents for accuracy', 1),
    (@CpaRoleId, 'Upload documents for Preparer-specific assigned tasks', 2),
    (@CpaRoleId, 'Communicate with clients for validation and clarification', 3),
    (@CpaRoleId, 'Ensure compliance with regulatory requirements', 4),
    (@CpaRoleId, 'Provide feedback and approve completed work', 5);
    
    -- CPA Flow Steps
    INSERT INTO dbo.help_flow_steps (role_id, title, description, icon_name, step_type, display_order) VALUES
    (@CpaRoleId, 'Client Assignment', 'Receive notification when assigned to a new client. View client details in your Dashboard.', 'UserCheck', 'start', 1),
    (@CpaRoleId, 'Access Client List', 'Go to your assigned clients list to see all clients you are responsible for.', 'Users', 'action', 2),
    (@CpaRoleId, 'Review Tasks', 'Monitor client progress and review completed tasks requiring Preparer validation.', 'ClipboardCheck', 'action', 3),
    (@CpaRoleId, 'Validate Documents', 'Check uploaded documents for accuracy, completeness, and compliance.', 'FileSearch', 'action', 4),
    (@CpaRoleId, 'Complete Preparer Tasks', 'Execute tasks assigned specifically to the Preparer role and upload required documents.', 'FilePlus', 'action', 5),
    (@CpaRoleId, 'Provide Feedback', 'Message clients for corrections or additional information if needed.', 'MessageSquare', 'action', 6),
    (@CpaRoleId, 'Approve & Verify', 'Mark reviewed items as verified to allow stage progression.', 'CheckCircle', 'end', 7);
    
    -- CPA FAQs
    INSERT INTO dbo.help_faqs (role_id, question, answer, display_order) VALUES
    (@CpaRoleId, 'How do I approve a document?', 'Open the client''s task list, view the uploaded document by clicking on it, and review it for accuracy. If satisfactory, mark the task as ''Completed'' or ''Verified''. If changes are needed, message the client with specific feedback.', 1),
    (@CpaRoleId, 'Can I upload documents for the client?', 'Yes, Preparers can upload documents to client folders when necessary. This is typically done for Preparer-specific tasks. Navigate to the Documents tab or the specific task assigned to Preparer and use the upload feature.', 2),
    (@CpaRoleId, 'How do I reassign a task if needed?', 'Task reassignment must be done by an Admin. Contact your Admin if you believe a task should be assigned to a different role or another Preparer.', 3),
    (@CpaRoleId, 'What happens if I reject a document?', 'There is no formal rejection button. Instead, mark the task as ''In Progress'' if it was completed, and send a message to the client explaining what needs to be corrected. They will then re-upload the corrected document.', 4),
    (@CpaRoleId, 'How do I view all my assigned clients?', 'From your Dashboard, you can see a list of all clients assigned to you. Use filters to sort by status, stage, or urgency. Click on any client to see their full onboarding details.', 5),
    (@CpaRoleId, 'Can I communicate with other Preparers about a client?', 'Direct Preparer-to-Preparer messaging is not available in the system. For collaboration, contact your Admin who can facilitate information sharing or reassign clients as needed.', 6);
    
    PRINT 'Inserted CPA role data';
END
GO

-- Insert Default Data for Service Center Role
IF NOT EXISTS (SELECT 1 FROM dbo.help_roles WHERE role_key = 'SERVICE_CENTER')
BEGIN
    INSERT INTO dbo.help_roles (role_key, title, description, icon_name, color_class, display_order)
    VALUES ('SERVICE_CENTER', 'Service Center', 'Operational support role assisting clients through the onboarding journey. Provide guidance, complete support tasks, and ensure smooth progression.', 'Headphones', 'text-orange-600 dark:text-orange-400', 4);
    
    DECLARE @ScRoleId INT = SCOPE_IDENTITY();
    
    -- Service Center Responsibilities
    INSERT INTO dbo.help_responsibilities (role_id, description, display_order) VALUES
    (@ScRoleId, 'Provide operational support for assigned clients', 1),
    (@ScRoleId, 'Review and complete Service Center-assigned tasks', 2),
    (@ScRoleId, 'Upload documents for Service Center-specific steps', 3),
    (@ScRoleId, 'Guide clients through complex onboarding steps', 4),
    (@ScRoleId, 'Coordinate with Preparer for compliance matters', 5),
    (@ScRoleId, 'Ensure timely stage progression', 6);
    
    -- Service Center Flow Steps
    INSERT INTO dbo.help_flow_steps (role_id, title, description, icon_name, step_type, display_order) VALUES
    (@ScRoleId, 'Support Assignment', 'Get assigned to a client to facilitate their onboarding process.', 'UserPlus', 'start', 1),
    (@ScRoleId, 'Review Client Status', 'Check the client''s Dashboard to understand their current progress and needs.', 'LayoutDashboard', 'action', 2),
    (@ScRoleId, 'Execute Support Tasks', 'Complete tasks assigned specifically to Service Center role.', 'ClipboardList', 'action', 3),
    (@ScRoleId, 'Upload Internal Docs', 'Upload any required internal documents or forms to client''s folder.', 'Upload', 'action', 4),
    (@ScRoleId, 'Client Assistance', 'Guide clients through complex steps via secure messaging.', 'HelpCircle', 'action', 5),
    (@ScRoleId, 'Monitor Deadlines', 'Track task due dates and follow up with clients on pending items.', 'Clock', 'action', 6),
    (@ScRoleId, 'Ensure Stage Progression', 'Verify all support tasks are cleared to allow stage advancement.', 'ArrowRight', 'end', 7);
    
    -- Service Center FAQs
    INSERT INTO dbo.help_faqs (role_id, question, answer, display_order) VALUES
    (@ScRoleId, 'What if a client is stuck on a task?', 'Use the messaging feature to reach out to the client. Review their Dashboard to see exactly which task is blocking progress. Provide clear guidance on what they need to do. If the issue is technical, escalate to Admin.', 1),
    (@ScRoleId, 'Can I move a client to the next stage?', 'Stage progression happens automatically once all required tasks in the current stage are completed. Ensure all tasks (including Client, Preparer, and Service Center tasks) are checked off. If stages are still not progressing, contact Admin.', 2),
    (@ScRoleId, 'How do I escalate an issue?', 'For urgent issues, contact your Admin directly through the messaging system or via email. Provide details about the client, the specific issue, and any error messages encountered.', 3),
    (@ScRoleId, 'Can I see documents uploaded by other roles?', 'Yes, you can view all documents associated with your assigned clients through the Documents tab. This includes documents uploaded by the client, Preparer, and other Service Center representatives.', 4),
    (@ScRoleId, 'How do I handle overdue tasks?', 'Filter your task view to show overdue items. Reach out to the responsible party (client for their tasks, coordinate with Preparer for their tasks) to understand the delay and provide assistance.', 5),
    (@ScRoleId, 'Can I modify task due dates?', 'No, due date modifications must be done by Admin. If a due date extension is needed, request it from your Admin with justification.', 6),
    (@ScRoleId, 'How many clients can I be assigned?', 'There is no system limit on client assignments. Your Admin will manage workload distribution. If you''re overwhelmed, communicate with your Admin to discuss reassignments.', 7);
    
    PRINT 'Inserted Service Center role data';
END
GO

PRINT 'Help content tables and default data setup complete!';
