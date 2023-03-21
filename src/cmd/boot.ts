// Boots the Vm with the given ID.

import { CommandCall } from "../types";
import * as fs from "fs";

const call: CommandCall = async (message, data) => {
    const { Discord, config, powered_vms, booting_vms, VMRun, helper_functions } = data;
    const { edit_vmrun_opts } = helper_functions;

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

    if (powered_vms.includes(vm_id)) {
        message.reply("VM is already powered on.");
        return;
    }

    if (booting_vms.includes(vm_id)) {
        message.reply("VM is already booting.");
        return;
    }

    const vmx_path = vm.vmx;

    // validate the vmx path exists on the filesystem
    if (!fs.existsSync(vmx_path)) {
        message.reply("VMX file does not exist. Please consult the bot administrator.");
        console.log(`VMX file does not exist: ${vmx_path} for VM ${vm_id}`);
        return;
    }
    
    console.log(`Booting VM ${vm_id}...`);
    booting_vms.push(vm_id);

    const boot_embed = new Discord.EmbedBuilder()
        .setColor(0xFFFF00)
        .setTitle(":yellow_circle: Booting VM")
        .setDescription(`VM ${vm_id} is booting...`)
        .setTimestamp();
    
    const boot_msg = await message.reply({ embeds: [boot_embed] });

    // set the vmrun options if overridden in the config
    let VMRun_mod = VMRun;

    if (vm["options_override"]) {
        const overriden_vmrun_opts = {};
        edit_vmrun_opts(vm.options_override, overriden_vmrun_opts);
        VMRun_mod = VMRun_mod.withModifiedOptions(overriden_vmrun_opts);
    }

    // start the VM and update the status message
    VMRun_mod.start(vmx_path).then(() => {
        booting_vms.splice(booting_vms.indexOf(vm_id), 1); // remove from booting list
        powered_vms.push(vm_id);

        console.log(`VM ${vm_id} booted.`);
        
        const booted_embed = new Discord.EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle(":green_circle: VM Booted")
            .setDescription(`VM ${vm_id} has been booted.`)
            .setTimestamp();

        boot_msg.edit({ embeds: [booted_embed] });

    }).catch((err) => {
        booting_vms.splice(booting_vms.indexOf(vm_id), 1); // remove from booting list

        console.log(`Error booting VM ${vm_id}: ${err}`);

        const error_embed = new Discord.EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle(":red_circle: Error Booting VM")
            .setDescription(`An error occurred while booting VM ${vm_id}. Please consult the bot administrator.`)
            .setTimestamp();

        boot_msg.edit({ embeds: [error_embed] });
    });
};

module.exports = call;
