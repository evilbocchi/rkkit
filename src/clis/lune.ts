#!/usr/bin/env bun
import createYargsWrapper from "./template";

const yargsInstance = createYargsWrapper({
    name: "lune",
    handler: async (argv) => {
        const rkCommandHandler = (await import("../commands/rk"))
            .rkCommandHandler;
        await rkCommandHandler({
            tool: "lune",
            args: argv.args as string[],
        });
    },
});

yargsInstance.parse();
