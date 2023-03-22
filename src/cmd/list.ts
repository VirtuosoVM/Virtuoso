// Lists all available VMs.

import { CommandCall, Entries } from "../types";

const call: CommandCall = async (message, data) => {
    const { Discord, config, booting_vms, helper_functions } = data;
    const { list_running_vm_ids } = helper_functions;

    const embed = new Discord.EmbedBuilder()
        .setColor(0x0000FF)
        .setTitle("Available VMs");
    
    let powered_vms: string[];

    try {
        powered_vms = await list_running_vm_ids();
    } catch (err) {
        message.reply("An error occurred while querying the VM power state. Please consult the bot administrator.");
        console.error(`Error querying VM power state: ${err}`);
        return;
    }

    console.log(powered_vms);

    for (const [vm_id, vm] of Object.entries(config.vmware.vm_list) as Entries<typeof config.vmware.vm_list>) {
        const name = vm.name;
        const desc = vm.description;
        const powered = powered_vms.includes(vm_id);
        const booting = booting_vms.includes(vm_id);

        // choose the correct emoji for the power state
        let power_light = "";
        if (powered) {
            power_light = "🟢";
        } else if (booting) {
            power_light = "🟡";
        } else {
            power_light = "🔴";
        }

        const title = `${power_light} **${name}** [${vm_id}]`;
        embed.addFields([{ name: title, value: desc }]);
    }

    message.channel.send({ embeds: [embed] });
};

module.exports = call;
