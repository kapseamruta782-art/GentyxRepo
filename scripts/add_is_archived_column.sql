-- ============================================
-- SQL SCRIPT: Add is_archived column to Clients table
-- Purpose: Enable archive/restore functionality for clients
-- ============================================

-- Step 1: Check if the column already exists, if not add it
IF NOT EXISTS (
    SELECT 1 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Clients' 
    AND COLUMN_NAME = 'is_archived'
)
BEGIN
    -- Add the is_archived column with default value of 0 (not archived / active)
    ALTER TABLE dbo.Clients 
    ADD is_archived BIT NOT NULL DEFAULT 0;
    
    PRINT 'Column [is_archived] added to Clients table successfully.';
END
ELSE
BEGIN
    PRINT 'Column [is_archived] already exists in Clients table.';
END

GO

-- ============================================
-- Optional: Create an index for faster filtering by archive status
-- ============================================
IF NOT EXISTS (
    SELECT 1 
    FROM sys.indexes 
    WHERE name = 'IX_Clients_IsArchived' 
    AND object_id = OBJECT_ID('dbo.Clients')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_Clients_IsArchived 
    ON dbo.Clients (is_archived) 
    INCLUDE (client_id, client_name);
    
    PRINT 'Index [IX_Clients_IsArchived] created successfully.';
END
ELSE
BEGIN
    PRINT 'Index [IX_Clients_IsArchived] already exists.';
END

GO

-- ============================================
-- Verify the column was added
-- ============================================
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    IS_NULLABLE, 
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'Clients' 
AND COLUMN_NAME = 'is_archived';

-- ============================================
-- Show current archive status of all clients (for verification)
-- ============================================
SELECT 
    client_id, 
    client_name, 
    is_archived,
    CASE WHEN is_archived = 1 THEN 'Inactive' ELSE 'Active' END AS status_display
FROM dbo.Clients
ORDER BY client_name;
