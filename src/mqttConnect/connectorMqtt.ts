import "dotenv/config";

import mqtt from "mqtt";

export const mqttBrokerUrl = process.env.MQTT_BROKER_URL ?? "ws://dev01.sielcon.net:9104";
export const topicCliGame = process.env.MQTT_TOPIC_GAME ?? "STS-MESAS/game/#";
export const topicCliConfig = process.env.MQTT_TOPIC_CONFIG ?? "SimuSts/STS-Casino/Cli/Config/#";
export const topicCliGameSync = process.env.MQTT_TOPIC_GAME_SYNC_SUB ?? "STS-MESAS/GameSync/#";
export const topicSrvConfig = process.env.MQTT_TOPIC_CONFIG_SRV ?? "SimuSts/STS-Casino/Srv/Config";
export const topicSrvGame = process.env.MQTT_TOPIC_GAME_SYNC ?? "STS-MESAS/STS-Casino/GameSync/";
export const client = mqtt.connect(mqttBrokerUrl, {
    clientId: `sts-sala-app-${Math.random().toString(16).slice(2, 10)}`,
    clean: true,
    connectTimeout: 4000,
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    reconnectPeriod: 1000,
});

client.on("connect", () => {
    console.log("Conectado al broker MQTT:", mqttBrokerUrl);
    // Suscribirse a los tópicos
    client.subscribe([topicCliGame, topicCliConfig, topicCliGameSync], { qos: 1 }, (err) => {
        if (err) {
            console.error("Error al suscribirse a los tópicos:", err);
        } else {
            console.log("Suscrito a los tópicos con qos 1:", topicCliGame, topicCliConfig, topicCliGameSync);
        }
    });
});

client.on("error", (err: Error) => {
    console.error("Error en el cliente MQTT:", err);
});
