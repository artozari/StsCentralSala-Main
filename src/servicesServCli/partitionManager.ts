import cron from "node-cron";
import { getSupabaseClient } from "../supabaseConnect/supabaseConnectClient";

const supabase = getSupabaseClient();

function toDateString(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export async function ensureGameTablePartition(monthDate: Date): Promise<void> {
    const targetMonth = toDateString(monthDate);
    const { error } = await supabase.rpc("create_game_table_partition", { target_month: targetMonth });
    if (error) {
        console.error(`Error al crear/verificar la partición de game_table para ${targetMonth}:`, error);
    } else {
        console.log(`Partición de game_table garantizada para el mes ${targetMonth}.`);
    }
}

function ensureNextMonthPartition(): void {
    const now = new Date();
    if (now.getDate() >= 25) {
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        console.log("Mes próximo a finalizar: creando partición del mes siguiente...");
        ensureGameTablePartition(nextMonth);
    }
}

export function startPartitionManager(): void {
    const now = new Date();
    ensureGameTablePartition(new Date(now.getFullYear(), now.getMonth(), 1));
    ensureNextMonthPartition();
    cron.schedule("0 0 * * *", () => {
        const current = new Date();
        ensureGameTablePartition(new Date(current.getFullYear(), current.getMonth(), 1));
        ensureNextMonthPartition();
    });
}
