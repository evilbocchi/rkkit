#!/usr/bin/env bun
import createYargsWrapper from "./template";

const yargsInstance = createYargsWrapper({
    name: "rojo",
    handler: async (argv) => {
        const rkCommandHandler = (await import("../commands/rk"))
            .rkCommandHandler;
        await rkCommandHandler({
            tool: "rojo",
            args: argv.args as string[],
        });
    },
});

yargsInstance.parse();
