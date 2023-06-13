// Runs a shell command on the VM.

import { CommandCall } from "../types";

import * as embeds from "../embed_generator";

import * as fs from "fs";

const call: CommandCall = async (in_message, data) => {
    const { args, config, booting_vms, shutting_down_vms, cased_args, VMRun, helper_functions } = data;
    const { edit_vmrun_opts, query_vm_id_power_state } = helper_functions;


    // TODO: DRY this in every command
    const vm_id = data.args[0];

    if (!vm_id) {
        in_message.reply("Please specify a VM ID.");
        return;
    }

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
    

    const mode_txt = args[1];
    const opts = {};

    if (mode_txt === "$") {
        opts["noWait"] = false;
        opts["activeWindow"] = false;
        opts["interactive"] = false;
    } else if (mode_txt === ">") {
        opts["noWait"] = true;
        opts["activeWindow"] = true;
        opts["interactive"] = true;
    } else {
        in_message.reply("Second argument must be either `$` (shell mode) or `>` (GUI mode).");
        return;
    }

    const program = cased_args[2];
    const program_args = cased_args.slice(3);

    if (!program) {
        in_message.reply("Please specify a command.");
        return;
    }

    embed = new embeds.ActionPendingEmbed()
        .setTitle("Executing command")
        .setDescription(`Executing command \`${program}\` on VM \`${vm_id}\`.`);
    
    out_message.edit({ embeds: [embed] });

    VMRun_mod.runProgramInGuest(vmx_path, program, program_args, opts).then((result) => {
        console.log(result);
        out_message.delete();
    }).catch((err) => {
        console.error(err);
        out_message.delete();
    });
    // TODO: display result
    // TODO: display error
    // TODO: allow command in ` `
    // TODO: check if the host needs to view the vm (for interactive mode), hopefully not but it has a temper
    // TODO: PATH variable lookup, right now you need to do the full path e.g. C:\Windows\System32\notepad.exe
}

export default call;