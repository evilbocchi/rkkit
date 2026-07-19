#!/usr/bin/env node
import createYargsWrapper from "./template.js";

const yargsInstance = createYargsWrapper({
    name: "lune",
    handler: async (argv: { args?: string[] }) => {
        const rkCommandHandler = (await import("../commands/rk.js"))
            .rkCommandHandler;
        const childProcess = await rkCommandHandler({
            tool: "lune",
            args: argv.args as string[],
        });
        childProcess.on("exit", process.exit);
    },
});

yargsInstance.parse();
