// Takes a screenshot and presents it to the user.

import { CommandCall } from "../types";

import * as fs from "fs";
import * as path from "path";

import { v4 as uuidv4 } from "uuid";

const call: CommandCall = async (message, data) => {
    const { Discord, config, booting_vms, VMRun, helper_functions } = data;
    const { edit_vmrun_opts, wait_for_file_to_exist, query_vm_id_power_state } = helper_functions;

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
        message.reply("VM is still booting.");
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
        message.reply("VM is not powered on.");
        return;
    }

    const vmx_path = vm.vmx;

    // validate the vmx path exists on the filesystem
    if (!fs.existsSync(vmx_path)) {
        message.reply("VMX file does not exist. Please consult the bot administrator.");
        console.error(`VMX file does not exist: ${vmx_path} for VM ${vm_id}`);
        return;
    }

    console.log(`Viewing VM ${vm_id}...`);

    const prep_view_embed = new Discord.EmbedBuilder()
        .setColor(0xFFFF00)
        .setTitle(":camera: Screenshot Loading")
        .setDescription(`Taking a screenshot of VM ${vm_id}...`)
        .setTimestamp();

    const view_msg = await message.reply({ embeds: [prep_view_embed] });

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
            const view_embed = new Discord.EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle(":camera_with_flash: Screenshot Taken")
                .setImage(`attachment://${image_name}`)
                .setTimestamp();

            // attach the screenshot to the message
            await view_msg.edit({ embeds: [view_embed], files: [new Discord.AttachmentBuilder(image_path)] });

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

            const error_embed = new Discord.EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle(":x: Screenshot Timeout")
                .setDescription(`An timeout occurred while taking a screenshot of VM ${vm_id}. Please consult the bot administrator.`)
                .setTimestamp();

            view_msg.edit({ embeds: [error_embed] });

            // keep the screenshot file around for debugging if it exists
        });
    }).catch((err) => {
        console.log(`Error taking screenshot for VM ${vm_id}: ${err}`);

        const error_embed = new Discord.EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle(":x: Screenshot Failed")
            .setDescription(`An error occurred while taking a screenshot of VM ${vm_id}. Please consult the bot administrator.`)
            .setTimestamp();

        view_msg.edit({ embeds: [error_embed] });

        // keep the screenshot file around for debugging
    });
};

module.exports = call;
