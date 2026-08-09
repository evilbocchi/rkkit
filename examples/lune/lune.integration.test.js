import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const exampleDirectory = path.dirname(fileURLToPath(import.meta.url));
const luneCliPath = path.resolve(
    exampleDirectory,
    "../../packages/rkkit/dist/lune.js",
);

function runLune(args) {
    return spawnSync(process.execPath, [luneCliPath, ...args], {
        cwd: exampleDirectory,
        stdio: "pipe",
    });
}

describe("Lune integration", () => {
    it("runs the configured Lune version through rkkit", () => {
        const result = runLune(["--version"]);

        expect(result.status).toBe(0);
        expect(result.stdout.toString()).toContain("0.10.4");
    });

    it("runs a Lune script through rkkit", () => {
        const result = runLune(["run", "lune.luau"]);

        expect(result.status).toBe(0);
        expect(result.stdout.toString()).toContain(
            "rkkit Lune integration example",
        );
    });
});
