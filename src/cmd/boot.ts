// Boots the VM with the given ID.

import { CommandCall } from "../types";
import * as fs from "fs";

const call: CommandCall = async (message, data) => {
    const { Discord, config, booting_vms, VMRun, helper_functions } = data;
    const { edit_vmrun_opts, query_vm_id_power_state } = helper_functions;

    const vm_id = data.args[0];

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
        message.reply("VM is already booting.");
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

    if (is_powered) {
        message.reply("VM is already powered on.");
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
    
    console.log(`Booting VM ${vm_id}...`);
    booting_vms.push(vm_id);

    const embed = new Discord.EmbedBuilder()
        .setColor(0xFFFF00)
        .setTitle(":yellow_circle: Booting VM")
        .setDescription(`VM ${vm_id} is booting...`)
        .setTimestamp();
    
    const msg = await message.reply({ embeds: [embed] });

    // set the vmrun options if overridden in the config
    let VMRun_mod = VMRun;
    let disconnect_sound = config.vmware["default_options"]["disconnect_sound"];

    if (vm["options_override"]) {
        const overriden_vmrun_opts = {};
        edit_vmrun_opts(vm.options_override, overriden_vmrun_opts);
        VMRun_mod = VMRun_mod.withModifiedOptions(overriden_vmrun_opts);

        if (vm.options_override["disconnect_sound"]) {
            disconnect_sound = vm.options_override["disconnect_sound"];
        }
    }

    // start the VM and update the status message
    VMRun_mod.start(vmx_path).then(() => {
        booting_vms.splice(booting_vms.indexOf(vm_id), 1); // remove from booting list
        //powered_vms.push(vm_id); // no longer needed since we're querying the power state each time

        console.log(`VM ${vm_id} booted.`);
        
        embed
            .setColor(0x00FF00)
            .setTitle(":green_circle: VM Booted")
            .setDescription(`VM ${vm_id} has been booted.`)
            .setTimestamp();

        msg.edit({ embeds: [embed] });

        if (disconnect_sound) {
            // disconnect the sound device from the VM
            VMRun_mod.vmrun("disconnectNamedDevice", [vmx_path, "sound"]).then(() => {
                console.log(`Disconnected sound device from VM ${vm_id}.`);
            }).catch((err) => {
                console.error(`Error disconnecting sound device from VM ${vm_id}: ${err}`);
            });
        }
    }).catch((err) => {
        booting_vms.splice(booting_vms.indexOf(vm_id), 1); // remove from booting list

        console.error(`Error booting VM ${vm_id}: ${err}`);

        embed
            .setColor(0xFF0000)
            .setTitle(":red_circle: Error Booting VM")
            .setDescription(`An error occurred while booting VM ${vm_id}. Please consult the bot administrator.`)
            .setTimestamp();

        msg.edit({ embeds: [embed] });
    });
};

module.exports = call;
