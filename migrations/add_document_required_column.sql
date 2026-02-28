-- Migration: Add document_required column to onboarding_tasks table
-- Date: 2026-01-08
-- Description: Adds optional document requirement flag for task completion

-- Check if column exists before adding
IF NOT EXISTS (
    SELECT 1 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'dbo' 
    AND TABLE_NAME = 'onboarding_tasks' 
    AND COLUMN_NAME = 'document_required'
)
BEGIN
    ALTER TABLE dbo.onboarding_tasks
    ADD document_required BIT NOT NULL DEFAULT 1;
    
    PRINT 'Column document_required added successfully to onboarding_tasks table.';
END
ELSE
BEGIN
    PRINT 'Column document_required already exists in onboarding_tasks table.';
END
GO

-- Update existing tasks to have document_required = 1 (true) for backward compatibility
-- This ensures all existing tasks still require document upload
UPDATE dbo.onboarding_tasks
SET document_required = 1
WHERE document_required IS NULL;
GO

PRINT 'Migration completed: document_required column is ready.';
