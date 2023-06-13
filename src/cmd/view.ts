// Takes a screenshot and presents it to the user.

import { CommandCall } from "../types";

import * as embeds from "../embed_generator";

import * as fs from "fs";
import * as path from "path";

import { AttachmentBuilder } from "discord.js";
import { v4 as uuidv4 } from "uuid";

const call: CommandCall = async (in_message, data) => {
    const { config, booting_vms, shutting_down_vms, VMRun, helper_functions } = data;
    const { edit_vmrun_opts, wait_for_file_to_exist, query_vm_id_power_state } = helper_functions;

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
        in_message.reply("Cannot take screenshot whilst shutting down.");
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

    console.log(`Viewing VM ${vm_id}...`);

    embed = new embeds.ScreenshotPendingEmbed(vm_id);

    await out_message.edit({ embeds: [embed] });

    // set the vmrun options if overridden in the config
    let VMRun_mod = VMRun;

    if (vm["options_override"]) {
        const overriden_vmrun_opts = {};
        edit_vmrun_opts(vm.options_override, overriden_vmrun_opts);
        VMRun_mod = VMRun_mod.withModifiedOptions(overriden_vmrun_opts);
    }

    let image_name: string;
    let image_path: string;

    // generate a guaranteed unique filename for the screenshot (loop until the file doesn't exist, unlikely to ever happen)
    do {
        image_name = `${vm_id}_${uuidv4()}.png`;
        image_path = path.resolve(path.join(config.vmware["screenshot_dir"] || "./screenshots/", image_name)); // absolute path
    } while (fs.existsSync(image_path));

    // create the screenshot directory if it doesn't exist (prevents access denied errors)
    if (!fs.existsSync(path.dirname(image_path))) {
        fs.mkdirSync(path.dirname(image_path), { recursive: true });
    }

    console.log(`Taking screenshot for VM ${vm_id} to ${image_path}...`);

    VMRun_mod.captureScreen(vmx_path, image_path).then(() => {
        console.log(`Screenshot taken for VM ${vm_id} to ${image_path}.`);

        // wait for the screenshot to be written to the filesystem, helps prevent ENOENT errors if vmrun returns before the file is written
        wait_for_file_to_exist(image_path, 5000, 10).then(async () => {
            embed = new embeds.ScreenshotSuccessEmbed(vm_id, image_name);

            // attach the screenshot to the message
            await out_message.edit({ embeds: [embed], files: [new AttachmentBuilder(image_path)] });

            // delete the screenshot file
            fs.unlink(image_path, (err) => {
                if (err) {
                    console.error(`Error deleting screenshot file for VM ${vm_id}: ${err}`);
                } else {
                    console.log(`Screenshot file deleted for VM ${vm_id}: ${image_path}`);
                }
            });
        }).catch((err) => {
            console.error(`Error waiting for screenshot file to exist for VM ${vm_id}: ${err}`);

            embed = new embeds.FatalEmbed()
                .setTitle("Screenshot Timeout")
                .setDescription(`An timeout occurred while taking a screenshot of VM ${vm_id}.`)
                .setTimestamp();

            out_message.edit({ embeds: [embed] });

            // keep the screenshot file around for debugging if it exists
        });
    }).catch((err) => {
        console.log(`Error taking screenshot for VM ${vm_id}: ${err}`);

        embed = new embeds.FatalEmbed()
            .setTitle("Screenshot Error")
            .setDescription(`An error occurred while taking a screenshot of VM ${vm_id}.`)
            .setTimestamp();

        out_message.edit({ embeds: [embed] });

        // keep the screenshot file around for debugging
    });
};

export default call;
