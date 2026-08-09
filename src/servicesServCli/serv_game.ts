import "dotenv/config";

import { getSupabaseClient } from "../supabaseConnect/supabaseConnectClient";
import { client, topicSrvGame } from "../mqttConnect/connectorMqtt";
import { log } from "node:console";
import { get } from "node:http";
import { updateLastGameRegistered } from "./updateLastGameRegistered";
import {
    isSyncRequestAllowed,
    markSyncRequested,
    markSyncResolved,
    shouldAlertPendingSync,
    getPendingSyncInfo,
    SYNC_CONFIG,
} from "./syncState";
const supabase = getSupabaseClient();

async function GameMessage(gameData: any, topic: string): Promise<void> {
    const createdAt = gameData.createdAt ? new Date(gameData.createdAt) : new Date();
    const getInGamesFromTable = {
        created_at: createdAt.getTime(),
        updated_at: gameData.updatedAt ? new Date(gameData.updatedAt).getTime() : createdAt.getTime(),
        workday: createdAt.toISOString().split("T")[0],
        game_number: gameData.gameNumber,
        win_number: gameData.winNumber,
        rpm: gameData.rpm,
        open_table: gameData.openTable || null,
        clockwise: gameData.clockwise,
        enabled: gameData.enabled || null,
        fk_croupier: gameData.croupierId,
        // La mesa real se toma del tópico (último segmento de "SimuSts/STS-Casino/Cli/game/<idMesa>").
        // gameData.tableId NO es confiable: cada máquina reporta su id local (siempre 1).
        fk_table: topic || gameData.tableId,
    };

    const { data: lastResgistredGameFromSalaOnTableTable, error: errorLastGameResgistre } = await supabase.from("table_table").select("*").eq("id", getInGamesFromTable.fk_table).order("id", { ascending: false }).maybeSingle();

    if (errorLastGameResgistre) {
        console.error("Error al obtener last_game_registered de table_table:", errorLastGameResgistre);
        return;
    }

    if (!lastResgistredGameFromSalaOnTableTable) {
        console.warn(`[AVISO] Mesa ${getInGamesFromTable.fk_table} no existe en table_table. Se ignora el juego. Registrá/configurá la mesa antes de recibir sus jugadas.`);
        return;
    }

    const fkTable = Number(getInGamesFromTable.fk_table);
    const lastRegisteredGame = lastResgistredGameFromSalaOnTableTable?.last_game_registered ?? 0;

    // La diferencia se calcula contra last_game_registered (último juego registrado/contiguo de la mesa),
    // no contra el máximo real en game_table. Así, una mesa configurada con last_game_registered = 4913
    // espera que el próximo juego sea el 4914 y lo inserta directo, como si ya tuviera las jugadas previas.
    const diff = getInGamesFromTable.game_number - lastRegisteredGame;

    if (diff >= 2) {
        //==> si hay juegos faltantes en la mesa
        console.log(getInGamesFromTable.game_number, "juego entrante");
        console.log("hay juegos faltantes (diff >= 2). Solo se solicitan los juegos faltantes; el juego entrante se insertará cuando llegue en la respuesta GameSync.");

        requestMissingGamesInSala(fkTable, lastRegisteredGame);
        return;
    }

    if (diff === 0) {
        console.log("Juego ya registrado (duplicado). Se ignora.");
        return;
    }

    if (diff < 0) {
        console.log("Juego fuera de orden o ya registrado (game_number anterior al último registrado). Se ignora.");
        return;
    }

    // diff === 1: es exactamente el siguiente juego esperado de la mesa
    try {
        console.log(getInGamesFromTable.game_number, "juego entrante (siguiente esperado)");

        const inserted = await insertGame(getInGamesFromTable);
        if (inserted) {
            await updateLastGameRegistered(fkTable, getInGamesFromTable.game_number);
            markSyncResolved(fkTable);
            console.log("ingresado");
        }
    } catch (error) {
        console.error("Error al insertar juego en game_table:", error);
    }
}

async function insertGame(getGamesInTable: object): Promise<boolean> {
    // const { data: insertedGame, error: errorInsertedGame } = await supabase.from("game_table").insert(getGamesInTable).select();
    const datas = { j: [getGamesInTable] };
    let { data: insertedGame, error: errorInsertedGame } = await supabase.rpc("insertar_juegos", {
        j: datas.j,
    });
    if (errorInsertedGame) {
        console.error(" Error al insertar juego en game_table:", errorInsertedGame);
        return false;
    } else {
        // console.log(" Juego insertado correctamente en game_table:", insertedGame);
        return true;
    }
}
function requestMissingGamesInSala(fk_table: number, lastRegisteredGame: number): void {
    if (!client.connected) {
        console.error("Cliente MQTT no está conectado. No se puede publicar solicitud de juegos faltantes.");
        return;
    }

    const now = Date.now();

    // (d) alerta si la sincronización lleva demasiado tiempo sin resolverse
    if (shouldAlertPendingSync(fk_table, now)) {
        const info = getPendingSyncInfo(fk_table, now);
        const segundos = info ? Math.round(info.timePendingMs / 1000) : 0;
        console.error(`[ALERTA] Mesa ${fk_table}: la sincronización de juegos faltantes lleva ${segundos}s sin resolverse (último juego contiguo: ${lastRegisteredGame}). Se reintenta la solicitud.`);
    }

    // (b) cooldown: no saturar el broker re-pidiendo en cada juego mientras no respondan
    if (!isSyncRequestAllowed(fk_table, now)) {
        console.log(`Mesa ${fk_table}: solicitud de juegos faltantes omitida (cooldown de ${SYNC_CONFIG.cooldownMs / 1000}s activo).`);
        return;
    }

    console.log("\x1b[1;33;47m" + "Solicitud de juegos faltantes enviada a mesa con ID: " + fk_table + "\x1b[0m");
    log("Último juego registrado en sala para esta mesa:", lastRegisteredGame);

    // (a) callback para detectar errores de publicación
    client.publish(topicSrvGame + fk_table, JSON.stringify({ id: fk_table, last_game_registered: lastRegisteredGame }), { qos: 0 }, (err) => {
        if (err) {
            console.error(`Error al publicar solicitud de juegos faltantes en tópico ${topicSrvGame}${fk_table}:`, err);
        }
    });

    markSyncRequested(fk_table, now);
}

function requestUpdateTable(fk_table: number, gamenumber: number): void {
    if (client.connected) {
        client.publish(topicSrvGame + "/" + fk_table, JSON.stringify({ fk_table, gamenumber }), { qos: 0 });
    } else {
        console.error("Cliente MQTT no está conectado. No se puede publicar solicitud de actualización.");
    }
}

export { GameMessage };
