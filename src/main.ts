import "source-map-support/register";

import * as Discord from "discord.js";
const client = new Discord.Client({
    partials: [Discord.Partials.Channel], intents: [
        Discord.GatewayIntentBits.MessageContent,
        Discord.GatewayIntentBits.Guilds,
        Discord.GatewayIntentBits.GuildMembers,
        Discord.GatewayIntentBits.GuildMessages,
        Discord.GatewayIntentBits.GuildMessageReactions,
        Discord.GatewayIntentBits.DirectMessages
    ]
});

import * as config from "../config.json";
Object.freeze(config); // make config immutable (prevents accidental modification and vulns like prototype pollution)

import { version } from "../package.json";

import { Message } from "discord.js";
import { RateLimiter } from "discord.js-rate-limiter";
import { CommandCall } from "./types";
const rate_limiter = new RateLimiter(1, 2000); // 1 command per 2 seconds
const limit_limiter = new RateLimiter(1, 1000); // 1 notification of being limited per second

import * as VMRun from "vmrun";

import * as pmx from "tx2";

import * as fs from "fs";

import type { Entries } from "./types";

import * as helper_funcs from "./helper_funcs";
const { update_vmrun_state, edit_vmrun_opts } = helper_funcs;

import * as embeds from "./embed_generator";


console.log(" --- Validating basic config... --- \n");

// must have discord config (fields not checked here)
if (!config["discord"]) {
    console.error("FATAL: No discord config specified. Aborting...");
    //pmx.issue(new Error("FATAL: No discord config specified. Aborting..."));
    process.exit(1);
}

console.log("Key discord exists.");

// must have vmware config (fields not checked here)
if (!config["vmware"]) {
    console.error("FATAL: No vmware config specified. Aborting...");
    //pmx.issue(new Error("FATAL: No vmware config specified. Aborting..."));
    process.exit(1);
}

console.log("Key vmware exists.");

console.log("\n === Config validated basically. === \n");



console.log(" --- Initialising VMRun options... --- \n");


const vmrun_options = {};

// must have host type
if (!config.vmware["host_type"]) {
    console.error("FATAL: No host type specified in config. Aborting...");
    //pmx.issue(new Error("FATAL: No host type specified in config. Aborting..."));
    process.exit(1);
} else {
    vmrun_options["hostType"] = config.vmware.host_type;
}

console.log("Set host type.");
// TODO: FARFETCHED IDEA: accept different hosts for each vm from different servers all converging into 1 bot

// optional vmrun path
if (config.vmware["vmrun_path"]) {
    let vr_path = config.vmware.vmrun_path;

    // if the path contains spaces, wrap it in quotes
    if (vr_path.indexOf(" ") !== -1) {
        vr_path = `"${vr_path}"`;
    }

    vmrun_options["vmrunPath"] = vr_path;
}

// not validating path exists so the user can add additional commands from their terminal to the path if needed

console.log("Set vmrun path.");

if (config.vmware["default_options"]) {
    edit_vmrun_opts(config.vmware.default_options, vmrun_options);
}

VMRun.setOptions(vmrun_options);
update_vmrun_state(VMRun);

console.log("Set default options.");

console.log("\n === VMRun options initialised. === \n");



console.log(" --- Initialising commands... --- \n");

const commands: Map<string, CommandCall> = new Map();
const disabled_commands = config.commands?.disabled ?? [];

const cmd_dir = fs.readdirSync("./dist/src/cmd/");

