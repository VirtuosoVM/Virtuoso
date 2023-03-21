import type * as Discord from "discord.js";

export type Int = number & { __int__: void };

export type Entries<T> = {
    [K in keyof T]: [K, T[K]];
}[keyof T][];

export interface CommandCall {
    (
        message: Discord.Message,
        data: {
            Discord: typeof Discord,
            client: Discord.Client,
            args: string[],
            cased_args: string[],
            commands: { [key: string]: any },
            config: { [key: string]: any },
            powered_vms: string[],
        }
    ): void
}