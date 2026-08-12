import { getSupabaseClient } from "../supabaseConnect/supabaseConnectClient";

const supabase = getSupabaseClient();

export interface ResolvedTable {
    id: number;
    fk_casino: number | null;
    table_number: number | null;
    [key: string]: unknown;
}

/**
 * Devuelve la fila de table_table correspondiente a un casino + número de mesa.
 * El número de mesa llega como último segmento del tópico (p.ej. "15" en STS-MESAS/game/15),
 * pero el id real en Supabase se resuelve por (casino_code -> fk_casino, table_number).
 */
export async function resolveTableByCasinoAndNumber(casinoCode: string, tableNumber: string | number): Promise<ResolvedTable | null> {
    try {
        const { data: casino, error: casinoError } = await supabase
            .from("casino_table")
            .select("id")
            .eq("casino_code", casinoCode)
            .maybeSingle();

        if (casinoError) {
            console.error(`[resolveTable] Error al buscar casino ${casinoCode}:`, casinoError);
            return null;
        }
        if (!casino) {
            console.warn(`[resolveTable] No existe casino con casino_code "${casinoCode}" en casino_table.`);
            return null;
        }

        const { data: table, error: tableError } = await supabase
            .from("table_table")
            .select("*")
            .eq("fk_casino", casino.id)
            .eq("table_number", Number(tableNumber))
            .maybeSingle();

        if (tableError) {
            console.error(`[resolveTable] Error al buscar mesa ${tableNumber} del casino ${casinoCode}:`, tableError);
            return null;
        }
        if (!table) {
            console.warn(`[resolveTable] No existe mesa ${tableNumber} para el casino ${casinoCode} (fk_casino=${casino.id}) en table_table.`);
            return null;
        }

        return table as ResolvedTable;
    } catch (error) {
        console.error(`[resolveTable] Error inesperado resolviendo mesa ${tableNumber} del casino ${casinoCode}:`, error);
        return null;
    }
}

/**
 * Devuelve la fila de table_table correspondiente a un casino + id de mesa.
 * Usado por mensajes que ya traen el id real de la mesa (p.ej. Config).
 */
export async function resolveTableByCasinoAndId(casinoCode: string, tableId: string | number): Promise<ResolvedTable | null> {
    try {
        const { data: casino, error: casinoError } = await supabase
            .from("casino_table")
            .select("id")
            .eq("casino_code", casinoCode)
            .maybeSingle();

        if (casinoError) {
            console.error(`[resolveTable] Error al buscar casino ${casinoCode}:`, casinoError);
            return null;
        }
        if (!casino) {
            console.warn(`[resolveTable] No existe casino con casino_code "${casinoCode}" en casino_table.`);
            return null;
        }

        const { data: table, error: tableError } = await supabase
            .from("table_table")
            .select("*")
            .eq("fk_casino", casino.id)
            .eq("id", Number(tableId))
            .maybeSingle();

        if (tableError) {
            console.error(`[resolveTable] Error al buscar mesa id=${tableId} del casino ${casinoCode}:`, tableError);
            return null;
        }
        if (!table) {
            console.warn(`[resolveTable] No existe mesa id=${tableId} para el casino ${casinoCode} en table_table.`);
            return null;
        }

        return table as ResolvedTable;
    } catch (error) {
        console.error(`[resolveTable] Error inesperado resolviendo mesa id=${tableId} del casino ${casinoCode}:`, error);
        return null;
    }
}
