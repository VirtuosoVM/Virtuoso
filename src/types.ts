import type { Client, Message } from "discord.js";
import type * as VMRun from "vmrun";

import type * as config from "../config.json";
import type * as helper_funcs from "./helper_funcs";

export type Int = number & { __int__: void };

export type Entries<T> = {
    [K in keyof T]: [K, T[K]];
}[keyof T][];


export type BotConfig = typeof config;
export interface CommandCallData {
    client: Client,
    args: string[],
    cased_args: string[],
    commands: { [key: string]: any },
    config: BotConfig,
    booting_vms: string[],
    shutting_down_vms: string[],
    users: { [key: string]: string[] },
    VMRun: typeof VMRun,
    helper_functions: typeof helper_funcs,
}

export interface CommandCall {
    (
        message: Message,
        data: CommandCallData
    ): void
}