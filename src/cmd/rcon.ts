// Remote console commands to control the bot.

import { CommandCall } from "../types";

import * as embeds from "../embed_generator";

const call: CommandCall = (in_message, data) => {
    const { client, args, users, config } = data;

    if (!config.discord.rcon.enable) {
        in_message.reply("RCON is disabled.");
        return;
    }

    if (!config.discord.rcon.rcon_user_ids.includes(in_message.author.id)) {
        const embed = new embeds.FatalEmbed()
            .setTitle("RCON Access Denied")
            .setDescription("You do not have permission to use RCON commands.")
            .setFooter({ text: "RCON is limited to authorised users only." });
        
        in_message.reply({ embeds: [embed] });
        return;
    }

    const subcommand = args[0];

    if (!subcommand) {
        in_message.reply("Please specify a subcommand. [reload | reconfig | stop | grant]");
        return;
    }
};

module.exports = call;
