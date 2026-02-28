-- Create Email Logs Table for Admin Email Activity Tracking
-- This table logs all system-generated emails for audit and troubleshooting

CREATE TABLE dbo.email_logs (
    id INT IDENTITY(1,1) PRIMARY KEY,
    
    -- Recipient information
    recipient_email NVARCHAR(255) NOT NULL,
    recipient_name NVARCHAR(255) NULL,
    recipient_role NVARCHAR(50) NULL,  -- CLIENT, CPA, SERVICE_CENTER, or NULL for general
    
    -- Related entity (if applicable)
    related_entity_type NVARCHAR(50) NULL,  -- client, cpa, service_center
    related_entity_id INT NULL,
    related_entity_name NVARCHAR(255) NULL,
    
    -- Email details
    email_type NVARCHAR(100) NOT NULL,  -- welcome, task_notification, message_notification, etc.
    email_subject NVARCHAR(500) NOT NULL,
    email_body_preview NVARCHAR(MAX) NULL,  -- HTML preview of the email (truncated if needed)
    
    -- Status tracking
    status NVARCHAR(50) NOT NULL DEFAULT 'Pending',  -- Pending, Sent, Delivered, Failed, Unknown
    status_message NVARCHAR(MAX) NULL,  -- Error message or delivery confirmation
    
    -- Azure Communication Services tracking
    acs_message_id NVARCHAR(255) NULL,  -- Message ID from Azure Communication Services
    
    -- Resend tracking
    original_email_id INT NULL,  -- If this is a resent email, reference to original
    resend_count INT DEFAULT 0,
    last_resent_at DATETIME2 NULL,
    resent_by NVARCHAR(255) NULL,  -- Email of admin who triggered resend
    
    -- Timestamps
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    sent_at DATETIME2 NULL,
    delivered_at DATETIME2 NULL,
    
    -- Metadata as JSON for additional info
    metadata NVARCHAR(MAX) NULL,
    
    -- Indexes for filtering
    INDEX IX_email_logs_recipient_email (recipient_email),
    INDEX IX_email_logs_recipient_role (recipient_role),
    INDEX IX_email_logs_email_type (email_type),
    INDEX IX_email_logs_status (status),
    INDEX IX_email_logs_created_at (created_at DESC)
);

-- Add comments
EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'Logs all system-generated emails for admin visibility and audit trail',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'email_logs';

PRINT 'Email logs table created successfully!';
