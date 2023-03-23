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

export enum PaginationType {
    NONE,
    NO_REACTIONS,
    REACTIONS,
}

const MAX_FIELDS = 25;

export class TooHighPageIndexError extends Error {
    constructor(field_count: number, num_pages: number) {
        // use proper pluralisation
        const txt_are_is = field_count === 1 ? "is" : "are";
        const txt_pages_page = num_pages === 1 ? "page" : "pages";
        super(`Invalid page number. There ${txt_are_is} only ${num_pages} ${txt_pages_page}.`);
    }
}

export class PagedListEmbed extends BaseEmbed {
    #pagination_type = PaginationType.NONE;
    #page_field_limit = MAX_FIELDS;

    #added_fields = [];
    #current_page = 0;

    #known_field_count;

    constructor() {
        super();

        this
            .setColor(0x0000FF)
            .setTitleIcon(Icons.PAGED_LIST)
            .setAuthor({ name: "Paged List" });
    }

    #calculateNumPages(field_count: number) {
        return Math.ceil(field_count / this.#page_field_limit);
    }

    // functions shown in the order they should be called in

    /**
     * Sets the type of pagination to use.
     * 
     * Run this first.
     * 
     * @param pagination_type The type of pagination to use. If set to NONE, no pagination will be used.
     * @returns 
     */
    setPaginationType(pagination_type: PaginationType) {
        this.#pagination_type = pagination_type;
        return this;
    }

    /**
     * Sets the maximum number of fields to show per page.
     * 
     * Run this just after setPaginationType.
     * 
     * @param page_field_limit The maximum number of fields to show per page. Must be less than or equal to 25.
     * @returns this
     * @throws Error if page_field_limit is greater than 25.
     * @throws Error if page_field_limit is less than 1.
     * @throws Error if page_field_limit is not an integer.
     */
    setPageFieldLimit(page_field_limit: number) {
        if (page_field_limit < 1) {
            throw new Error("Page field limit cannot be less than 1.");
        }

        if (!Number.isInteger(page_field_limit)) {
            throw new Error("Page field limit must be an integer.");
        }

        if (page_field_limit > MAX_FIELDS) {
            throw new Error(`Page field limit cannot exceed ${MAX_FIELDS} fields.`);
        }

        this.#page_field_limit = page_field_limit;

        return this;
    }

    /**
     * Sets the number of fields you guarantee will be added to the embed.
     * Used to validate the set page number before adding fields.
     * 
     * You can optionally run this after setPageFieldLimit.
     * 
     * @param known_field_count The number of fields you guarantee will be added to the embed.
     * @returns this
     * @throws Error if known_field_count is less than 0.
     */
    setKnownFieldCount(known_field_count: number) {
        if (known_field_count < 0) {
            throw new Error("Known field count cannot be negative.");
        }

        this.#known_field_count = known_field_count;
        return this;
    }

    /**
     * Sets the current page number.
     * 
     * Run this after setKnownFieldCount if you are using it, otherwise run this after setPageFieldLimit.
     * You need to use setKnownFieldCount if you want to check if the page number is too high here.
     * 
     * @param current_page The current page number.
     * @returns this
     * @throws Error if current_page is less than 0.
     * @throws TooHighPageIndexError if current_page is greater than the number of pages.
     */
    setCurrentPage(current_page: number) {
        if (current_page < 0) {
            throw new Error("Page number cannot be negative.");
        }

        if (this.#known_field_count) {
            const num_pages = this.#calculateNumPages(this.#known_field_count);

            if (current_page > num_pages) {
                throw new TooHighPageIndexError(this.#known_field_count, num_pages);
            }
        }

        this.#current_page = current_page;
        return this;
    }

    /**
     * Adds fields to the embed.
     * 
     * Run this after setCurrentPage.
     * 
     * @param fields The fields to add.
     * @returns this
     */
    addFields(fields: { name: string, value: string, inline?: boolean }[]) {
        fields.forEach((field) => {
            this.#added_fields.push(field);
        });

        if (this.#pagination_type === PaginationType.NONE) {
            super.addFields(fields);
            return this;
        }

        // if pagination is enabled, only add fields to the embed if they are within the current page
        if (this.#added_fields.length < (this.#current_page * this.#page_field_limit) ||
            this.#added_fields.length > this.#page_field_limit) {
            // don't add to the embed
            return this;
        }

        super.addFields(fields);

        return this;
    }

    /**
     * Finalises the embed and performs a final page number check.
     * 
     * Run this last.
     * 
     * @returns this
     * @throws TooHighPageIndexError if the current page number is too high.
     */
    finishedAddingFields() {
        if (this.#pagination_type === PaginationType.NONE) {
            return this;
        }

        // calculate the number of pages
        const num_pages = this.#calculateNumPages(this.#added_fields.length);

        if (this.#current_page >= num_pages) {
            throw new TooHighPageIndexError(this.#added_fields.length, num_pages);
        }

        // add the page number to the footer
        super.setFooter({ text: `Page: ${this.#current_page + 1}/${num_pages}` });
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




export class QueryingPowerStateEmbed extends QueryPendingEmbed {
    /**
     * Generic embed based on QueryPendingEmbed for querying the power state of a VM.
     * 
     * @param vm_id The ID of the VM. Set to null to switch to "querying list of power states" mode.
     */
    constructor(vm_id: string | null) {
        super();

        const state_suffix = vm_id === null ? "s" : ` of VM ${vm_id}`;

        this
            .setTitle(`Querying power state${state_suffix}...`)
            .setDescription("This may take a few seconds...")
            .setTimestamp();
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