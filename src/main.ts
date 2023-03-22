import "source-map-support/register";

import * as Discord from "discord.js";
const client = new Discord.Client({ partials: [Discord.Partials.Channel], intents: [Discord.GatewayIntentBits.MessageContent, Discord.GatewayIntentBits.Guilds, Discord.GatewayIntentBits.GuildMembers, Discord.GatewayIntentBits.GuildMessages, Discord.GatewayIntentBits.GuildMessageReactions, Discord.GatewayIntentBits.DirectMessages] });

import * as config from "../config.json";

import type { Message } from "discord.js";
import { RateLimiter } from "discord.js-rate-limiter";
import { CommandCall } from "./types";
const rate_limiter = new RateLimiter(1, 2000); // 1 command per 2 seconds
const limit_limiter = new RateLimiter(1, 1000); // 1 notification of being limited per second

import * as VMRun from "vmrun";

import * as fs from "fs";

import * as pmx from "tx2";

console.log(" --- Validating basic config... --- ");

// must have discord config (fields not checked here)
if (!config["discord"]) {
    console.error("FATAL: No discord config specified. Aborting...");
    //pmx.issue(new Error("FATAL: No discord config specified. Aborting..."));
    process.exit(1);
}

// must have vmware config (fields not checked here)
if (!config["vmware"]) {
    console.error("FATAL: No vmware config specified. Aborting...");
    //pmx.issue(new Error("FATAL: No vmware config specified. Aborting..."));
    process.exit(1);
}

console.log(" === Config validated basically. === \n");

console.log(" --- Initialising VMRun options... --- ");


const vmrun_options = {};

// must have host type
if (!config.vmware["host_type"]) {
    console.error("FATAL: No host type specified in config. Aborting...");
    //pmx.issue(new Error("FATAL: No host type specified in config. Aborting..."));
    process.exit(1);
} else {
    vmrun_options["hostType"] = config.vmware.host_type;
}

// optional vmrun path
if (config.vmware["vmrun_path"]) {
    let vr_path = config.vmware.vmrun_path;

    // if the path contains spaces, wrap it in quotes
    if (vr_path.indexOf(" ") !== -1) {
        vr_path = `"${vr_path}"`;
    }

    vmrun_options["vmrunPath"] = vr_path;
}

// (immediate) helper function that will be reused for overriding default options
const edit_vmrun_opts = (input_opts: { [key: string]: any }, vmrun_opts: { [key: string]: any }) => {
    // optional fields for vm_password and guest_creds
    if (input_opts["vm_password"]) {
        vmrun_opts["vmPassword"] = config.vmware.default_options.vm_password;
    }

    if (input_opts["guest_creds"]) {
        if (input_opts.guest_creds["username"]) {
            vmrun_opts["guestUsername"] = input_opts.guest_creds.username;
        }

        if (input_opts.guest_creds["password"]) {
            vmrun_opts["guestPassword"] = input_opts.guest_creds.password;
        }
    }
};

if (config.vmware["default_options"]) {
    edit_vmrun_opts(config.vmware.default_options, vmrun_options);
}

VMRun.setOptions(vmrun_options);

console.log(" === VMRun options initialised. === \n");


const commands = {};

console.log(" --- Initialising commands... --- ");

const disabled_commands = config.commands?.disabled ?? [];

const cmd_dir = fs.readdirSync("./dist/src/cmd/");

// load commands in the cmd directory to the commands object
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

console.log(" === All commands loaded. === \n");

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

// booting is the lock on powering the vm once a request is made, not the actual os' state
const booting_vms = [];

// more helper functions

const wait_for_file_to_exist = (file_path: string, timeout: number, interval_ms: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        const start_time = Date.now();

        const interval = setInterval(() => {
            if (fs.existsSync(file_path)) {
                clearInterval(interval);
                resolve();
            } else if (Date.now() - start_time > timeout) {
                clearInterval(interval);
                reject();
            }
        }, interval_ms);
    });
};

const list_running_vm_ids = async (): Promise<string[]> => {
    const vm = config.vmware.vm_list;
    const id_list = [];
    const running_vms = await VMRun.list();

    // TODO: should this be the other way? i.e. iterate over running_vms and check if they are in the config
    for (const vm_id in vm) {
        const vmx_path = vm[vm_id].vmx;

        if (!vmx_path) {
            throw new Error(`VMX path not specified for VM ${vm_id}`);
        }

        // validate the vmx path exists on the filesystem
        if (!fs.existsSync(vmx_path)) {
            throw new Error(`VMX file does not exist: ${vmx_path} for VM ${vm_id}`);
        }

        // for every vm that is powered on, match the vmx path to the vm id
        for (const running_vm of running_vms) {
            if (running_vm === vmx_path) {
                id_list.push(vm_id);
            }
        }
    }

    return id_list;
};

