-- Migration: Add document_required fields to client_stages and client_stage_subtasks tables
-- Date: 2026-01-09
-- Description: This migration adds columns to track document requirements for onboarding stages and subtasks

-- =============================================
-- Add columns to client_stages table
-- =============================================

-- Add document_required column (indicates if the stage requires documents to complete)
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'client_stages' AND COLUMN_NAME = 'document_required'
)
BEGIN
    ALTER TABLE dbo.client_stages
    ADD document_required BIT DEFAULT 0;
    PRINT 'Added document_required column to client_stages table';
END
ELSE
BEGIN
    PRINT 'Column document_required already exists in client_stages table';
END
GO

-- Add document_mode column ('stage' = one doc for whole stage, 'subtask' = each subtask needs its own doc)
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'client_stages' AND COLUMN_NAME = 'document_mode'
)
BEGIN
    ALTER TABLE dbo.client_stages
    ADD document_mode NVARCHAR(20) DEFAULT 'stage';
    PRINT 'Added document_mode column to client_stages table';
END
ELSE
BEGIN
    PRINT 'Column document_mode already exists in client_stages table';
END
GO

-- =============================================
-- Add columns to client_stage_subtasks table
-- =============================================

-- Add document_required column (for per-subtask document requirements)
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'client_stage_subtasks' AND COLUMN_NAME = 'document_required'
)
BEGIN
    ALTER TABLE dbo.client_stage_subtasks
    ADD document_required BIT DEFAULT 0;
    PRINT 'Added document_required column to client_stage_subtasks table';
END
ELSE
BEGIN
    PRINT 'Column document_required already exists in client_stage_subtasks table';
END
GO

-- =============================================
-- Verification Query
-- =============================================
SELECT 
    c.TABLE_NAME,
    c.COLUMN_NAME,
    c.DATA_TYPE,
    c.COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS c
WHERE c.TABLE_NAME IN ('client_stages', 'client_stage_subtasks')
    AND c.COLUMN_NAME IN ('document_required', 'document_mode')
ORDER BY c.TABLE_NAME, c.COLUMN_NAME;
