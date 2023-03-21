// Measures the latency of the bot.

import { CommandCall } from "../types";

const call: CommandCall = (message, data) => {
    const { client } = data;

    message.channel.send("Pinging...").then((msg) => {
        const ping = Math.round((msg.createdTimestamp - client.ws.ping) - message.createdTimestamp);
        msg.edit(`Pong! 🏓 Estimated Latency is **${ping}ms.** API Latency is **${Math.round(client.ws.ping)}ms.**`);
    }).catch((e) => {
        console.error(e);
        message.channel.send("An error occurred while pinging.");
    });
};

module.exports = call;
