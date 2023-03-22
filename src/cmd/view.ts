// Takes a screenshot and presents it to the user.

// Boots the VM with the given ID.

import { CommandCall } from "../types";

import * as fs from "fs";
import * as path from "path";

import { v4 as uuidv4 } from "uuid";

const call: CommandCall = async (message, data) => {
    const { Discord, config, powered_vms, VMRun, helper_functions } = data;
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

    if (!powered_vms.includes(vm_id)) {
        message.reply("VM is not powered on.");
        return;
    }

    const vmx_path = vm.vmx;

    // validate the vmx path exists on the filesystem
    if (!fs.existsSync(vmx_path)) {
        message.reply("VMX file does not exist. Please consult the bot administrator.");
        console.log(`VMX file does not exist: ${vmx_path} for VM ${vm_id}`);
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

        const view_embed = new Discord.EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle(":camera_with_flash: Screenshot Taken")
            .setImage(`attachment://${image_name}`)
            .setTimestamp();

        // attach the screenshot to the message
        view_msg.edit({ embeds: [view_embed], files: [new Discord.AttachmentBuilder(image_path)] });
    }).catch((err) => {
        console.log(`Error taking screenshot for VM ${vm_id}: ${err}`);

        const error_embed = new Discord.EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle(":x: Screenshot Failed")
            .setDescription(`An error occurred while taking a screenshot of VM ${vm_id}. Please consult the bot administrator.`)
            .setTimestamp();

        view_msg.edit({ embeds: [error_embed] });
    });
};

module.exports = call;
