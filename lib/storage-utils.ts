import { supabase } from "@/lib/db";

// Helper to sanitize name for folder use (allow only alphanumeric, space, hyphens, underscores)
function sanitizeForFolder(name: string): string {
    return name
        .replace(/[^a-zA-Z0-9 \-_]/g, "") // Keep only safe chars
        .trim()
        .replace(/\s+/g, " "); // Collapse spaces
}

/**
 * Returns the client's root folder name.
 * Default: "client-{id}"
 * Logic: Query Supabase for client_name. If found, use "{CleanName}-{id}".
 *        If not found or error, fallback to "client-{id}".
 * 
 * Note: This does NOT check if the bucket/folder exists.
 *       It only generates the EXPECTED path prefix.
 */
export async function getClientRootFolder(clientId: number | string): Promise<string> {
    const id = Number(clientId);
    if (!id || isNaN(id)) return `client-${clientId}`; // Fallback

    try {
        const { data, error } = await supabase
            .from("Clients")
            .select("client_name")
            .eq("client_id", id)
            .maybeSingle();

        if (error) throw error;

        const name = data?.client_name;

        if (name) {
            const cleanName = sanitizeForFolder(name);
            if (cleanName) {
                return `${cleanName}-${id}`;
            }
        }
    } catch (err) {
        console.error("Error fetching client name for folder:", err);
    }

    return `client-${id}`;
}
