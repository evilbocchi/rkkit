import { describe, it, expect, vi, beforeEach } from "vitest";
import { logger, configureLogger } from "./logging";

describe("logging", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("should have correct log levels order", () => {
        const logLevels = (logger as any)._logLevels;
        expect(logLevels.debug).toBe(0);
        expect(logLevels.timer).toBe(1);
        expect(logLevels.info).toBe(2);
        expect(logLevels.warn).toBe(3);
        expect(logLevels.error).toBe(4);
    });

    it("should set log level correctly", () => {
        const setLogLevelSpy = vi.spyOn(logger, "setLogLevel");

        logger.setLogLevel("debug");
        expect(setLogLevelSpy).toHaveBeenCalledWith("debug");
        expect((logger as any)._generalLogLevel).toBe("debug");

        logger.setLogLevel("warn");
        expect(setLogLevelSpy).toHaveBeenCalledWith("warn");
        expect((logger as any)._generalLogLevel).toBe("warn");
    });

    it("should configure logger based on verbosity", () => {
        const setLogLevelSpy = vi.spyOn(logger, "setLogLevel");

        configureLogger(true);
        expect(setLogLevelSpy).toHaveBeenCalledWith("debug");

        configureLogger(false);
        expect(setLogLevelSpy).toHaveBeenCalledWith("warn");
    });
});
