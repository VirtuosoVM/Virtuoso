// Lists all available VMs.

import { CommandCall, Entries } from "../types";

import * as embeds from "../embed_generator";

// the API maximum is 25 fields per embed, but we don't want to make it too long
const FIELD_LIMIT = 10;
const MAX_TITLE_LENGTH = 256;
const MAX_VALUE_LENGTH = 1024;

const call: CommandCall = async (in_message, data) => {
    const { config, booting_vms, shutting_down_vms, helper_functions } = data;
    const { list_running_vm_ids } = helper_functions;

    // first arg or 1
    const page = data.args[0] ? parseInt(data.args[0]) : 1;

    if (isNaN(page) || page < 1) {
        in_message.reply("Invalid page number.");
        return;
    }

    let embed = new embeds.QueryPendingEmbed()
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

    embed = new embeds.PagedListEmbed()
        .setTitle("Available VMs")
        // info with proper pluralisation. has some ugly inline code but it keeps it compact.
        .setDescription(`There ${Object.keys(config.vmware.vm_list).length === 1 ? "is" : "are"} ${Object.keys(config.vmware.vm_list).length} VM${Object.keys(config.vmware.vm_list).length === 1 ? "" : "s"} in total.
        
        There ${powered_vms.length === 1 ? "is" : "are"} ${powered_vms.length} powered on VM${powered_vms.length === 1 ? "" : "s"}.
        There ${booting_vms.length === 1 ? "is" : "are"} ${booting_vms.length} VM${booting_vms.length === 1 ? "" : "s"} booting.
        There ${shutting_down_vms.length === 1 ? "is" : "are"} ${shutting_down_vms.length} VM${shutting_down_vms.length === 1 ? "" : "s"} shutting down.
        There ${Object.keys(config.vmware.vm_list).length - powered_vms.length === 1 ? "is" : "are"} ${Object.keys(config.vmware.vm_list).length - powered_vms.length} VM${Object.keys(config.vmware.vm_list).length - powered_vms.length === 1 ? "" : "s"} unpowered.

        Key: ${embeds.Icons.POWERED} = Powered, ${embeds.Icons.BOOTING} = Booting, ${embeds.Icons.SHUTTING_DOWN} = Shutting down, ${embeds.Icons.UNPOWERED} = Unpowered`);

    // TODO: move this pagniation to paged list embed class

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

        // choose the correct emoji for the power state
        let power_light = "";
        if (powered_vms.includes(vm_id)) {
            power_light = embeds.Icons.POWERED;
        } else if (booting_vms.includes(vm_id)) {
            power_light = embeds.Icons.BOOTING;
        } else if (shutting_down_vms.includes(vm_id)) {
            power_light = embeds.Icons.SHUTTING_DOWN;
        } else {
            power_light = embeds.Icons.UNPOWERED;
        }

        let title = `${power_light} **${name}** *[${vm_id}]*`;

        // auto truncate the title if it's too long
        title = title.length <= MAX_TITLE_LENGTH ? title : title.slice(0, MAX_TITLE_LENGTH - 3) + "...";

        embed.addFields([{ name: title, value: desc }]);
    }

    out_message.edit({ embeds: [embed] });
};

module.exports = call;
