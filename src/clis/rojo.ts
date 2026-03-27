#!/usr/bin/env node
import createYargsWrapper from "./template.js";

const yargsInstance = createYargsWrapper({
    name: "rojo",
    handler: async (argv: { args?: string[] }) => {
        const rkCommandHandler = (await import("../commands/rk.js"))
            .rkCommandHandler;
        await rkCommandHandler({
            tool: "rojo",
            args: argv.args as string[],
        });
    },
});

yargsInstance.parse();
