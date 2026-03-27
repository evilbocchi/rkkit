import {
    spawnSync,
    execSync,
    SpawnSyncOptionsWithBufferEncoding,
} from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import AdmZip from "adm-zip";
import { logger } from "../core/logging.js";

let cachedGitHubToken: string | undefined;
let hasCheckedGitHubToken = false;

/**
 * Ensure that the cache folder exists.
 * @return The path to the cache folder (~/.rokit/rkkit).
 */
export function ensureCacheFolder() {
    const cacheDir = path.join(os.homedir(), ".rokit", "rkkit");
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }
    return cacheDir;
}

function getGitHubToken(): string | undefined {
    if (hasCheckedGitHubToken) return cachedGitHubToken;
    hasCheckedGitHubToken = true;

    if (process.env.GITHUB_TOKEN) {
        cachedGitHubToken = process.env.GITHUB_TOKEN;
        return cachedGitHubToken;
    }

    try {
        const token = execSync("gh auth token", {
            encoding: "utf-8",
            stdio: ["ignore", "pipe", "ignore"],
        }).trim();
        if (token) {
            cachedGitHubToken = token;
        }
    } catch {
        // Ignore
    }

    return cachedGitHubToken;
}

interface GitHubRelease {
    tag_name: string;
    assets: Array<{
        name: string;
        browser_download_url: string;
    }>;
}

async function getRokitReleaseData(
    repo: string,
    version: string,
): Promise<GitHubRelease> {
    const isLatest = version === "latest";
    const releaseUrl = isLatest
        ? `https://api.github.com/repos/${repo}/releases/latest`
        : `https://api.github.com/repos/${repo}/releases/tags/v${version.replace(/^v/, "")}`;

    const headers: Record<string, string> = {};
    const token = getGitHubToken();
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(releaseUrl, { headers });
    if (!response.ok) {
        throw new Error(
            `failed to fetch release data from ${releaseUrl}: ${response.statusText}`,
        );
    }

    const data = await response.json();
    return data as GitHubRelease;
}

function getLocalVersions(rokitDir: string) {
    if (!fs.existsSync(rokitDir)) return [];
    return fs
        .readdirSync(rokitDir)
        .filter((f) => fs.statSync(path.join(rokitDir, f)).isDirectory())
        .sort((a, b) => {
            const aParts = a.split(".").map((x) => parseInt(x) || 0);
            const bParts = b.split(".").map((x) => parseInt(x) || 0);
            for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
                if ((aParts[i] || 0) > (bParts[i] || 0)) return -1;
                if ((aParts[i] || 0) < (bParts[i] || 0)) return 1;
            }
            return 0;
        });
}

function getAssetUrl(
    data: GitHubRelease,
    platform: NodeJS.Platform,
    arch: string,
) {
    let platformKeyword = "";
    if (platform === "win32") {
        platformKeyword = "windows";
    } else if (platform === "linux") {
        platformKeyword = "linux";
    } else if (platform === "darwin") {
        platformKeyword = arch === "arm64" ? "macos-aarch" : "macos";
    } else {
        throw new Error(`Unsupported platform: ${platform}`);
    }

    const asset = data.assets.find((a) => {
        const name = a.name.toLowerCase();
        if (platform === "win32") {
            if (arch === "arm64") {
                return name.includes("windows") && name.includes("aarch64");
            } else {
                return name.includes("windows") && !name.includes("aarch64");
            }
        }
        if (platform === "darwin" && arch !== "arm64") {
            return name.includes("macos") && !name.includes("aarch");
        }
        return name.includes(platformKeyword);
    });

    if (!asset) {
        throw new Error(
            `No asset found for platform ${platform} ${arch} in version ${data.tag_name}`,
        );
    }

    return asset.browser_download_url;
}

/**
 * Command handler for the "rokit" command.
 * Downloads Rokit if not present, and spawns a child process.
 * @returns The result of spawnSync when running the Rokit CLI with the specified arguments and options.
 */
export async function rokitCommandHandler({
    repo = "rojo-rbx/rokit",
    version,
    args,
    options = {
        stdio: "inherit",
    },
}: {
    /**
     * Optional GitHub repo to fetch Rokit from, in the format "owner/repo". Defaults to "rojo-rbx/rokit".
     */
    repo?: string;
    /**
     * Version of Rokit to use. Can be a specific version like "1.2.3" or "latest". Defaults to using the highest cached version, or fetching latest if not cached.
     */
    version?: string;
    /**
     * Arguments to pass to the Rokit CLI.
     */
    args?: string[];
    /**
     * Options to pass to spawnSync when running the Rokit CLI. Defaults to { stdio: "inherit" }.
     */
    options?: SpawnSyncOptionsWithBufferEncoding;
}) {
    const cacheDir = ensureCacheFolder();
    const rokitDir = path.join(cacheDir, "rokit", repo.replace("/", "-"));

    if (!fs.existsSync(rokitDir)) {
        fs.mkdirSync(rokitDir, { recursive: true });
    }

    let targetVersion = version?.replace(/^v/, "");

    if (!targetVersion) {
        const localVersions = getLocalVersions(rokitDir);
        if (localVersions.length > 0) {
            targetVersion = localVersions[0];
        } else {
            version = "latest";
        }
    }

    if (version === "latest") {
        logger.info(`resolving latest rokit version for ${repo}...`);

        let data: GitHubRelease | undefined;
        let errorMessage: string | undefined;
        try {
            data = await getRokitReleaseData(repo, "latest");
        } catch (err) {
            errorMessage = err instanceof Error ? err.message : String(err);
        }

        if (!data) {
            const localVersions = getLocalVersions(rokitDir);
            if (localVersions.length > 0) {
                targetVersion = localVersions[0];
                logger.warn(
                    `${errorMessage}; using local latest: ${targetVersion}`,
                );
            } else {
                logger.error(
                    `${errorMessage}; no local versions found either.`,
                );
                return;
            }
        } else {
            targetVersion = data.tag_name.replace(/^v/, "");
        }
    }

    if (!targetVersion) return;

    const platform = os.platform();
    const arch = os.arch();
    const exeName = platform === "win32" ? "rokit.exe" : "rokit";

    const versionDir = path.join(rokitDir, targetVersion);
    const binPath = path.join(versionDir, exeName);

    if (!fs.existsSync(binPath)) {
        logger.info(
            `downloading rokit version ${targetVersion} from ${repo}...`,
        );

        const releaseData = await getRokitReleaseData(repo, targetVersion);
        if (!releaseData) return;

        const downloadUrl = getAssetUrl(releaseData, platform, arch);

        if (!fs.existsSync(versionDir)) {
            fs.mkdirSync(versionDir, { recursive: true });
        }

        const zipPath = path.join(versionDir, "rokit.zip");
        const downloadResponse = await fetch(downloadUrl);
        if (!downloadResponse.ok) {
            logger.error(
                `failed to download rokit from ${downloadUrl}: ${downloadResponse.statusText}`,
            );
            return;
        }

        await Bun.write(zipPath, downloadResponse);

        logger.info(`extracting rokit...`);
        const zip = new AdmZip(zipPath);
        zip.extractAllTo(versionDir, true);
        fs.unlinkSync(zipPath);

        if (platform !== "win32") {
            fs.chmodSync(binPath, 0o755);
        }

        logger.info(`rokit ${targetVersion} downloaded successfully.`);
    }

    return spawnSync(binPath, args, options);
}
