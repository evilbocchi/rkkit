import yargs from "yargs";
import { hideBin } from "yargs/helpers";

export default function createYargsWrapper({
    name,
    handler,
}: {
    name: string;
    handler: (argv: { args?: string[] }) => Promise<void>;
}) {
    const yargsInstance = yargs(hideBin(process.argv));

    return yargsInstance
        .scriptName(name)
        .parserConfiguration({
            "unknown-options-as-args": true,
        })
        .help(false)
        .version(false)
        .command(
            "$0 [args..]",
            `Run the ${name} CLI`,
            (yargs) => {
                return yargs.positional("args", {
                    describe: `Arguments to pass to the ${name} CLI`,
                    type: "string",
                    array: true,
                });
            },
            async (argv) => {
                await handler(argv);
            },
        );
}
