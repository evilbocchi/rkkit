import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "path";
import os from "os";
import fs from "fs";
import { spawnSync, execSync } from "child_process";
import AdmZip from "adm-zip";
import { logger } from "../core/logging";

vi.mock("fs");
vi.mock("path", async () => {
    const actual = await vi.importActual("path");
    return { ...actual };
});
vi.mock("os");
vi.mock("child_process");
vi.mock("adm-zip", () => {
    return {
        default: vi.fn().mockImplementation(function () {
            return {
                extractAllTo: vi.fn(),
            };
        }),
    };
});
vi.mock("../core/logging", () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

// Mock global fetch
vi.stubGlobal("fetch", vi.fn());

describe("rokit command", () => {
    const mockHomedir = "/home/user";
    const mockCacheDir = path.join(mockHomedir, ".rokit", "rkkit");
    const mockRokitDir = path.join(mockCacheDir, "rokit", "rojo-rbx-rokit");

    let rokitModule: typeof import("./rokit");

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        vi.mocked(os.homedir).mockReturnValue(mockHomedir);
        vi.mocked(os.platform).mockReturnValue("linux" as any);
        vi.mocked(os.arch).mockReturnValue("x64");
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(fs.mkdirSync).mockReturnValue(undefined as any);
        vi.mocked(fs.readdirSync).mockReturnValue([]);
        vi.mocked(fs.statSync).mockReturnValue({
            isDirectory: () => true,
        } as any);

        rokitModule = await import("./rokit");
    });

    describe("ensureCacheFolder", () => {
        it("should create the cache folder if it does not exist", () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);
            const dir = rokitModule.ensureCacheFolder();
            expect(fs.mkdirSync).toHaveBeenCalledWith(mockCacheDir, {
                recursive: true,
            });
            expect(dir).toBe(mockCacheDir);
        });

        it("should not create the cache folder if it already exists", () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            const dir = rokitModule.ensureCacheFolder();
            expect(fs.mkdirSync).not.toHaveBeenCalled();
            expect(dir).toBe(mockCacheDir);
        });
    });

    describe("rokitCommandHandler", () => {
        const mockReleaseData = {
            tag_name: "v1.0.0",
            assets: [
                {
                    name: "rokit-linux-x86_64.zip",
                    browser_download_url: "https://example.com/rokit-linux.zip",
                },
                {
                    name: "rokit-windows-x86_64.zip",
                    browser_download_url:
                        "https://example.com/rokit-windows.zip",
                },
                {
                    name: "rokit-macos-x86_64.zip",
                    browser_download_url: "https://example.com/rokit-macos.zip",
                },
                {
                    name: "rokit-macos-aarch64.zip",
                    browser_download_url:
                        "https://example.com/rokit-macos-arm64.zip",
                },
            ],
        };

        const setupFetchMocks = () => {
            vi.mocked(fetch).mockImplementation(async (url: any) => {
                if (url.toString().includes("api.github.com")) {
                    return {
                        ok: true,
                        json: async () => mockReleaseData,
                    } as any;
                }
                if (url.toString().includes("example.com")) {
                    return {
                        ok: true,
                        arrayBuffer: async () => new ArrayBuffer(8),
                    } as any;
                }
                return { ok: false } as any;
            });
        };

        it("should download the latest version when not cached", async () => {
            setupFetchMocks();

            await rokitModule.rokitCommandHandler({
                version: "latest",
                args: ["install"],
            });

            expect(fetch).toHaveBeenCalledWith(
                "https://api.github.com/repos/rojo-rbx/rokit/releases/latest",
                expect.any(Object),
            );
            expect(fs.writeFileSync).toHaveBeenCalled();
            expect(AdmZip).toHaveBeenCalled();
            expect(spawnSync).toHaveBeenCalledWith(
                path.join(mockRokitDir, "1.0.0", "rokit"),
                ["install"],
                expect.any(Object),
            );
        });

        it("should use the cached version when available and requested", async () => {
            const versionDir = path.join(mockRokitDir, "1.0.0");
            const binPath = path.join(versionDir, "rokit");

            vi.mocked(fs.existsSync).mockImplementation((p) => {
                if (typeof p !== "string") return false;
                if (p === binPath) return true;
                if (p === versionDir) return true;
                if (p === mockRokitDir) return true;
                return false;
            });

            await rokitModule.rokitCommandHandler({
                version: "1.0.0",
                args: ["list"],
            });

            expect(fetch).not.toHaveBeenCalled();
            expect(spawnSync).toHaveBeenCalledWith(
                binPath,
                ["list"],
                expect.any(Object),
            );
        });

        it("should use local latest version when remote fetch fails", async () => {
            vi.mocked(fetch).mockResolvedValue({
                ok: false,
                statusText: "Not Found",
            } as any);

            vi.mocked(fs.existsSync).mockImplementation((p) => {
                if (typeof p !== "string") return false;
                if (p === mockRokitDir) return true;
                return false;
            });
            vi.mocked(fs.readdirSync).mockReturnValue([
                "0.9.0",
                "1.0.0",
            ] as any);
            vi.mocked(fs.statSync).mockReturnValue({
                isDirectory: () => true,
            } as any);

            const binPath = path.join(mockRokitDir, "1.0.0", "rokit");
            vi.mocked(fs.existsSync).mockImplementation((p) => {
                if (typeof p !== "string") return false;
                if (p === binPath) return true;
                if (p === mockRokitDir) return true;
                return false;
            });

            await rokitModule.rokitCommandHandler({
                version: "latest",
                args: ["run"],
            });

            expect(logger.warn).toHaveBeenCalledWith(
                expect.stringContaining("using local latest: 1.0.0"),
            );
            expect(spawnSync).toHaveBeenCalledWith(
                binPath,
                ["run"],
                expect.any(Object),
            );
        });

        it("should log error when both remote fetch and local versions are missing", async () => {
            vi.mocked(fetch).mockResolvedValue({
                ok: false,
                statusText: "Not Found",
            } as any);

            vi.mocked(fs.existsSync).mockReturnValue(false);
            vi.mocked(fs.readdirSync).mockReturnValue([]);

            await rokitModule.rokitCommandHandler({
                version: "latest",
                args: [],
            });

            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining("no local versions found either"),
            );
            expect(spawnSync).not.toHaveBeenCalled();
        });

        it("should default to latest if version is not provided and no local versions exist", async () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);
            vi.mocked(fs.readdirSync).mockReturnValue([]);
            setupFetchMocks();

            await rokitModule.rokitCommandHandler({ args: ["list"] });

            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining("releases/latest"),
                expect.any(Object),
            );
        });

        it("should use the highest local version if version is not provided", async () => {
            vi.mocked(fs.readdirSync).mockReturnValue([
                "0.9.0",
                "1.1.0",
                "1.0.0",
            ] as any);
            const binPath = path.join(mockRokitDir, "1.1.0", "rokit");
            vi.mocked(fs.existsSync).mockImplementation((p) => {
                if (typeof p !== "string") return false;
                if (p === binPath) return true;
                if (p === mockRokitDir) return true;
                return false;
            });

            await rokitModule.rokitCommandHandler({ args: ["list"] });

            expect(spawnSync).toHaveBeenCalledWith(
                binPath,
                ["list"],
                expect.any(Object),
            );
        });

        it("should handle Windows platform correctly", async () => {
            vi.mocked(os.platform).mockReturnValue("win32");
            vi.mocked(os.arch).mockReturnValue("x64");
            setupFetchMocks();

            await rokitModule.rokitCommandHandler({
                version: "latest",
                args: [],
            });

            const binPath = path.join(mockRokitDir, "1.0.0", "rokit.exe");
            expect(spawnSync).toHaveBeenCalledWith(
                binPath,
                [],
                expect.any(Object),
            );
        });

        it("should handle macOS ARM64 correctly", async () => {
            vi.mocked(os.platform).mockReturnValue("darwin");
            vi.mocked(os.arch).mockReturnValue("arm64");
            setupFetchMocks();

            await rokitModule.rokitCommandHandler({
                version: "latest",
                args: [],
            });

            expect(fetch).toHaveBeenCalledWith(
                "https://example.com/rokit-macos-arm64.zip",
            );
        });

        it("should use GITHUB_TOKEN if available", async () => {
            process.env.GITHUB_TOKEN = "mock-token";
            setupFetchMocks();

            await rokitModule.rokitCommandHandler({
                version: "latest",
                args: [],
            });

            expect(fetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: "Bearer mock-token",
                    }),
                }),
            );
            delete process.env.GITHUB_TOKEN;
        });

        it("should fallback to gh auth token if GITHUB_TOKEN is not set", async () => {
            delete process.env.GITHUB_TOKEN;
            vi.mocked(execSync).mockReturnValue("gh-token\n" as any);
            setupFetchMocks();

            await rokitModule.rokitCommandHandler({
                version: "latest",
                args: [],
            });

            expect(execSync).toHaveBeenCalledWith(
                "gh auth token",
                expect.any(Object),
            );
            expect(fetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: "Bearer gh-token",
                    }),
                }),
            );
        });

        it("should throw error for unsupported platform", async () => {
            vi.mocked(os.platform).mockReturnValue("freebsd" as any);
            setupFetchMocks();

            await expect(
                rokitModule.rokitCommandHandler({
                    version: "latest",
                    args: [],
                }),
            ).rejects.toThrow("Unsupported platform: freebsd");
        });

        it("should handle download failures", async () => {
            vi.mocked(fetch).mockImplementation(async (url: any) => {
                if (url.toString().includes("api.github.com")) {
                    return {
                        ok: true,
                        json: async () => mockReleaseData,
                    } as any;
                }
                return {
                    ok: false,
                    statusText: "Forbidden",
                } as any;
            });

            await rokitModule.rokitCommandHandler({
                version: "latest",
                args: [],
            });

            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining(
                    "failed to download rokit from https://example.com/rokit-linux.zip: Forbidden",
                ),
            );
        });
    });
});
