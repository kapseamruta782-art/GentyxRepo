-- Migration: Add notifications_enabled column to AdminSettings
-- This allows admins to enable/disable receiving email notifications

-- Add the notifications_enabled column to AdminSettings if it doesn't exist
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'AdminSettings' 
    AND COLUMN_NAME = 'notifications_enabled'
)
BEGIN
    ALTER TABLE dbo.AdminSettings
    ADD notifications_enabled BIT NOT NULL DEFAULT 1;
    
    PRINT 'Added notifications_enabled column to AdminSettings table';
END
ELSE
BEGIN
    PRINT 'Column notifications_enabled already exists in AdminSettings table';
END
GO

-- Update existing admins to have notifications enabled by default
UPDATE dbo.AdminSettings 
SET notifications_enabled = 1 
WHERE notifications_enabled IS NULL;
GO

-- Verify the column was added
SELECT 
    id,
    full_name,
    email,
    notifications_enabled
FROM dbo.AdminSettings;
GO
