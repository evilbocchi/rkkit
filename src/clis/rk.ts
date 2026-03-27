#!/usr/bin/env bun
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const yargsInstance = yargs(hideBin(process.argv));

yargsInstance
    .scriptName("rk")
    .parserConfiguration({
        "unknown-options-as-args": true,
    })
    .help(false)
    .version(false)
    .command(
        "$0 <tool> [args..]",
        `Run a Rokit-managed tool`,
        (yargs) => {
            return yargs
                .positional("tool", {
                    describe: "The tool to run",
                    type: "string",
                    demandOption: true,
                })
                .positional("args", {
                    describe: `Arguments to pass to the tool`,
                    type: "string",
                    array: true,
                });
        },
        async (argv) => {
            const rkCommandHandler = (await import("../commands/rk"))
                .rkCommandHandler;
            await rkCommandHandler(argv);
        },
    );

yargsInstance.parse();
