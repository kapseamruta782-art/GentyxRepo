
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function getEnv() {
    const envPath = path.resolve(process.cwd(), '.env.local');
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');
    const env = {};
    lines.forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            env[match[1]] = (match[2] || "").trim();
        }
    });
    return env;
}

const env = getEnv();
const supabaseUrl = env['SUPABASE_URL'];
const supabaseServiceKey = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function ensureBucket() {
    const BUCKET_NAME = "documents";
    console.log(`Checking bucket: ${BUCKET_NAME}`);

    try {
        const { data: buckets, error: listError } = await supabase.storage.listBuckets();
        if (listError) {
            console.error("Error listing buckets:", listError);
            return;
        }

        const exists = buckets.some(b => b.name === BUCKET_NAME);
        if (exists) {
            console.log(`Bucket "${BUCKET_NAME}" already exists.`);
        } else {
            console.log(`Bucket "${BUCKET_NAME}" not found. Creating...`);
            // Try with minimal options first
            const { data, error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
                public: true
            });

            if (createError) {
                console.error("Error creating bucket:", createError);
                process.exit(1);
            } else {
                console.log(`Bucket "${BUCKET_NAME}" created successfully:`, data);
            }
        }
    } catch (err) {
        console.error("Unexpected error:", err);
        process.exit(1);
    }
}

ensureBucket();
