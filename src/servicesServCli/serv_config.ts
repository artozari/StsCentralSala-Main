import "dotenv/config";
import { getSupabaseClient } from "../supabaseConnect/supabaseConnectClient";
import { topicSrvConfig } from "../mqttConnect/connectorMqtt";
import { publicarDatos } from "../utils";

const supabase = getSupabaseClient();

async function ConfigMessage(inFkConfigTable: any, inIdTable: any): Promise<void> {
    console.log("Datos de configuración en Raw:", `fk_config: ${typeof inFkConfigTable}`, inFkConfigTable, `id_table: ${typeof inIdTable}`, inIdTable);

    const { data: outFkConfigTable, error: errorOutFkConfigTable } = await supabase.from("table_table").select("*").eq("id", inIdTable).maybeSingle();

    if (errorOutFkConfigTable) {
        console.error("Error al obtener datos de table_table:", errorOutFkConfigTable);
        return;
    }

    if (!outFkConfigTable?.fk_config) {
        console.log("out_fk_config_table es indefinido o null");
        return;
    }

    if (inFkConfigTable === null || inFkConfigTable < outFkConfigTable.fk_config) {
        publicarDatos(topicSrvConfig, outFkConfigTable);
    } else {
        console.log("No se envía nada porque in_fk_config_table es mayor o igual a out_fk_config_table");
    }
}

export { ConfigMessage };
