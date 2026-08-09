import { getSupabaseClient } from "../supabaseConnect/supabaseConnectClient";
import { updateLastGameRegistered } from "./updateLastGameRegistered";
import { markSyncResolved } from "./syncState";
const supabase = getSupabaseClient();

export async function GameSync(games: any[], id: string) {
    if (!Array.isArray(games) || games.length === 0) {
        console.warn(`[AVISO] GameSync para mesa ${id} sin juegos válidos (array vacío o formato incorrecto). Se ignora.`);
        return;
    }

    console.log(`GameSync recibido: mesa ${id}, ${games.length} juegos`);

    const { data: tableRow, error: tableError } = await supabase.from("table_table").select("id").eq("id", id).maybeSingle();
    if (tableError) {
        console.error(`Error al verificar la mesa ${id} en table_table:`, tableError);
        return;
    }
    if (!tableRow) {
        console.warn(`[AVISO] Mesa ${id} no existe en table_table. Se ignoran los juegos de GameSync. Registrá/configurá la mesa antes.`);
        return;
    }

    const gamesToInsert = games.map((game) => {
        const createdDate = new Date(game.createdAt);

        return {
            created_at: new Date(game.createdAt).getTime(),
            updated_at: new Date(game.updatedAt).getTime(),
            workday: createdDate.toISOString().split("T")[0],
            game_number: game.gameNumber,
            win_number: game.winNumber,
            rpm: game.rpm,
            open_table: game.openTable,
            clockwise: game.clockwise,
            enabled: game.enabled,
            fk_croupier: game.croupierId,
            fk_table: id,
        };
    });

    const gameNumbers = gamesToInsert.map((game) => game.game_number);
    const minGame = Math.min(...gameNumbers);
    const maxGame = Math.max(...gameNumbers);
    console.log(`Insertando ${gamesToInsert.length} juegos en game_table (mesa ${id}, game_number ${minGame}..${maxGame})`);

    try {
        const { error: errorGamesInsertedToSync } = await supabase.rpc("insertar_juegos", {
            j: gamesToInsert.reverse(), //--> invertimos el orden de los juegos para que el más reciente sea el primero en la lista
        });
        if (errorGamesInsertedToSync) {
            console.error("Error al INSERTAR juegos en game_table:", errorGamesInsertedToSync, "...upserteando datos");
            const { data: gamesUpsertedToSync, error: errorGamesUpsertedToSync } = await supabase.from("game_table").upsert(gamesToInsert, { onConflict: "workday,fk_table,created_at,game_number" }).select();
            if (errorGamesUpsertedToSync) {
                console.error("Error al UPSERTAR juegos en game_table:", errorGamesUpsertedToSync);
            } else {
                console.log(`Juegos upserteados en game_table: ${gamesUpsertedToSync.length} (mesa ${id})`);
                await updateLastGameRegistered(Number(id), maxGame);
                markSyncResolved(Number(id));
            }
            return;
        } else {
            console.log(`Juegos insertados correctamente en game_table: ${gamesToInsert.length} (mesa ${id})`);
            await updateLastGameRegistered(Number(id), maxGame);
            markSyncResolved(Number(id));
        }
    } catch (error) {
        console.error("Error inesperado al insertar juegos:", error);
    }
}
