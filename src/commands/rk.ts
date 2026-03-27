import {
    spawn,
    spawnSync,
    SpawnSyncOptionsWithBufferEncoding,
} from "child_process";
import fs from "fs";
import { readFile } from "fs/promises";
import os from "os";
import path from "path";
import { parse as parseToml } from "@iarna/toml";
import * as semver from "semver";
import { logger } from "../core/logging.js";
import { rokitCommandHandler } from "./rokit.js";

export type RkCommandOptions = {
    /**
     * The version of Rokit to use for this command. If not specified, the local Rokit installation will be used. If no local installation is found, the latest version of Rokit will be used.
     */
    rokitVersion?: string;
    /**
     * The name of the tool to run, as defined in the `tools` section of `rokit.toml`. This can be a simple name like "lune" or a more specific identifier like "owner/repo". The command handler will look up this tool in `rokit.toml` to determine the correct version and path to the executable, and will automatically install it via Rokit if it's not already installed.
     */
    tool: string;
    /**
     * Arguments to pass to the tool executable. This should be an array of strings, where each string is a separate argument. For example, if you want to run `lune build --watch`, you would set `args` to `["build", "--watch"]`. These arguments will be passed directly to the tool's executable when it is spawned.
     */
    args?: string[];
    /**
     * If true, the command handler will automatically initialize a `rokit.toml` in the current directory if one cannot be found in the current or parent directories. This is useful for commands that require Rokit but may be run in a directory that hasn't been set up with Rokit yet. If this option is not set and no `rokit.toml` is found, the command will log an error and exit.
     */
    autoInit?: boolean;
    /**
     * Additional options to pass to the `spawn` or `spawnSync` function when running the tool executable. This can include options like `stdio`, `env`, `cwd`, etc. For example, you might want to set `stdio: "inherit"` to have the tool's output be printed directly to the console, or you might want to set environment variables in `env`. These options will be merged with some default options that ensure the tool runs correctly, and then passed to the spawn function when executing the tool.
     */
    options?: SpawnSyncOptionsWithBufferEncoding;
};

/**
 * Command handler for `rk` command. This command allows you to run any tool defined in your `rokit.toml` file, automatically handling installation and execution of the tool.
 * @returns A ChildProcess instance representing the spawned tool process. You can listen to events on this instance to handle output, errors, and process exit. Note that this function does not wait for the process to complete; it returns immediately after spawning the process. If you need to run a tool in a blocking manner, consider using `rkCommandHandlerSync` instead, which uses `spawnSync` and waits for the process to finish before returning.
 */
export async function rkCommandHandler(options: RkCommandOptions) {
    const { binPath, spawnOptions } = await ensureRk(options);
    return spawn(binPath, options.args ?? [], spawnOptions);
}

/**
 * Synchronous version of the rk command handler. This can be used for tools that need to be run in a blocking manner, where you want to wait for the tool to finish before proceeding with other tasks.
 * @returns The result of `spawnSync`, which includes the exit code, stdout, stderr, and other information about the executed process. You can check the `status` property to see the exit code, and the `stdout` and `stderr` properties for any output from the tool.
 */
export async function rkCommandHandlerSync(options: RkCommandOptions) {
    const { binPath, spawnOptions } = await ensureRk(options);
    return spawnSync(binPath, options.args ?? [], spawnOptions);
}

/**
 * Ensures that the specified Rokit tool is installed and returns the path to the executable along with spawn options. This function will:
 * 1. Look for `rokit.toml` in the current and parent directories.
 * 2. Parse `rokit.toml` to find the specified tool and its version.
 * 3. Check if the tool is installed in Rokit's tool storage.
 * 4. If not installed, run `rokit install` to install it.
 * 5. Find the executable for the tool and return its path along with any necessary spawn options.
 * @returns An object containing the path to the tool's executable and spawn options to use when running it.
 */
