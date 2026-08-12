import "dotenv/config";
import { getSupabaseClient } from "../supabaseConnect/supabaseConnectClient";
import { publicarDatos } from "../utils";
import { resolveTableByCasinoAndNumber, resolveTableByCasinoAndId, type ResolvedTable } from "./resolveTable";
import type { CasinoClient } from "../mqttConnect/connectorMqtt";

const supabase = getSupabaseClient();

async function ConfigMessage(casino: CasinoClient, inFkConfigTable: any, inIdTable: any): Promise<void> {
    console.log("Datos de configuración en Raw:", `fk_config: ${typeof inFkConfigTable}`, inFkConfigTable, `id_table: ${typeof inIdTable}`, inIdTable);

    // Resolver la mesa real por casino. Primero se intenta por número de mesa,
    // y si no existe, por id real de table_table.
    let resolved: ResolvedTable | null = await resolveTableByCasinoAndNumber(casino.casinoCode, inIdTable);
    if (!resolved) {
        resolved = await resolveTableByCasinoAndId(casino.casinoCode, inIdTable);
    }
    if (!resolved) {
        console.warn(`[AVISO] Mesa ${inIdTable} no resuelta en el casino ${casino.casinoCode}. Se ignora la configuración.`);
        return;
    }

    const { data: outFkConfigTable, error: errorOutFkConfigTable } = await supabase.from("table_table").select("*").eq("id", resolved.id).maybeSingle();

    if (errorOutFkConfigTable) {
        console.error("Error al obtener datos de table_table:", errorOutFkConfigTable);
        return;
    }

    if (!outFkConfigTable?.fk_config) {
        console.log("out_fk_config_table es indefinido o null");
        return;
    }

    if (inFkConfigTable === null || inFkConfigTable < outFkConfigTable.fk_config) {
        publicarDatos(casino.client, casino.topicSrvConfig, outFkConfigTable);
    } else {
        console.log("No se envía nada porque in_fk_config_table es mayor o igual a out_fk_config_table");
    }
}

export { ConfigMessage };
