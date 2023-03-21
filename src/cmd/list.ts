// Lists all available VMs.

import { CommandCall, Entries } from "../types";

const call: CommandCall = (message, data) => {
    const { Discord, config, powered_vms, booting_vms } = data;

    const embed = new Discord.EmbedBuilder()
        .setColor(0x0000FF)
        .setTitle("Available VMs");

    for (const [vm_id, vm] of Object.entries(config.vmware.vm_list) as Entries<typeof config.vmware.vm_list>) {
        const name = vm.name;
        const desc = vm.description;
        const powered = powered_vms.includes(name);
        const booting = booting_vms.includes(name);

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
