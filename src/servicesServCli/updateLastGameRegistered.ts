import { getSupabaseClient } from "../supabaseConnect/supabaseConnectClient";

const supabase = getSupabaseClient();

export async function updateLastGameRegistered(fk_table: string | number, game_number: number): Promise<void> {
    const { error } = await supabase
        .from("table_table")
        .update({ last_game_registered: game_number })
        .eq("id", fk_table)
        .lt("last_game_registered", game_number);

    if (error) {
        console.error("Error al actualizar last_game_registered en table_table:", error);
    }
}
