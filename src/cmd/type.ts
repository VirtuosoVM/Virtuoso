// Types characters into the VM's keyboard.

import { CommandCall } from "../types";

import * as fs from "fs";

import * as embeds from "../embed_generator";

const call: CommandCall = async (in_message, data) => {
    const { args, config, client, VMRun, helper_functions, booting_vms, shutting_down_vms } = data;
    const { edit_vmrun_opts, query_vm_id_power_state } = helper_functions;

    const vm_id = args[0];

    if (!vm_id) {
        in_message.reply("Please specify a VM ID.");
        return;
    }

    const what_to_type = args.slice(1).join(" ");

    if (!what_to_type || what_to_type.length === 0) {
        in_message.reply("Please specify what to type.");
        return;
    }

    // TODO: DRY this in every command
    // check if the vm id exists in the config, ignoring __proto__ and other properties
    // (anti prototype pollution)
    if (!Object.prototype.hasOwnProperty.call(config.vmware.vm_list, vm_id)) {
        in_message.reply("Invalid VM ID.");
        return;
    }

    const vm = config.vmware.vm_list[vm_id];

    if (!vm) {
        in_message.reply("Invalid VM ID.");
        return;
    }

    if (booting_vms.includes(vm_id)) {
        in_message.reply("VM is still booting.");
        return;
    }

    if (shutting_down_vms.includes(vm_id)) {
        in_message.reply("Cannot execute whilst shutting down.");
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
        in_message.reply("VM is not powered on.");
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

    // TODO: DRY this in every command
    // set the vmrun options if overridden in the config
    let VMRun_mod = VMRun;

    if (vm["options_override"]) {
        const overriden_vmrun_opts = {};
        edit_vmrun_opts(vm.options_override, overriden_vmrun_opts);
        VMRun_mod = VMRun_mod.withModifiedOptions(overriden_vmrun_opts);
    }

    // get python path from config
    const python_path = vm["python_path"];

    if (!python_path) {
        out_message.delete();
        in_message.reply("Python path not specified in config. Please consult the bot administrator.");
        console.error(`Python path not specified in config for VM ${vm_id}`);
        return;
    }

    // get full path to conductor caller from config
    const conductor_caller_path = vm["conductor_caller"];

    if (!conductor_caller_path) {
        out_message.delete();
        in_message.reply("Conductor caller path not specified in config. Please consult the bot administrator.");
        console.error(`Conductor caller path not specified in config for VM ${vm_id}`);
        return;
    }

    // use conductor via vmrun command execution to type the characters
    VMRun_mod.runProgramInGuest(vmx_path, python_path, [conductor_caller_path, "type", what_to_type]).then((result) => {
        console.log(result);

        if (result.stderr && result.stderr.length > 0) {
            out_message.delete();
            in_message.reply("A script error occurred while typing the characters. Please consult the bot administrator.");
            console.error(`Error typing characters for VM ${vm_id}: ${result.stderr}`);
            return;
        }

        // check stdout starts with OK
        // TODO: fix stdout, it isn't receiving any data from the script
        if (!result.stdout.startsWith("OK")) {
            // if it starts with ERR, send back the text after the last :
            if (result.stdout.startsWith("ERR")) {
                out_message.delete();
                in_message.reply(`An error occurred while typing the characters: ${result.stdout.split(":").pop()}`);
                console.error(`Error typing characters for VM ${vm_id}: ${result.stdout}`);
                return;
            }

            out_message.delete();
            in_message.reply("An indeterminate error occurred while typing the characters. Please consult the bot administrator.");
            console.error(`Error typing characters for VM ${vm_id}: ${result.stdout}`);
            return;
        }

        embed = new embeds.SuccessEmbed()
            .setTitle("Characters typed successfully")
            .setDescription(`Typed characters: \`${what_to_type}\``);

        out_message.edit({ embeds: [embed] });
    }).catch((err) => {
        out_message.delete();

        if (err.message && err.message.startsWith("A file was not found")) {
            in_message.reply("Python or conductor caller not found in VM. Please consult the bot administrator.");
            console.error(`Python or conductor caller not found in VM for VM ${vm_id}`);
            return;
        }

        in_message.reply("A system error occurred while typing the characters. Please consult the bot administrator.");
        console.error(`Error typing characters for VM ${vm_id}: ${err}`);
    });
};

export default call;
