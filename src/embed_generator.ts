import { EmbedBuilder } from "discord.js";

// TODO: use as error logger
// TODO: make commonly reused embeds (e.g. querying power state, etc.) into classes

export enum Icons {
    SUCCESS = ":green_circle:",
    ERROR = ":red_circle:",
    INFO = ":white_circle:",
    ACTION_PENDING = ":yellow_circle:",
    QUERY_PENDING = ":purple_circle:",
    PAGED_LIST = ":blue_circle:",
    CONFIRMATION = ":orange_circle:",
    ARGUMENT_ISSUE = ":black_circle:",

    FATAL = ":x:",

    SCREENSHOT_PENDING = ":camera:",
    SCREENSHOT_SUCCESS = ":camera_with_flash:",

    YES = ":white_check_mark:",
    NO = ":x:",

    POWERED = ":green_square:",
    BOOTING = ":yellow_square:",
    SHUTTING_DOWN = ":orange_square:",
    UNPOWERED = ":red_square:",
}

class BaseEmbed extends EmbedBuilder {
    #title_icon = "";

    setTitleIconless(title: string) {
        super.setTitle(title);
        return this;
    }

    setTitle(title: string) {
        if (this.#title_icon !== "") {
            super.setTitle(`${this.#title_icon} ${title}`);
            return this;
        } else {
            return this.setTitleIconless(title);
        }
    }

    updateTitleIcon() {
        if (this.#title_icon !== "") {
            const title = super.data.title;

            if (title) {
                super.setTitle(`${this.#title_icon} ${title}`);
            }
        }
    }

    setTitleIcon(icon: string) {
        this.#title_icon = icon;
        return this;
    }

    constructor() {
        super();

        this
            .setColor(0x000000)
            .setAuthor({ name: "Virtuoso" });
    }
}

export class InfoEmbed extends BaseEmbed {
    constructor() {
        super();

        this
            .setColor(0xFFFFFF)
            .setTitleIcon(Icons.INFO)
            .setAuthor({ name: "Info" });
    }
}

export class SuccessEmbed extends BaseEmbed {
    constructor() {
        super();

        this
            .setColor(0x00FF00)
            .setTitleIcon(Icons.SUCCESS)
            .setAuthor({ name: "Success" });
    }
}

export class ErrorEmbed extends BaseEmbed {
    constructor() {
        super();

        this
            .setColor(0xFF0000)
            .setTitleIcon(Icons.ERROR)
            .setAuthor({ name: "Error" });
    }
}

export class ActionPendingEmbed extends BaseEmbed {
    constructor() {
        super();

        this
            .setColor(0xFFFF00)
            .setTitleIcon(Icons.ACTION_PENDING)
            .setAuthor({ name: "Action Pending" });
    }
}

export class QueryPendingEmbed extends BaseEmbed {
    constructor() {
        super();

        this
            .setColor(0xFF00FF)
            .setTitleIcon(Icons.QUERY_PENDING)
            .setAuthor({ name: "Query Pending" });
    }
}

export class PagedListEmbed extends BaseEmbed {
    constructor() {
        super();

        this
            .setColor(0x0000FF)
            .setTitleIcon(Icons.PAGED_LIST)
            .setAuthor({ name: "Paged List" });
    }
}

export class FatalEmbed extends BaseEmbed {
    constructor() {
        super();

        this
            .setColor(0xFF0000)
            .setTitleIcon(Icons.FATAL)
            .setFooter({ text: "Please consult with the bot administrator." })
            .setAuthor({ name: "Fatal" });
    }
}

export class ConfirmationEmbed extends BaseEmbed {
    constructor() {
        super();

        this
            .setColor(0xFFAA00)
            .setTitleIcon(Icons.CONFIRMATION)
            .setAuthor({ name: "Confirmation" });
    }
}

export class ArgumentIssueEmbed extends BaseEmbed {
    constructor() {
        super();

        this
            .setColor(0xCCCCCC)
            .setTitleIcon(Icons.ARGUMENT_ISSUE)
            .setAuthor({ name: "Argument Issue" });
    }
}


export class ScreenshotPendingEmbed extends ActionPendingEmbed {
    constructor(vm_id: string) {
        super();

        this
            .setTitleIcon(Icons.SCREENSHOT_PENDING)
            .setTitle("Screenshot Loading")
            .setDescription(`Taking a screenshot of VM ${vm_id}...`)
            .setTimestamp();
    }
}

export class ScreenshotSuccessEmbed extends SuccessEmbed {
    constructor(vm_id: string, image_name: string) {
        super();

        this
            .setTitleIcon(Icons.SCREENSHOT_SUCCESS)
            .setTitle("Screenshot Taken")
            .setDescription(`Screenshot of VM ${vm_id}:`)
            .setImage(`attachment://${image_name}`)
            .setTimestamp();
    }
}