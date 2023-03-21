// Lists all available VMs.

import { CommandCall, Entries } from "../types";

const call: CommandCall = (message, data) => {
    const { Discord, config, powered_vms } = data;

    const embed = new Discord.EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle("Available VMs");

    for (const [vm_id, vm] of Object.entries(config.vmware.vm_list) as Entries<typeof config.vmware.vm_list>) {
        const name = vm.name;
        const desc = vm.description;
        const powered = powered_vms.includes(name);

        // choose the correct emoji for the power state
        const power_light = powered ? "🟢" : "🔴";

        const title = `${power_light} **${name}** [${vm_id}]`;
        embed.addFields([{ name: title, value: desc }]);
    }

    message.channel.send({ embeds: [embed] });
};

module.exports = call;
