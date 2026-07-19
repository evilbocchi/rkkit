#!/usr/bin/env node
import createYargsWrapper from "./template.js";

const yargsInstance = createYargsWrapper({
    name: "rokit",
    handler: async (argv: { args?: string[] }) => {
        const rokitCommandHandler = (await import("../commands/rokit.js"))
            .rokitCommandHandler;
        const spawnSyncReturns = await rokitCommandHandler({
            args: argv.args as string[],
        });
        process.exit(spawnSyncReturns?.status);
    },
});

yargsInstance.parse();
