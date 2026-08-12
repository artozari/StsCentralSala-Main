import "dotenv/config";

import mqtt, { type MqttClient } from "mqtt";

export interface CasinoMqttConfig {
    casinoCode: string;
    url: string;
    username?: string;
    password?: string;
}

export interface CasinoClient {
    casinoCode: string;
    client: MqttClient;
    mqttBrokerUrl: string;
    topicCliGame: string;
    topicCliConfig: string;
    topicCliGameSync: string;
    topicSrvConfig: string;
    topicSrvGame: string;
}

export const topicCliGame = process.env.MQTT_TOPIC_GAME ?? "STS-MESAS/game/#";
export const topicCliConfig = process.env.MQTT_TOPIC_CONFIG ?? "SimuSts/STS-Casino/Cli/Config/#";
export const topicCliGameSync = process.env.MQTT_TOPIC_GAME_SYNC_SUB ?? "STS-MESAS/GameSync/#";
export const topicSrvConfig = process.env.MQTT_TOPIC_CONFIG_SRV ?? "SimuSts/STS-Casino/Srv/Config";
export const topicSrvGame = process.env.MQTT_TOPIC_GAME_SYNC ?? "STS-MESAS/STS-Casino/GameSync/";

function parseCasinos(): CasinoMqttConfig[] {
    const raw = process.env.MQTT_CASINOS;
    if (!raw || raw.trim() === "") {
        throw new Error(
            "MQTT_CASINOS no está definido en el .env. Configurá un JSON con la lista de casinos (casinoCode, url, username, password).",
        );
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch (err) {
        throw new Error(`MQTT_CASINOS no es un JSON válido: ${(err as Error).message}`);
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error("MQTT_CASINOS debe ser un array no vacío.");
    }
    return parsed as CasinoMqttConfig[];
}

function connectCasino(casino: CasinoMqttConfig, topics: string[]): MqttClient {
    const client = mqtt.connect(casino.url, {
        clientId: `sts-central-${casino.casinoCode}-${Math.random().toString(16).slice(2, 10)}`,
        clean: true,
        connectTimeout: 4000,
        username: casino.username ?? process.env.MQTT_USERNAME,
        password: casino.password ?? process.env.MQTT_PASSWORD,
        reconnectPeriod: 1000,
    });

    client.on("connect", () => {
        console.log(`Conectado al broker MQTT del casino ${casino.casinoCode}:`, casino.url);
        client.subscribe(topics, { qos: 1 }, (err) => {
            if (err) {
                console.error(`Error al suscribirse (casino ${casino.casinoCode}):`, err);
            } else {
                console.log(`Suscrito (casino ${casino.casinoCode}) a:`, topics.join(", "));
            }
        });
    });

    client.on("error", (err: Error) => {
        console.error(`Error en el cliente MQTT del casino ${casino.casinoCode} (${casino.url}):`, err);
    });

    return client;
}

const casinos = parseCasinos();
const topicsToSubscribe = [topicCliGame, topicCliConfig, topicCliGameSync];

export const casinoClients: CasinoClient[] = casinos.map((casino) => ({
    casinoCode: casino.casinoCode,
    client: connectCasino(casino, topicsToSubscribe),
    mqttBrokerUrl: casino.url,
    topicCliGame,
    topicCliConfig,
    topicCliGameSync,
    topicSrvConfig,
    topicSrvGame,
}));

export function getCasinoClient(casinoCode: string): CasinoClient | undefined {
    return casinoClients.find((c) => c.casinoCode === casinoCode);
}

// Backward compatibility: primer casino como cliente por defecto (legacy).
export const client: MqttClient = casinoClients[0]?.client;
