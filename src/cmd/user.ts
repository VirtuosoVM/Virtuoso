// Gives information about the user who calls the command or a specific user.

import { CommandCall } from "../types";

import * as embeds from "../embed_generator";

const call: CommandCall = (in_message, data) => {
    const { args, client, users, helper_functions } = data;

    // fetch the user mentioned or the author of the message
    const user = args[0] ? client.users.cache.get(helper_functions.resolve_user(args[0])) : in_message.author;

    if (!user) {
        in_message.reply("Invalid user. Make sure you are mentioning a user or using a valid user ID, and that the user is in the same server as the bot.");
        return;
    }

    const user_roles = users[user.id];

    const embed = new embeds.InfoEmbed()
        .setTitle(`User Info for ${user.username}#${user.discriminator}`)
        .addFields([
            {
                name: "ID",
                value: user.id,
                inline: false,
            },
            {
                name: "Credential Roles",
                value: user_roles ? user_roles.join(", ") : "None",
                inline: false,
            },
            {
                name: "Account Created",
                value: `${user.createdAt.toUTCString()} (${Math.round((Date.now() - user.createdAt.getTime()) / 86400000)} days)`,
                inline: false,
            }
        ])
        .setThumbnail(user.displayAvatarURL());

    in_message.reply({ embeds: [embed] });
};

module.exports = call;