// load commands in the cmd directory to the commands object
for (const filename of cmd_dir) {
    if (filename.endsWith(".js")) {
        const cmd_name = filename.replace(/.js$/, "");
        console.log(`Loading command: ${cmd_name}`);
        if (commands.has(cmd_name)) {
            console.error(`FATAL: Command ${cmd_name} is already loaded. Check for conflicting file name. Aborting...`);
            //pmx.issue(new Error(`FATAL: Command ${name} is already loaded. Check for conflicting file name. Aborting...`));
            process.exit(1);
        }

        const module = require(`./cmd/${filename}`);

        // check default export exists
        const def = module.default;
        if (!def) {
            console.error(`FATAL: Command ${cmd_name} has no default export. Skipping...`);
            //pmx.issue(new Error(`FATAL: Command ${name} has no default export. Skipping...`));
            continue;
        }

        // check default export is a function
        if (typeof def !== "function") {
            console.error(`FATAL: Command ${cmd_name} has a default export that is not a function. Skipping...`);
            //pmx.issue(new Error(`FATAL: Command ${name} has a default export that is not a function. Skipping...`));
            continue;
        }
        
        const cmd_call = def as CommandCall;
        commands.set(cmd_name, cmd_call);
    }
}

console.log("\n === All commands loaded. === \n");



console.log(" --- Initialising user groups... --- \n");

const auth_user_map = config.discord["authorised_user_ids"] ?? {} as { [key: string]: string[] };
const default_roles = config.vmware["default_options"]?.credentials ?? [] as string[];

const known_role_names = Object.keys(default_roles);

if (!known_role_names.includes("default")) {
    console.error("FATAL: No default role specified in config. Aborting...");
    //pmx.issue(new Error("FATAL: No default role specified in config. Aborting..."));
    process.exit(1);
}

const users: Map<string, string[]> = new Map();

// TODO: disable commands for some roles
// TODO: move role management to its own config section
// TODO: support hostnames and passwords for server

// add every user
const user_entries = Object.entries(auth_user_map) as Entries<typeof auth_user_map>;
for (const [user_id, user_roles] of user_entries) {
    if (users.has(user_id)) {
        console.error(`FATAL: User ${user_id} is already loaded. Check for conflicting user ID. Aborting...`);
        //pmx.issue(new Error(`FATAL: User ${user_id} is already loaded. Check for conflicting user ID. Aborting...`));
        process.exit(1);
    }

    // add only the default role, the rest will be verified next
    users.set(user_id, ["default"]);
    console.log(`- User ${user_id} authorised.`)

    // check every role is valid
    for (const role of user_roles) {
        // check the role exists
        if (!known_role_names.includes(role)) {
            console.error(`FATAL: Unknown role ${role} specified for user ${user_id}. Aborting...`);
            //pmx.issue(new Error(`FATAL: Unknown role ${role} specified for user ${user_id}. Aborting...`));
            process.exit(1);
        }

        // check the role is not default
        if (role === "default") {
            console.warn(`WARNING: User ${user_id} has default role specified. This is redundant and should be removed.`);
            continue;
        }

        // add the role
        users.get(user_id).push(role);
        console.log(`\t> Granted ${role} to user ${user_id}.`);
    }
}

console.log("\n === All user groups loaded. === \n");



function update_activity(): void {
    client.user.setActivity("virtual machines", { type: Discord.ActivityType.Playing });
}

client.on("ready", async (): Promise<void> => {
    console.log(`Logged in as ${client.user.tag}!`);
    update_activity();
    setInterval(update_activity, 15000);
    if (process.send) {
        process.send("ready");
    }
});

// booting is the lock on the vm once a start request is made, which is unlocked when the bios is ready
// shutting down is the lock on the vm once a stop request is made, which is unlocked when the vm is fully shut down
const booting_vms = [];
const shutting_down_vms = [];

