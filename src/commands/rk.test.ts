import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "path";
import os from "os";
import fs from "fs";
import { spawn, spawnSync } from "child_process";
import { logger } from "../core/logging";

vi.mock("fs");
vi.mock("path", async () => {
    const actual = await vi.importActual("path");
    return { ...actual };
});
vi.mock("os");
vi.mock("child_process");
vi.mock("../core/logging", () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

if (fs.constants === undefined) {
    (fs as any).constants = { X_OK: 1 };
}

const mockRokitCommandHandler = vi.fn();
vi.mock("./rokit.js", () => ({
    rokitCommandHandler: mockRokitCommandHandler,
}));

vi.stubGlobal("Bun", {
    file: vi.fn().mockReturnValue({
        text: vi.fn().mockResolvedValue(""),
    }),
    TOML: {
        parse: vi.fn().mockReturnValue({}),
    },
    semver: {
        satisfies: vi.fn().mockReturnValue(true),
        order: vi.fn().mockReturnValue(0),
    },
});

describe("rk command", () => {
    const mockHomedir = "/home/user";
    const mockCwd = "/home/user/project";
    const mockTomlPath = path.join(mockCwd, "rokit.toml");

    let rkModule: typeof import("./rk");

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        vi.mocked(os.homedir).mockReturnValue(mockHomedir);
        vi.mocked(os.platform).mockReturnValue("linux" as any);
        vi.spyOn(process, "cwd").mockReturnValue(mockCwd);
        vi.spyOn(process, "exit").mockImplementation((code) => {
            throw new Error(`process.exit(${code})`);
        });

        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(fs.readdirSync).mockReturnValue([]);
        vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any);

        rkModule = await import("./rk");
    });

    describe("rkCommandHandler and rkCommandHandlerSync", () => {
        it("should log an error and exit if rokit.toml is not found and autoInit is false", async () => {
            await expect(rkModule.rkCommandHandler({ tool: "lune", autoInit: false })).rejects.toThrow("process.exit(1)");
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("could not find rokit.toml"));
        });

        it("should automatically initialize rokit.toml if autoInit is true", async () => {
            let hasInited = false;
            vi.mocked(fs.existsSync).mockImplementation((p) => {
                if (typeof p !== "string") return false;
                if (p === mockTomlPath) return hasInited;
                if (p.includes("tool-storage")) return true;
                if (p.includes("lune")) return true;
                return false;
            });
            mockRokitCommandHandler.mockImplementation(async () => {
                hasInited = true;
                return { status: 0 };
            });
            vi.mocked(Bun.file).mockReturnValue({
                text: vi.fn().mockResolvedValue('tools = { lune = "rojo-rbx/lune@0.0.0" }'),
            } as any);
            vi.mocked(Bun.TOML.parse).mockReturnValue({ tools: { lune: "rojo-rbx/lune@0.0.0" } });
            vi.mocked(fs.readdirSync).mockReturnValue(["0.0.0"] as any);
            vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any);
            vi.mocked(fs.accessSync).mockReturnValue(undefined);

            await rkModule.rkCommandHandler({ tool: "lune", autoInit: true });
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("automatically initializing one"));
            expect(mockRokitCommandHandler).toHaveBeenCalledWith(expect.objectContaining({ args: ["init"] }));
        });

        it("should parse rokit.toml and spawn the tool", async () => {
            vi.mocked(fs.existsSync).mockImplementation((p) => {
                if (typeof p !== "string") return false;
                if (p === mockTomlPath) return true;
                if (p.includes("tool-storage")) return true;
                if (p.includes("lune")) return true;
                return false;
            });
            vi.mocked(Bun.file).mockReturnValue({
                text: vi.fn().mockResolvedValue('tools = { lune = "rojo-rbx/lune@0.21.0" }'),
            } as any);
            vi.mocked(Bun.TOML.parse).mockReturnValue({ tools: { lune: "rojo-rbx/lune@0.21.0" } });
            vi.mocked(fs.readdirSync).mockReturnValue(["0.21.0"] as any);
            vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any);
            vi.mocked(fs.accessSync).mockReturnValue(undefined);

            await rkModule.rkCommandHandler({ tool: "lune", args: ["--version"] });
            const expectedBinPath = path.join(mockHomedir, ".rokit", "tool-storage", "rojo-rbx", "lune", "0.21.0", "lune");
            expect(spawn).toHaveBeenCalledWith(expectedBinPath, ["--version"], expect.any(Object));
        });

        it("should handle tools specified as owner/repo", async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(Bun.TOML.parse).mockReturnValue({ tools: { lune: "rojo-rbx/lune@0.21.0" } });
            vi.mocked(fs.readdirSync).mockReturnValue(["0.21.0"] as any);
            await rkModule.rkCommandHandler({ tool: "rojo-rbx/lune", args: [] });
            const expectedBinPath = path.join(mockHomedir, ".rokit", "tool-storage", "rojo-rbx", "lune", "0.21.0", "rojo-rbx", "lune");
            expect(spawn).toHaveBeenCalledWith(expectedBinPath, [], expect.any(Object));
        });

        it("should install the tool if it's not in rokit.toml", async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(Bun.TOML.parse)
                .mockReturnValueOnce({ tools: {} })
                .mockReturnValue({ tools: { lune: "rojo-rbx/lune@0.21.0" } });
            mockRokitCommandHandler.mockResolvedValue({ status: 0 });
            vi.mocked(fs.readdirSync).mockReturnValue(["0.21.0"] as any);
            await rkModule.rkCommandHandler({ tool: "rojo-rbx/lune" });
            expect(mockRokitCommandHandler).toHaveBeenCalledWith(expect.objectContaining({ args: ["add", "rojo-rbx/lune"] }));
        });

        it("should run rokit install if the required version is not found", async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(Bun.TOML.parse).mockReturnValue({ tools: { lune: "rojo-rbx/lune@0.21.0" } });
            vi.mocked(fs.readdirSync).mockReturnValueOnce([]).mockReturnValue(["0.21.0"] as any);
            mockRokitCommandHandler.mockResolvedValue({ status: 0 });
            await rkModule.rkCommandHandler({ tool: "lune" });
            expect(mockRokitCommandHandler).toHaveBeenCalledWith(expect.objectContaining({ args: ["install"] }));
        });

        it("should handle Windows executable names", async () => {
            vi.mocked(os.platform).mockReturnValue("win32");
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(Bun.TOML.parse).mockReturnValue({ tools: { lune: "rojo-rbx/lune@0.21.0" } });
            vi.mocked(fs.readdirSync).mockReturnValue(["0.21.0"] as any);
            await rkModule.rkCommandHandler({ tool: "lune" });
            const expectedBinPath = path.join(mockHomedir, ".rokit", "tool-storage", "rojo-rbx", "lune", "0.21.0", "lune.exe");
            expect(spawn).toHaveBeenCalledWith(expectedBinPath, [], expect.any(Object));
        });

        it("rkCommandHandlerSync should use spawnSync", async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(Bun.TOML.parse).mockReturnValue({ tools: { lune: "rojo-rbx/lune@0.21.0" } });
            vi.mocked(fs.readdirSync).mockReturnValue(["0.21.0"] as any);
            await rkModule.rkCommandHandlerSync({ tool: "lune" });
            expect(spawnSync).toHaveBeenCalled();
        });

        it("should handle semver satisfaction", async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(Bun.TOML.parse).mockReturnValue({ tools: { lune: "rojo-rbx/lune@^0.21.0" } });
            vi.mocked(fs.readdirSync).mockReturnValue(["0.21.1", "0.20.0"] as any);
            vi.mocked(Bun.semver.satisfies).mockImplementation((v, range) => v === "0.21.1");
            vi.mocked(Bun.semver.order).mockImplementation((a, b) => (a === "0.21.1" ? 1 : -1));
            await rkModule.rkCommandHandler({ tool: "lune" });
            expect(spawn).toHaveBeenCalledWith(expect.stringContaining("0.21.1"), [], expect.any(Object));
        });

        it("should exit if no satisfying version is found after install", async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(Bun.TOML.parse).mockReturnValue({ tools: { lune: "rojo-rbx/lune@^0.21.0" } });
            vi.mocked(fs.readdirSync).mockReturnValue(["0.20.0"] as any);
            vi.mocked(Bun.semver.satisfies).mockReturnValue(false);
            mockRokitCommandHandler.mockResolvedValue({ status: 0 });
            await expect(rkModule.rkCommandHandler({ tool: "lune" })).rejects.toThrow("process.exit(1)");
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("could not find an installed version"));
        });

        it("should exit if rokit install fails", async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(Bun.TOML.parse).mockReturnValue({ tools: { lune: "rojo-rbx/lune@0.21.0" } });
            vi.mocked(fs.readdirSync).mockReturnValue([]);
            mockRokitCommandHandler.mockResolvedValue({ status: 1 });
            await expect(rkModule.rkCommandHandler({ tool: "lune" })).rejects.toThrow("process.exit(1)");
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("failed to install tools via rokit."));
        });

        it("should handle missing tool storage directory", async () => {
            vi.mocked(fs.existsSync).mockImplementation((p) => {
                if (typeof p !== "string") return false;
                if (p === mockTomlPath) return true;
                if (p.includes("0.21.0")) return false;
                if (p.includes("tool-storage")) return true;
                return false;
            });
            vi.mocked(Bun.TOML.parse).mockReturnValue({ tools: { lune: "rojo-rbx/lune@0.21.0" } });
            vi.mocked(fs.readdirSync).mockReturnValue(["0.21.0"] as any);
            await expect(rkModule.rkCommandHandler({ tool: "lune" })).rejects.toThrow("process.exit(1)");
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("tool storage directory not found"));
        });

        it("should scan directory for an executable if default names are not found", async () => {
            vi.mocked(fs.existsSync).mockImplementation((p) => {
                if (typeof p !== "string") return false;
                if (p === mockTomlPath) return true;
                if (p.endsWith(path.join("0.21.0", "lune"))) return false;
                if (p.includes("tool-storage")) return true;
                return true;
            });
            vi.mocked(Bun.TOML.parse).mockReturnValue({ tools: { lune: "rojo-rbx/lune@0.21.0" } });
            vi.mocked(fs.readdirSync).mockImplementation((p) => {
                const pathStr = p.toString();
                if (pathStr.includes("0.21.0")) return ["random-exe"] as any;
                if (pathStr.includes("rojo-rbx")) return ["0.21.0"] as any;
                return ["0.21.0"] as any;
            });
            vi.mocked(fs.statSync).mockImplementation((p) => {
                const pathStr = p.toString();
                if (pathStr.includes("0.21.0") && pathStr.endsWith("random-exe")) {
                    return { isDirectory: () => false } as any;
                }
                return { isDirectory: () => true } as any;
            });
            vi.mocked(fs.accessSync).mockReturnValue(undefined);
            mockRokitCommandHandler.mockResolvedValue({ status: 0 });
            await rkModule.rkCommandHandler({ tool: "lune" });
            expect(spawn).toHaveBeenCalledWith(expect.stringContaining("random-exe"), expect.any(Array), expect.any(Object));
        });

        it("should exit if no executable is found in the tool storage", async () => {
            vi.mocked(fs.existsSync).mockImplementation((p) => {
                if (typeof p !== "string") return false;
                if (p === mockTomlPath) return true;
                if (p.endsWith(path.join("0.21.0", "lune"))) return false; 
                if (p.includes("tool-storage")) return true;
                return true;
            });
            vi.mocked(Bun.TOML.parse).mockReturnValue({ tools: { lune: "rojo-rbx/lune@0.21.0" } });
            vi.mocked(fs.readdirSync).mockImplementation((p) => {
                const pathStr = p.toString();
                if (pathStr.includes("0.21.0")) return ["not-an-exe"] as any;
                if (pathStr.includes("rojo-rbx")) return ["0.21.0"] as any;
                return ["0.21.0"] as any;
            });
            vi.mocked(fs.statSync).mockImplementation((p) => {
                const pathStr = p.toString();
                if (pathStr.includes("0.21.0") && pathStr.endsWith("not-an-exe")) {
                    return { isDirectory: () => false } as any;
                }
                return { isDirectory: () => true } as any;
            });
            vi.mocked(fs.accessSync).mockImplementation(() => { throw new Error("not executable"); });
            mockRokitCommandHandler.mockResolvedValue({ status: 0 });
            await expect(rkModule.rkCommandHandler({ tool: "lune" })).rejects.toThrow("process.exit(1)");
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("could not find an executable"));
        });
    });
});