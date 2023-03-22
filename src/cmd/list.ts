// Lists all available VMs.

import { CommandCall, Entries } from "../types";

// the API maximum is 25 fields per embed, but we don't want to make it too long
const FIELD_LIMIT = 10;
const MAX_TITLE_LENGTH = 256;
const MAX_VALUE_LENGTH = 1024;

const call: CommandCall = async (in_message, data) => {
    const { Discord, config, booting_vms, helper_functions } = data;
    const { list_running_vm_ids } = helper_functions;

    // first arg or 1
    const page = data.args[0] ? parseInt(data.args[0]) : 1;

    if (isNaN(page) || page < 1) {
        in_message.reply("Invalid page number.");
        return;
    }

    const embed = new Discord.EmbedBuilder()
        .setColor(0xFF00FF)
        .setTitle("Querying power states...")
        .setDescription("This may take some time...");

    const out_message = await in_message.reply({ embeds: [embed] });

    let powered_vms: string[];

    try {
        powered_vms = await list_running_vm_ids();
    } catch (err) {
        out_message.delete();
        in_message.reply("An error occurred while querying the VM power state. Please consult the bot administrator.");
        console.error(`Error querying VM power state: ${err}`);
        return;
    }

    embed.setColor(0x0000FF);
    embed.setTitle("Available VMs");
    embed.setDescription(null);

    const entries = Object.entries(config.vmware.vm_list) as Entries<typeof config.vmware.vm_list>;
    const page_count = Math.ceil(entries.length / FIELD_LIMIT);

    // use proper pluralisation
    const txt_are_is = entries.length === 1 ? "is" : "are";
    const txt_pages_page = page_count === 1 ? "page" : "pages";

    if (page > page_count) {
        out_message.delete();
        in_message.reply(`Invalid page number. There ${txt_are_is} only ${page_count} ${txt_pages_page}.`);
        return;
    }

    embed.setFooter({ text: `Page: ${page}/${page_count}` });

    // slice the entries array to get the entries for the current page
    const entries_page = entries.slice((page - 1) * FIELD_LIMIT, page * FIELD_LIMIT);

    for (const [vm_id, vm] of entries_page) {
        // auto truncate the description if it's too long
        const name = vm.name;
        const desc = vm.description.length <= MAX_VALUE_LENGTH ? vm.description : vm.description.slice(0, MAX_VALUE_LENGTH - 3) + "...";

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

        let title = `${power_light} **${name}** [${vm_id}]`;

        // auto truncate the title if it's too long
        title = title.length <= MAX_TITLE_LENGTH ? title : title.slice(0, MAX_TITLE_LENGTH - 3) + "...";

        embed.addFields([{ name: title, value: desc }]);
    }

    out_message.edit({ embeds: [embed] });
};

module.exports = call;
