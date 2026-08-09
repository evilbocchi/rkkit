import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const exampleDirectory = path.dirname(fileURLToPath(import.meta.url));
const rojoCliPath = path.resolve(
    exampleDirectory,
    "../../packages/rkkit/dist/rojo.js",
);

function runRojo(args) {
    return spawnSync(process.execPath, [rojoCliPath, ...args], {
        cwd: exampleDirectory,
        stdio: "pipe",
    });
}

describe("Rojo integration", () => {
    it("runs the configured Rojo version through rkkit", () => {
        const result = runRojo(["--version"]);

        expect(result.status).toBe(0);
        expect(result.stdout.toString()).toContain("7.6.1");
    });

    it("runs a Rojo project command through rkkit", () => {
        const result = runRojo(["sourcemap", "default.project.json"]);

        expect(result.status).toBe(0);

        const sourceMap = JSON.parse(result.stdout.toString());

        expect(sourceMap).toMatchObject({
            name: "rkkit-rojo-example",
            className: "DataModel",
        });
    });
});
