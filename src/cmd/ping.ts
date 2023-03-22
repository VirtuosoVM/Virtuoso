// Measures the latency of the bot.

import { CommandCall } from "../types";

const call: CommandCall = (in_message, data) => {
    const { client } = data;

    in_message.channel.send("Pinging...").then((out_message) => {
        const ping = Math.round((out_message.createdTimestamp - client.ws.ping) - in_message.createdTimestamp);
        out_message.edit(`Pong! 🏓 Estimated Latency is **${ping}ms.** API Latency is **${Math.round(client.ws.ping)}ms.**`);
    }).catch((e) => {
        console.error(e);
        in_message.channel.send("An error occurred while pinging.");
    });
};

module.exports = call;
