import type { MqttClient } from "mqtt";

function publicarDatos(client: MqttClient, topic: string, datoAEnviar?: any): void {
  if (!client || !client.connected) {
    console.log("Cliente MQTT no conectado, no se envían datos");
    return;
  }
  const message = JSON.stringify(datoAEnviar);

  client.publish(topic, message, { qos: 1 }, (err) => {
    if (err) console.error("Error publishing to topic", topic, ":", err);
    else console.log("datos enviado al tópico", topic, ":", datoAEnviar);
  });
}

export { publicarDatos };