async function ensureRk({
    rokitVersion,
    tool,
    autoInit,
    options = {
        stdio: "inherit",
    },
}: RkCommandOptions) {
    // 1. Walk up the directory tree to find `rokit.toml`.
    let currentDir = process.cwd();
    let tomlPath: string | undefined;

    while (true) {
        const potentialPath = path.join(currentDir, "rokit.toml");
        if (fs.existsSync(potentialPath)) {
            tomlPath = potentialPath;
            break;
        }
        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
            break;
        }
        currentDir = parentDir;
    }

    if (!tomlPath) {
        if (!autoInit) {
            logger.error(
                "could not find rokit.toml in the current or parent directories. please create it if you are sure you are in the right directory!",
            );
            process.exit(1);
        } else {
            logger.info(
                "could not find rokit.toml, automatically initializing one in the current directory...",
            );
            const initResult = await rokitCommandHandler({
                version: rokitVersion,
                args: ["init"],
                options: { stdio: "inherit", cwd: process.cwd() },
            });

            if (initResult && initResult.status !== 0) {
                logger.error("failed to automatically initialize rokit.");
                process.exit(1);
            }
            tomlPath = path.join(process.cwd(), "rokit.toml");

            if (!fs.existsSync(tomlPath)) {
                logger.error(
                    "rokit.toml was still not found after running rokit init.",
                );
                process.exit(1);
            }
        }
    }

    // 2. Read and parse rokit.toml.
    let tomlContent = await readFile(tomlPath, "utf-8");
    let tomlData: { tools?: Record<string, unknown> };
    try {
        tomlData = parseToml(tomlContent) as {
            tools?: Record<string, unknown>;
        };
    } catch (err) {
        logger.error(`failed to parse ${tomlPath}: ${err}`);
        process.exit(1);
    }

    let tools = tomlData.tools || {};
    const getToolEntry = (t: Record<string, unknown>, name: string) => {
        if (t[name]) return t[name];
        const parts = name.split("@")[0].split("/");
        if (parts.length > 1) {
            const repoName = parts[parts.length - 1];
            if (t[repoName]) {
                const entry = t[repoName];
                if (
                    typeof entry === "string" &&
                    entry.split("@")[0] === name.split("@")[0]
                ) {
                    return entry;
                }
            }
        }
        return undefined;
    };
    let toolEntry = getToolEntry(tools, tool);

    if (!toolEntry) {
        logger.info(
            `tool "${tool}" is not defined in ${tomlPath}. Installing via rokit...`,
        );
        const tomlDir = path.dirname(tomlPath);
        const addResult = await rokitCommandHandler({
            version: "latest",
            args: ["add", tool],
            options: { stdio: "inherit", cwd: tomlDir },
        });

        if (addResult && addResult.status !== 0) {
            logger.error(`failed to add tool "${tool}" via rokit.`);
            process.exit(1);
        }

        // Re-read rokit.toml
        tomlContent = await readFile(tomlPath, "utf-8");
        try {
            tomlData = parseToml(tomlContent);
        } catch (err) {
            logger.error(
                `failed to parse ${tomlPath} after adding tool: ${err}`,
            );
            process.exit(1);
        }

        tools = tomlData.tools || {};
        toolEntry = getToolEntry(tools, tool);

        if (!toolEntry) {
            logger.error(
                `tool "${tool}" is still not defined in ${tomlPath} after rokit add.`,
            );
            process.exit(1);
        }
    }

    if (typeof toolEntry !== "string") {
        logger.error(
            `tool "${tool}" is not a string in ${tomlPath}. please check your rokit.toml configuration.`,
        );
        process.exit(1);
    }

    // `toolEntry` format is usually "owner/repo@version"
    // We need to parse it to get owner, repo, and version.
    const match = toolEntry.match(/^([^/]+)\/([^@]+)@(.+)$/);
    if (!match) {
        logger.error(
            `invalid tool definition for "${tool}" in ${tomlPath}: ${toolEntry}`,
        );
        process.exit(1);
    }

    const [, owner, repo, version] = match;

    // 3. Construct the path to the tool binary.
    const platform = os.platform();
    const isWindows = platform === "win32";

    // ~/.rokit/tool-storage/<owner>/<repo>/
    const homeDir = os.homedir();
    const repoStorageDir = path.join(
        homeDir,
        ".rokit",
        "tool-storage",
        owner,
        repo,
    );

    let installedVersions: string[] = [];
    if (fs.existsSync(repoStorageDir)) {
        installedVersions = fs.readdirSync(repoStorageDir).filter((file) => {
            try {
                return fs
                    .statSync(path.join(repoStorageDir, file))
                    .isDirectory();
            } catch {
                return false;
            }
        });
    }

    let matchedVersion: string | undefined;

    const findMatchedVersion = () => {
        if (installedVersions.includes(version)) {
            return version;
        }
        const satisfyingVersions = installedVersions.filter((v) => {
            try {
                return semver.satisfies(v, version);
            } catch {
                return false;
            }
        });

        if (satisfyingVersions.length > 0) {
            satisfyingVersions.sort((a, b) => {
                try {
                    return semver.rcompare(a, b);
                } catch {
                    return 0;
                }
            });
            return satisfyingVersions[0];
        }
        return undefined;
    };

    matchedVersion = findMatchedVersion();

    if (!matchedVersion) {
        logger.info(
            `installed version for "${tool}" satisfying "${version}" not found. running rokit install...`,
        );
        const tomlDir = path.dirname(tomlPath);
        const installResult = await rokitCommandHandler({
            version: rokitVersion,
            args: ["install"],
            options: { stdio: "inherit", cwd: tomlDir },
        });

        if (installResult && installResult.status !== 0) {
            logger.error(`failed to install tools via rokit.`);
            process.exit(1);
        }

        if (fs.existsSync(repoStorageDir)) {
            installedVersions = fs
                .readdirSync(repoStorageDir)
                .filter((file) => {
                    try {
                        return fs
                            .statSync(path.join(repoStorageDir, file))
                            .isDirectory();
                    } catch {
                        return false;
                    }
                });
        }
        matchedVersion = findMatchedVersion();

        if (!matchedVersion) {
            logger.error(
                `could not find an installed version of ${owner}/${repo} satisfying "${version}" even after rokit install.`,
            );
            logger.error(
                `installed versions: ${installedVersions.join(", ") || "none"}`,
            );
            process.exit(1);
        }
    }

    const toolStorageDir = path.join(repoStorageDir, matchedVersion);

    if (!fs.existsSync(toolStorageDir)) {
        logger.error(`tool storage directory not found: ${toolStorageDir}`);
        logger.error(`please ensure the tool is installed via rokit.`);
        process.exit(1);
    }

    // Find the executable.
    // It's usually `<tool>.exe` on Windows or `<tool>` on Unix.
    // If not found, we can list the directory to find the first executable.
    const defaultExeName = isWindows ? `${tool}.exe` : tool;
    let binPath = path.join(toolStorageDir, defaultExeName);

    if (!fs.existsSync(binPath)) {
        // Try `<repo>.exe` or `<repo>`
        const repoExeName = isWindows ? `${repo}.exe` : repo;
        binPath = path.join(toolStorageDir, repoExeName);

        if (!fs.existsSync(binPath)) {
            // Read directory to find any file that might be the executable
            const files = fs.readdirSync(toolStorageDir);
            let found = false;
            for (const file of files) {
                if (isWindows && file.endsWith(".exe")) {
                    binPath = path.join(toolStorageDir, file);
                    found = true;
                    break;
                } else if (!isWindows) {
                    // On Unix, check if the file is executable
                    const filePath = path.join(toolStorageDir, file);
                    try {
                        fs.accessSync(filePath, fs.constants.X_OK);
                        // Make sure it's not a directory
                        if (!fs.statSync(filePath).isDirectory()) {
                            binPath = filePath;
                            found = true;
                            break;
                        }
                    } catch {
                        // Not executable
                    }
                }
            }

            if (!found) {
                logger.error(
                    `could not find an executable for "${tool}" in ${toolStorageDir}`,
                );
                process.exit(1);
            }
        }
    }

    // 4. Run the executable.
    const spawnOptions: SpawnSyncOptionsWithBufferEncoding = {
        ...options,
        env: {
            ...process.env,
            ...options.env,
        },
    };

    return {
        binPath,
        spawnOptions,
    };
}
