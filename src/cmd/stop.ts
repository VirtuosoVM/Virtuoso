// Stops the VM with the given ID.

import { CommandCall } from "../types";
import * as fs from "fs";

const call: CommandCall = async (message, data) => {
    const { Discord, config, booting_vms, VMRun, helper_functions } = data;
    const { edit_vmrun_opts, query_vm_id_power_state } = helper_functions;

    const vm_id = data.args[0];
    const stop_type = data.args[1];
    const no_warn = data.args[2];

    if (!vm_id) {
        message.reply("Please specify a VM ID.");
        return;
    }

    const vm = config.vmware.vm_list[vm_id];

    if (!vm) {
        message.reply("Invalid VM ID.");
        return;
    }

    if (booting_vms.includes(vm_id)) {
        message.reply("Cannot stop VM whilst booting.");
        return;
    }

    let is_powered: boolean;

    // we're doing a check on the ID earlier so we don't have to consult the filesystem for the VMX path
    // even if the code for this check will run slower, it's still faster than querying the filesystem
    try {
        is_powered = await query_vm_id_power_state(vm_id);
    } catch (err) {
        message.reply("An error occurred while querying the VM power state. Please consult the bot administrator.");
        console.error(`Error querying VM power state for VM ${vm_id}: ${err}`);
        return;
    }

    if (!is_powered) {
        message.reply("VM is already powered off.");
        return;
    }

    if (!stop_type) {
        message.reply("Please specify the type of stop. [soft | hard]");
        return;
    }

    if (stop_type !== "soft" && stop_type !== "hard") {
        message.reply("Invalid stop type. Please specify the type of stop. [soft | hard]");
        return;
    }

    const vmx_path = vm.vmx;

    // validate the vmx path exists on the filesystem
    if (!fs.existsSync(vmx_path)) {
        message.reply("VMX file does not exist. Please consult the bot administrator.");
        console.error(`VMX file does not exist: ${vmx_path} for VM ${vm_id}`);
        return;
    }

    // we're doing a check on the ID earlier so we don't have to consult the filesystem for the VMX path
    // even if the code for the check will run slower, it's still faster than querying the filesystem
    //try {
    //    is_powered = await query_vm_path_power_state(vm.vmx);
    //} catch (err) {
    //    message.reply("An error occurred while querying the VM power state. Please consult the bot administrator.");
    //    console.error(`Error querying VM power state for VM ${vm_id}: ${err}`);
    //    return;
    //}

    console.log(`Stopping VM ${vm_id}...`);

    const stopping_embed = new Discord.EmbedBuilder()
        .setColor(0xFFFF00)
        .setTitle(":yellow_circle: Stopping VM")
        .setDescription(`VM ${vm_id} is stopping...`)
        .setTimestamp();

    const stop_msg = await message.reply({ embeds: [stopping_embed] });

    // set the vmrun options if overridden in the config
    let VMRun_mod = VMRun;

    if (vm["options_override"]) {
        const overriden_vmrun_opts = {};
        edit_vmrun_opts(vm.options_override, overriden_vmrun_opts);
        VMRun_mod = VMRun_mod.withModifiedOptions(overriden_vmrun_opts);
    }

    if (stop_type === "hard") {
        if (no_warn !== "!") {
            const confirm_embed = new Discord.EmbedBuilder()
                .setColor(0xFFAA00)
                .setTitle(":orange_circle: Confirm Hard Stop")
                .setDescription(`**Are you sure you want to hard stop VM ${vm_id}?**

                This emulates unplugging the computer at the wall. This will cause the VM to lose unsaved data and could lead to corruption.

                *To confirm, react with :white_check_mark:.
                To cancel, react with :x: (or anything else).*
                
                If you wish to skip this confirmation, use the command \`${config.discord.prefix}stop <vm_id> hard !\`.`)
                .setFooter({ text: "This message will self-destruct in 15 seconds." })
                .setTimestamp();

            await stop_msg.edit({ embeds: [confirm_embed] });

            await stop_msg.react("✅");
            await stop_msg.react("❌");

            const filter = (reaction, user) => {
                return (reaction.emoji.name === "✅" || reaction.emoji.name === "❌") && user.id === message.author.id;
            };

            // reaction collection block. continues if user reacts with ✅ within 15s, otherwise edits the message and returns
            try {
                const reactions = await message.awaitReactions({ filter, time: 15000, max: 1, errors: ["time"] });
                const reaction = reactions.first();

                if (reaction.emoji.name !== "✅") {
                    // fallback to catch block
                    throw new Error("User did not react with ✅.");
                }
                // otherwise, continue as normal
            } catch (err) {
                console.warn(`Error or abort: ${err}`);
                stop_msg.delete();
                message.reply(`Aborted hard stop of VM ${vm_id}.`);
                return;
            }
        }
    }

    // stop the VM and update the status message
    // uses raw vmrun rather than poweroff/shutdown methods to easily allow for soft/hard stop choice
    VMRun_mod.vmrun("stop", [vmx_path, stop_type]).then(() => {
        console.log(`VM ${vm_id} stopped.`);

        const stopped_embed = new Discord.EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle(":green_circle: VM Stopped")
            .setDescription(`VM ${vm_id} has been stopped`)
            .setTimestamp();

        stop_msg.edit({ embeds: [stopped_embed] });
    }).catch((err) => {
        console.error(`Error stopping VM ${vm_id}: ${err}`);

        const error_embed = new Discord.EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle(":red_circle: Error Stopping VM")
            .setDescription(`An error occurred while stopping VM ${vm_id}. Please consult the bot administrator.`)
            .setTimestamp();

        stop_msg.edit({ embeds: [error_embed] });
    });
};

module.exports = call;
