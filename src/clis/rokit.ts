#!/usr/bin/env bun
import createYargsWrapper from "./template";

const yargsInstance = createYargsWrapper({
    name: "rokit",
    handler: async (argv) => {
        const rokitCommandHandler = (await import("../commands/rokit"))
            .rokitCommandHandler;
        await rokitCommandHandler({
            args: argv.args as string[],
        });
    },
});

yargsInstance.parse();
