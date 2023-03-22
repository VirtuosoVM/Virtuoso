import type * as Discord from "discord.js";
import type * as VMRun from "vmrun";

import type * as helper_funcs from "./helper_funcs";

export type Int = number & { __int__: void };

export type Entries<T> = {
    [K in keyof T]: [K, T[K]];
}[keyof T][];

export interface CommandCallData {
    Discord: typeof Discord,
    client: Discord.Client,
    args: string[],
    cased_args: string[],
    commands: { [key: string]: any },
    config: { [key: string]: any },
    booting_vms: string[],
    VMRun: typeof VMRun,
    helper_functions: typeof helper_funcs,
}

export interface CommandCall {
    (
        message: Discord.Message,
        data: CommandCallData
    ): void
}