import { logger, rkCommandHandlerSync, rokitCommandHandler } from "rkkit";

async function main() {
    logger.info("Running rokit...");
    const rokitResult = await rokitCommandHandler({
        args: ["--version"],
        options: {
            stdio: "inherit",
        },
    });

    if (rokitResult && rokitResult.status === 0) {
        logger.info("Successfully ran rokit!");
    } else {
        logger.error(
            `Rokit failed with exit code ${rokitResult ? rokitResult.status : "unknown"}`,
        );
    }

    logger.info("Running lune via rkkit...");

    // This will automatically install lune 0.10.4 (defined in rokit.toml) if not present
    // and run `lune --version`
    const luneResult = await rkCommandHandlerSync({
        tool: "lune",
        args: ["--version"],
        options: {
            stdio: "inherit",
        },
    });

    if (luneResult.status === 0) {
        logger.info("Successfully ran lune!");
    } else {
        logger.error(`Lune failed with exit code ${luneResult.status}`);
    }

    logger.info("Running rojo via rkkit...");

    // This will run `rojo --version`
    const rojoResult = await rkCommandHandlerSync({
        tool: "rojo",
        args: ["--version"],
        options: {
            stdio: "inherit",
        },
    });

    if (rojoResult.status === 0) {
        logger.info("Successfully ran rojo!");
    } else {
        logger.error(`Rojo failed with exit code ${rojoResult.status}`);
    }
}

main().catch((err) => {
    logger.error("An error occurred:", err);
    process.exit(1);
});
