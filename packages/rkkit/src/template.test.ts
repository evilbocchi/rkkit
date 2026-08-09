import { describe, it, expect, vi } from "vitest";
import createYargsWrapper from "./template";

describe("clis/template", () => {
    it("should create a yargs instance and call the handler", async () => {
        const handler = vi.fn().mockResolvedValue(undefined);
        const yargsInstance = createYargsWrapper({
            name: "test-cli",
            handler,
        });

        const originalArgv = process.argv;
        process.argv = ["node", "test-cli", "arg1", "arg2"];

        await yargsInstance.parse("arg1 arg2");

        expect(handler).toHaveBeenCalled();
        const callArgs = handler.mock.calls[0][0];
        expect(callArgs.args).toEqual(["arg1", "arg2"]);

        process.argv = originalArgv;
    });
});
