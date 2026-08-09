import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabaseInstance: SupabaseClient | null = null;
function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error("Faltan variables de entorno SUPABASE_URL o SUPABASE_KEY. Copie .env.example a .env y rellénelos.");
    }
    try {
      supabaseInstance = createClient(url, key);
      console.log("Cliente Supabase creado exitosamente.");
    } catch (error) {
      console.error("Error al crear el cliente Supabase:", error);
      throw error;
    }
  }
  return supabaseInstance;
}

export { getSupabaseClient };