const query_vm_id_power_state = async (vm_id: string): Promise<boolean> => {
    // TODO: DRY similar code in other commands
    const vm = config.vmware.vm_list[vm_id];

    if (!vm) {
        throw new Error(`Invalid VM ID: ${vm_id}`);
    }

    const vmx_path = vm.vmx;

    // validate the vmx path exists on the filesystem
    if (!fs.existsSync(vmx_path)) {
        throw new Error(`VMX file does not exist: ${vmx_path} for VM ${vm_id}`);
    }

    // set the vmrun options if overridden in the config
    let VMRun_mod = VMRun;

    if (vm["options_override"]) {
        const overriden_vmrun_opts = {};
        edit_vmrun_opts(vm.options_override, overriden_vmrun_opts);
        VMRun_mod = VMRun_mod.withModifiedOptions(overriden_vmrun_opts);
    }

    // repeated code so we don't iterate over the entire list of vms
    const running_vms = await VMRun_mod.list();

    // for every vm that is powered on, match the vmx path to the vm id
    for (const running_vm of running_vms) {
        if (running_vm === vmx_path) {
            return true;
        }
    }

    return false;
}

const query_vm_path_power_state = async (vmx_path: string): Promise<boolean> => {
    const running_vms = await VMRun.list();
    return running_vms.includes(vmx_path);
};

const helper_functions = {
    "edit_vmrun_opts": edit_vmrun_opts,
    "wait_for_file_to_exist": wait_for_file_to_exist,
    "list_running_vm_ids": list_running_vm_ids,
    "query_vm_id_power_state": query_vm_id_power_state,
    "query_vm_path_power_state": query_vm_path_power_state
};

client.on("messageCreate", async (message: Message): Promise<void> => {
    if (message.author.bot) {
        return;
    }

    if (message.guild === null) {
        message.channel.send("This bot does not support DMs. Please return to the channel where the bot is active.");
        return;
    }

    if (!message.guild.members.me.permissions.has(
        // permissions integer: 376896, invite: https://discord.com/api/oauth2/authorize?client_id=YOUR_BOT_CLIENT_ID&permissions=376896&scope=bot
        [
            Discord.PermissionsBitField.Flags.ReadMessageHistory,
            Discord.PermissionsBitField.Flags.EmbedLinks,
            Discord.PermissionsBitField.Flags.AttachFiles,
            Discord.PermissionsBitField.Flags.UseExternalEmojis,
            Discord.PermissionsBitField.Flags.AddReactions
        ]
    )) {
        message.channel.send("The bot is missing basic permissions.\nPlease make sure the bot has at least the following permissions: `READ MESSAGE HISTORY`, `EMBED LINKS`, `ATTACH FILES`, `USE EXTERNAL EMOJIS` and `ADD REACTIONS`.\nRe-invite the bot to get all the required permissions.");
        return;
    }

    if (message.content.toLowerCase().startsWith(config.discord.prefix) || message.content.toLowerCase().startsWith(client.user.toString())) {
        if (message.author.id !== config.discord.owner_id && !config.discord.authorised_user_ids.includes(message.author.id)) {
            const embed = new Discord.EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle(":x: Unauthorised")
                .setDescription("You are not authorised to use this bot.")
                .setFooter({ text: "This bot is limited to authorised users only." });
            message.reply({ embeds: [embed] });
            return;
        }

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

        const cmd = message.content.toLowerCase().trimStart().replace(ignore_start, "").trimStart().split(" ")[0]; // extract command
        const args = message.content.toLowerCase().trimStart().trimStart().split(" ").slice(1); // extract arguments
        const cased_args = message.content.trimStart().replace(ignore_start, "").trimStart().split(" ").slice(1); // extract arguments

        if (cmd in commands && !disabled_commands.includes(cmd)) {
            console.log(` > ${cmd} with args ${cased_args} from ${message.author.tag} (${message.author.id}) in ${message.guild.name} (${message.guild.id})`)

            const data = {
                args: args,
                cased_args: cased_args,
                client: client,
                Discord: Discord, // passed to maintain state // TODO: is this necessary?, only the client should have state, the module may import its own Discord module
                commands: commands,
                config: config,
                booting_vms: booting_vms,
                VMRun: VMRun, // passed to maintain state
                helper_functions: helper_functions,
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