const sql = require('mssql');
const fs = require('fs');
const path = require('path');

// Load env
const envPath = path.resolve(__dirname, '../.env.local');
if (!fs.existsSync(envPath)) {
    console.error(".env.local file not found at " + envPath);
    process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2 && !line.trim().startsWith('#')) {
        const key = parts[0].trim();
        let value = parts.slice(1).join('=').trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        process.env[key] = value;
    }
});

const config = {
    user: process.env.AZURE_SQL_USERNAME,
    password: process.env.AZURE_SQL_PASSWORD,
    server: process.env.AZURE_SQL_SERVER,
    database: process.env.AZURE_SQL_DATABASE,
    options: {
        encrypt: true,
        trustServerCertificate: true
    },
};

async function run() {
    try {
        console.log(`Connecting to DB ${config.server}/${config.database} as ${config.user}...`);
        const pool = await sql.connect(config);
        console.log("Connected.");

        // ===== 1. Service Center Users Table =====
        const scUsersTableExists = await pool.query(`
            SELECT * FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = 'dbo' 
            AND TABLE_NAME = 'service_center_users'
        `);

        if (scUsersTableExists.recordset.length === 0) {
            console.log("Creating service_center_users table...");
            await pool.query(`
                CREATE TABLE dbo.service_center_users (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    service_center_id INT NOT NULL,
                    user_name NVARCHAR(255) NOT NULL,
                    email NVARCHAR(255) NOT NULL,
                    role NVARCHAR(100) DEFAULT 'User',
                    phone NVARCHAR(50),
                    created_at DATETIME DEFAULT GETDATE(),
                    updated_at DATETIME DEFAULT GETDATE(),
                    CONSTRAINT FK_ServiceCenterUsers_ServiceCenters 
                        FOREIGN KEY (service_center_id) 
                        REFERENCES dbo.service_centers(service_center_id) 
                        ON DELETE CASCADE
                );
            `);
            console.log("✅ Table service_center_users created successfully.");
        } else {
            console.log("Table service_center_users already exists.");
        }

        // ===== 2. Update client_users table to add phone and updated_at if missing =====
        const clientUsersColumns = await pool.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'client_users'
        `);

        const existingColumns = clientUsersColumns.recordset.map(r => r.COLUMN_NAME.toLowerCase());

        if (!existingColumns.includes('phone')) {
            console.log("Adding phone column to client_users...");
            await pool.query(`ALTER TABLE dbo.client_users ADD phone NVARCHAR(50)`);
            console.log("✅ Added phone column to client_users.");
        }

        if (!existingColumns.includes('updated_at')) {
            console.log("Adding updated_at column to client_users...");
            await pool.query(`ALTER TABLE dbo.client_users ADD updated_at DATETIME DEFAULT GETDATE()`);
            console.log("✅ Added updated_at column to client_users.");
        }

        console.log("\n✅ All migrations completed successfully!");
        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

run();
