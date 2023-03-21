import "source-map-support/register";

import * as Discord from "discord.js";
const client = new Discord.Client({ partials: [Discord.Partials.Channel], intents: [Discord.GatewayIntentBits.Guilds, Discord.GatewayIntentBits.GuildMembers, Discord.GatewayIntentBits.GuildMessages, Discord.GatewayIntentBits.GuildMessageReactions, Discord.GatewayIntentBits.DirectMessages] });

import * as config from "../config.json";

import type { Message } from "discord.js";
import { RateLimiter } from "discord.js-rate-limiter";
import { CommandCall } from "./types";
const rate_limiter = new RateLimiter(1, 2000); // 1 command per 2 seconds
const limit_limiter = new RateLimiter(1, 1000); // 1 notification of being limited per second

import * as fs from "fs";

import * as pmx from "tx2";

const commands = {};

console.log(" --- Initialising commands... --- ");

const cmd_dir = fs.readdirSync("./dist/cmd/");

for (const filename of cmd_dir) {
    if (filename.endsWith(".js")) {
        const cmd_name = filename.replace(/.js$/, "");
        console.log(`Loading command: ${cmd_name}`);
        if (cmd_name in commands) {
            console.error(`FATAL: Command ${cmd_name} is already loaded. Check for conflicting file name. Aborting...`);
            //pmx.issue(new Error(`FATAL: Command ${name} is already loaded. Check for conflicting file name. Aborting...`));
            process.exit(1);
        }

        commands[filename.replace(/.js$/, "")] = require(`./cmd/${filename}`); // load command function into object
    }
}

console.log(" === All commands loaded. === ");

function update_activity(): void {
    client.user.setActivity("virtual machines", { type: Discord.ActivityType.Playing });
}

client.on("ready", async (): Promise<void> => {
    console.log(`Logged in as ${client.user.tag}!`);
    update_activity();
    setInterval(update_activity, 15000);
    process.send("ready");
});

client.on("messageCreate", async (message: Message): Promise<void> => {
    if (message.author.bot) {
        return;
    }

    const disabled_commands = [];

    if (message.guild === null) {
        message.channel.send("This bot does not support DMs. Please return to the channel where the bot is active.");
        return;
    }

    if (!message.guild.members.me.permissions.has(
        [
            Discord.PermissionsBitField.Flags.ReadMessageHistory,
            Discord.PermissionsBitField.Flags.EmbedLinks,
            Discord.PermissionsBitField.Flags.AttachFiles,
            Discord.PermissionsBitField.Flags.UseExternalEmojis,
        ]
    )) {
        message.channel.send("The bot is missing basic permissions.\nPlease make sure the bot has at least the following permissions: `READ MESSAGE HISTORY`, `EMBED LINKS`, `ATTACH FILES` and `USE EXTERNAL EMOJIS`.\nRe-invite the bot to get all the required permissions.");
        return;
    }

    if (message.content.toLowerCase().startsWith(config.discord.prefix) || message.content.toLowerCase().startsWith(client.user.toString())) {
        const ignore_start = message.content.toLowerCase().startsWith(client.user.toString()) ? client.user.toString() : config.discord.prefix;
        
        const limited = rate_limiter.take(message.author.id);
        if (limited) {
            const limit_limited = limit_limiter.take(message.author.id);

            if (limit_limited) {
                console.log(`Ratelimit notification limit hit for ${message.author.id}`);
                return;
            }

            console.log(`Ratelimit hit for ${message.author.id}`);

            const embed = new Discord.EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle(":x: Ratelimit hit")
                .setDescription("Slow down, you're going too fast!")
                .setFooter({ text: "This bot is limited to 1 command per 2 seconds." });
            message.reply({ embeds: [embed] });
            return;
        }

        const cmd = message.content.toLowerCase().trimStart().replace(ignore_start, "").trimStart().split(" ")[0];
        const args = message.content.toLowerCase().trimStart().trimStart().split(" ").slice(1); // extract arguments
        const cased_args = message.content.trimStart().replace(ignore_start, "").trimStart().split(" ").slice(1); // extract arguments

        if (cmd in commands && !disabled_commands.includes(cmd)) {
            const data = {
                args: args,
                cased_args: cased_args,
                client: client,
                Discord: Discord,
                commands: commands
            };

            const call: CommandCall = (m, d) => { // wrap in function to enforce type checking in IDE
                return commands[cmd](m, d);
            };

            call(message, data); // call command with message and optional data
        }
    }
});

client.login(config.discord.token);

pmx.action("test-pmx", function (param: string, reply: Function): void {
    reply({ answer: param });
});

pmx.action("test-bot", async function (reply: Function): Promise<void> {
    await client.users.fetch(config.discord.owner_id).then(async (user) => {
        await user.send("Test.");
        reply("Test DM sent to " + user.tag + " successfully.");
    }).catch(e => {
        console.log(e);
        reply("An error occurred.");
    });
});



//function exitHandler(options, exitCode) {
//    if (options.cleanup) {
//        client.destroy();
//    }
//};
//
//
//process.on("exit", exitHandler.bind(null, { cleanup: true }));
//process.on("SIGINT", exitHandler.bind(null, { cleanup: true }));
//process.on("SIGTERM", exitHandler.bind(null, { cleanup: true }));
//process.on("SIGUSR1", exitHandler.bind(null, { cleanup: true }));
//process.on("SIGUSR2", exitHandler.bind(null, { cleanup: true }));


process.on("message", function (msg) {
    console.log(msg);
    if (msg === "shutdown") {
        console.log("Shutting down...");
        client.destroy();
        process.exit();
    }
});