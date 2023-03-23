// Link to help article.

import { CommandCall } from "../types";

import * as embeds from "../embed_generator";

const call: CommandCall = (in_message, data) => {
    const { args, config } = data;

    const download = args[0] === "download";

    if (download) {
        if (!config.commands.allow_direct_help_download) {
            in_message.reply("Downloading direct help documentation is not allowed on this bot instance.");
            return;
        }
        
        in_message.reply("Feature not yet implemented.");
        return;
    }

    // only mention the download command if it's enabled in the config
    const mention_download = config.commands.allow_direct_help_download ? `\n\nYou may also download the Markdown source for the documentation direct from the bot instance with the \`${config.discord.prefix}help download\` command.` : "";

    const embed = new embeds.InfoEmbed()
        .setTitle("Help")
        .setDescription(`For setting up and using the bot, consult the [online help documentation](https://github.com/obfuscatedgenerated/Virtuoso/wiki).${mention_download}`);
    
    in_message.reply({ embeds: [embed] });
};

module.exports = call;
