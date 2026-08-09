#!/usr/bin/env node
import createYargsWrapper from "./template.js";

const yargsInstance = createYargsWrapper({
    name: "rojo",
    handler: async (argv: { args?: string[] }) => {
        const rkCommandHandler = (await import("@unrealworks/rkkit-core"))
            .rkCommandHandler;
        const childProcess = await rkCommandHandler({
            tool: "rojo",
            args: argv.args as string[],
        });
        childProcess.on("exit", process.exit);
    },
});

yargsInstance.parse();
