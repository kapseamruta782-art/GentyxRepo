const sql = require('mssql');
const fs = require('fs');
const path = require('path');

// Load env
const envPath = path.resolve(__dirname, '../.env.local');
// Handle case where file doesn't exist or is empty
if (!fs.existsSync(envPath)) {
    console.error(".env.local file not found at " + envPath);
    process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
    // Basic .env parsing
    const parts = line.split('=');
    if (parts.length >= 2 && !line.trim().startsWith('#')) {
        const key = parts[0].trim();
        // Handle values that might contain =
        let value = parts.slice(1).join('=').trim();
        // Remove quotes if present
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

        const tableExists = await pool.query(`
            SELECT * FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = 'dbo' 
            AND TABLE_NAME = 'client_users'
        `);

        if (tableExists.recordset.length === 0) {
            console.log("Creating client_users table...");
            await pool.query(`
                CREATE TABLE dbo.client_users (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    client_id INT NOT NULL,
                    user_name NVARCHAR(255),
                    email NVARCHAR(255),
                    role NVARCHAR(50),
                    created_at DATETIME DEFAULT GETDATE(),
                    CONSTRAINT FK_ClientUsers_Clients FOREIGN KEY (client_id) REFERENCES dbo.clients(client_id) ON DELETE CASCADE
                );
            `);
            console.log("Table client_users created successfully.");
        } else {
            console.log("Table client_users already exists.");
        }

        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

run();
