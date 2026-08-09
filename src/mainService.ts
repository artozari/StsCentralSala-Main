import { getSupabaseClient } from "./supabaseConnect/supabaseConnectClient";
import { client, topicSrvConfig } from "./mqttConnect/connectorMqtt";
import { GameMessage } from "./servicesServCli/serv_game";
import { ConfigMessage } from "./servicesServCli/serv_config";
import { publicarDatos } from "./utils";
import { GameSync } from "./servicesServCli/game_sync";
import { startPartitionManager } from "./servicesServCli/partitionManager";

const supabase = getSupabaseClient();

client.on("message", async (topic: string, message: Buffer) => {
    const topicParts = topic.split("/");
    const topicLevel = topicParts.at(-1);
    const messageStr = message.toString().trim();

    console.log(topic?.substring(0, 200));
    
    // Validar que el mensaje no esté vacío
    if (!messageStr || messageStr.length === 0) {
        console.log(`[WARN] Mensaje vacío recibido en topic: ${topic}`);
        return;
    }

    try {
        if (topicLevel === "Config") {
            console.log("\x1b[30m\x1b[41m" + "Config" + "\x1b[0m");
            const { fk_config: inFkConfigTable, id_table: inIdTable } = JSON.parse(messageStr);
            await ConfigMessage(inFkConfigTable, inIdTable);
        } else if (topicParts.at(-3) === "STS-MESAS" && topicParts.at(-2) === "GameSync" && typeof Number(topicLevel) === "number") {
            console.log("\x1b[30m\x1b[48;5;22m" + "GameSync" + "\x1b[0m");
            const games = JSON.parse(messageStr);
            await GameSync(games, topicLevel!.toString());
        } else if (topicParts.at(-2) === "game" && typeof Number(topicLevel) === "number") {
            console.log("\x1b[30m\x1b[43m" + "Game" + "\x1b[0m");
            const gameData = JSON.parse(messageStr);
            await GameMessage(gameData, topicLevel!.toString());
        }
    } catch (error) {
        console.error(`[ERROR] Fallo al parsear JSON en topic ${topic}:`, error instanceof Error ? error.message : error);
        console.error(`[DEBUG] Contenido del mensaje:`, messageStr.substring(0, 100),"...etc");
    }
});

const configInterval = setInterval(() => {
    publicarDatos(topicSrvConfig, { info: "Servicio de configuración activo...", timestamp: new Date().toISOString() });
}, 15000);

startPartitionManager();

const channels = supabase
    .channel("custom-all-channel")
    .on("postgres_changes", { event: "*", schema: "public", table: "config_table" }, (payload) => {
        publicarDatos(topicSrvConfig, payload);
    })
    .subscribe();

process.on("SIGINT", () => {
    console.log("SIGINT recibido. Deteniendo el proceso...");
    clearInterval(configInterval);
    channels.unsubscribe();
    console.log("Intervalo de configuración detenido y suscripción al canal de Supabase cancelada.");
    process.exit();
});