client.on("messageCreate", async (in_message: Message): Promise<void> => {
    if (in_message.author.bot) {
        return;
    }

    if (in_message.guild === null) {
        in_message.channel.send("This bot does not support DMs. Please return to the channel where the bot is active.");
        return;
    }

    if (!in_message.guild.members.me.permissions.has(
        // permissions integer: 274945402944, invite: https://discord.com/api/oauth2/authorize?client_id=YOUR_BOT_CLIENT_ID&permissions=274945402944&scope=bot
        [
            Discord.PermissionsBitField.Flags.SendMessages,
            Discord.PermissionsBitField.Flags.SendMessagesInThreads,
            Discord.PermissionsBitField.Flags.ManageMessages,
            Discord.PermissionsBitField.Flags.ReadMessageHistory,
            Discord.PermissionsBitField.Flags.EmbedLinks,
            Discord.PermissionsBitField.Flags.AttachFiles,
            Discord.PermissionsBitField.Flags.UseExternalEmojis,
            Discord.PermissionsBitField.Flags.AddReactions,
            Discord.PermissionsBitField.Flags.ChangeNickname,

        ]
    )) {
        in_message.channel.send("The bot is missing basic permissions.\nConsider resetting the bot's permissions to the default invite permissions.");
        return;
    }

    // check for prefix or mention
    if (in_message.content.toLowerCase().startsWith(config.discord.prefix) || in_message.content.toLowerCase().startsWith(client.user.toString())) {
        // check for authorisation
        if (!Object.keys(config.discord.authorised_user_ids).includes(in_message.author.id)) {
            const embed = new embeds.FatalEmbed()
                .setTitle("Unauthorised")
                .setDescription("You are not authorised to use this bot.")
                .setFooter({ text: "This bot is limited to authorised users only." });

            in_message.reply({ embeds: [embed] });
            return;
        }

        const ignore_start = in_message.content.toLowerCase().startsWith(client.user.toString()) ? client.user.toString() : config.discord.prefix;

        const limited = rate_limiter.take(in_message.author.id);
        if (limited) {
            const limit_limited = limit_limiter.take(in_message.author.id);

            if (limit_limited) {
                console.log(`Ratelimit notification limit hit for ${in_message.author.id}`);
                return;
            }

            console.log(`Ratelimit hit for ${in_message.author.id}`);

            const embed = new embeds.FatalEmbed()
                .setTitle("Ratelimit hit")
                .setDescription("Slow down, you're going too fast!")
                .setFooter({ text: "This bot is limited to 1 command per 2 seconds." });

            in_message.reply({ embeds: [embed] });
            return;
        }

        const cmd = in_message.content.toLowerCase().trimStart().replace(ignore_start, "").trimStart().split(" ")[0]; // extract command
        const args = in_message.content.toLowerCase().trimStart().trimStart().split(" ").slice(1); // extract arguments
        const cased_args = in_message.content.trimStart().replace(ignore_start, "").trimStart().split(" ").slice(1); // extract arguments

        if (commands.has(cmd) && !disabled_commands.includes(cmd)) {
            console.log(` > ${cmd} with args ${cased_args} from ${in_message.author.tag} (${in_message.author.id}) in ${in_message.guild.name} (${in_message.guild.id})`)

            const data = {
                args,
                cased_args,
                client,
                config,
                booting_vms,
                shutting_down_vms,
                users,
                VMRun, // passed to maintain state
                helper_functions: helper_funcs, // passed to maintain state
                version,
            };

            const call: CommandCall = (m, d) => { // wrap in function to enforce type checking in IDE
                commands.get(cmd)(m, d);
            };

            try {
                call(in_message, data); // call command with message and optional data
            } catch (e) {
                console.error(e);
                const embed = new embeds.FatalEmbed()
                    .setTitle("Error")
                    .setDescription("An error occurred while executing the command.");

                in_message.reply({ embeds: [embed] });
            }
            // TODO: IDEA: embed diff tool using custom dictionary. only changes embed properties that are different from existing embed to save on instances
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

// TODO: config reload action



function exitHandler(options, exitCode) {
    if (options.cleanup) {
        client.destroy();
    }
}


process.on("exit", exitHandler.bind(null, { cleanup: true }));
process.on("SIGINT", exitHandler.bind(null, { cleanup: true }));
process.on("SIGTERM", exitHandler.bind(null, { cleanup: true }));
process.on("SIGUSR1", exitHandler.bind(null, { cleanup: true }));
process.on("SIGUSR2", exitHandler.bind(null, { cleanup: true }));


process.on("message", function (msg) {
    console.log(msg);
    if (msg === "shutdown") {
        console.log("Shutting down...");
        client.destroy();
        process.exit();
    }
});