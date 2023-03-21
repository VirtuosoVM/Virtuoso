import type { Message, Client } from "discord.js";

export type Int = number & { __int__: void };

export interface UserData {
    id: bigint,
}

export interface CommandCall {
    (
        message: Message,
        data: {
            Discord: any,
            client: Client,
            args: string[],
            cased_args: string[],
            commands: { [key: string]: any }
        }
    ): void
}