-- Migration: Add separate first name and last name columns for primary contact
-- Date: 2026-01-30
-- Description: Split primary_contact_name into primary_contact_first_name and primary_contact_last_name
-- The original primary_contact_name column is kept for backward compatibility and will be auto-populated

-- Add new columns for first name and last name
ALTER TABLE dbo.clients
ADD primary_contact_first_name NVARCHAR(100) NULL,
    primary_contact_last_name NVARCHAR(100) NULL;
GO

-- Migrate existing data: Split existing primary_contact_name into first and last name
-- This splits on the first space - first word becomes first name, rest becomes last name
UPDATE dbo.clients
SET 
    primary_contact_first_name = 
        CASE 
            WHEN CHARINDEX(' ', primary_contact_name) > 0 
            THEN LEFT(primary_contact_name, CHARINDEX(' ', primary_contact_name) - 1)
            ELSE primary_contact_name
        END,
    primary_contact_last_name = 
        CASE 
            WHEN CHARINDEX(' ', primary_contact_name) > 0 
            THEN LTRIM(SUBSTRING(primary_contact_name, CHARINDEX(' ', primary_contact_name) + 1, LEN(primary_contact_name)))
            ELSE ''
        END
WHERE primary_contact_name IS NOT NULL;
GO

-- Note: The original primary_contact_name column is kept
-- It will be auto-populated with "first_name + ' ' + last_name" in the application code
