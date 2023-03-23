// Stops the VM with the given ID.

import { CommandCall } from "../types";

import * as embeds from "../embed_generator";

import * as fs from "fs";

const call: CommandCall = async (in_message, data) => {
    const { config, booting_vms, shutting_down_vms, VMRun, helper_functions } = data;
    const { edit_vmrun_opts, query_vm_id_power_state } = helper_functions;

    const vm_id = data.args[0];
    const stop_type = data.args[1];
    const no_warn = data.args[2];

    if (!vm_id) {
        in_message.reply("Please specify a VM ID.");
        return;
    }

    const vm = config.vmware.vm_list[vm_id];

    if (!vm) {
        in_message.reply("Invalid VM ID.");
        return;
    }

    if (booting_vms.includes(vm_id)) {
        in_message.reply("Cannot stop VM whilst booting.");
        return;
    }

    if (shutting_down_vms.includes(vm_id)) {
        in_message.reply("VM is already shutting down.");
        return;
    }

    let embed = new embeds.QueryingPowerStateEmbed(vm_id);

    const out_message = await in_message.reply({ embeds: [embed] });

    let is_powered: boolean;

    // we're doing a check on the ID earlier so we don't have to consult the filesystem for the VMX path
    // even if the code for this check will run slower, it's still faster than querying the filesystem
    try {
        is_powered = await query_vm_id_power_state(vm_id);
    } catch (err) {
        out_message.delete();
        in_message.reply("An error occurred while querying the VM power state. Please consult the bot administrator.");
        console.error(`Error querying VM power state for VM ${vm_id}: ${err}`);
        return;
    }

    if (!is_powered) {
        out_message.delete();
        in_message.reply("VM is already powered off.");
        return;
    }

    if (!stop_type) {
        out_message.delete();
        in_message.reply("Please specify the type of stop. [soft | hard]");
        return;
    }

    if (stop_type !== "soft" && stop_type !== "hard") {
        out_message.delete();
        in_message.reply("Invalid stop type. Please specify the type of stop. [soft | hard]");
        return;
    }

    const vmx_path = vm.vmx;

    // validate the vmx path exists on the filesystem
    if (!fs.existsSync(vmx_path)) {
        out_message.delete();
        in_message.reply("VMX file does not exist. Please consult the bot administrator.");
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

    // set the vmrun options if overridden in the config
    let VMRun_mod = VMRun;

    if (vm["options_override"]) {
        const overriden_vmrun_opts = {};
        edit_vmrun_opts(vm.options_override, overriden_vmrun_opts);
        VMRun_mod = VMRun_mod.withModifiedOptions(overriden_vmrun_opts);
    }

    if (stop_type === "hard") {
        if (no_warn !== "!") {
            // TODO: DRY confirmations into a class or helper function
            embed = new embeds.ConfirmationEmbed()
                .setTitle("Confirm Hard Stop")
                .setDescription(`**Are you sure you want to hard stop VM ${vm_id}?**

                This emulates unplugging the computer at the wall. This will cause the VM to lose unsaved data and could lead to corruption.

                *To confirm, react with :white_check_mark:.
                To cancel, react with :x: (or anything else).*
                
                If you wish to skip this confirmation, use the command \`${config.discord.prefix}stop <vm_id> hard !\`.`)
                .setFooter({ text: "This message will self-destruct in 15 seconds." })
                .setTimestamp();

            await out_message.edit({ embeds: [embed] });

            await out_message.react("✅");
            await out_message.react("❌");

            const filter = (reaction, user) => {
                return (reaction.emoji.name === "✅" || reaction.emoji.name === "❌") && user.id === in_message.author.id;
            };

            // reaction collection block. continues if user reacts with ✅ within 15s, otherwise edits the message and returns
            try {
                const reactions = await out_message.awaitReactions({ filter, time: 15000, max: 1, errors: ["time"] });

                if (reactions.size === 0) {
                    // fallback to catch block
                    throw new Error("No reactions.");
                }

                const reaction = reactions.first();

                if (reaction.emoji.name !== "✅") {
                    // fallback to catch block
                    throw new Error("User did not react with ✅.");
                }
                // otherwise, continue as normal
            } catch (err) {
                console.warn(`Error or abort: ${err}`);
                out_message.delete();
                in_message.reply(`Aborted hard stop of VM ${vm_id}.`);
                return;
            }

            out_message.reactions.removeAll().catch((err) => {
                console.error(`Error removing reactions: ${err}`);
            });
        }
    }

    console.log(`Doing stop for VM ${vm_id}...`);

    embed = new embeds.ActionPendingEmbed()
        .setTitle("Stopping VM")
        .setDescription(`VM ${vm_id} is stopping...`)
        .setTimestamp();

    await out_message.edit({ embeds: [embed] });

    shutting_down_vms.push(vm_id);

    // stop the VM and update the status message
    // uses raw vmrun rather than poweroff/shutdown methods to easily allow for soft/hard stop choice
    VMRun_mod.vmrun("stop", [vmx_path, stop_type]).then(() => {
        shutting_down_vms.splice(shutting_down_vms.indexOf(vm_id), 1); // remove the VM from the shutting down list

        console.log(`VM ${vm_id} stopped.`);

        embed = new embeds.SuccessEmbed()
            .setTitle("VM Stopped")
            .setDescription(`VM ${vm_id} has been stopped.`)
            .setTimestamp();

        out_message.edit({ embeds: [embed] });
    }).catch((err) => {
        console.error(`Error stopping VM ${vm_id}: ${err}`);

        embed = new embeds.FatalEmbed()
            .setTitle("Error Stopping VM")
            .setDescription(`An error occurred while stopping VM ${vm_id}.`)
            .setTimestamp();

        out_message.edit({ embeds: [embed] });
    });
};

module.exports = call;
