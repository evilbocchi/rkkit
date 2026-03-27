import { DefaultMethods, Signale, SignaleOptions } from "signale";

/**
 * Custom Logger class extending Signale to provide log level management.
 */
class Logger extends Signale {
    constructor(options: SignaleOptions = {}) {
        super(options);
    }

    /**
     * Swapped debug and info to make debug the most verbose level and info the default for normal logging.
     */
    get _logLevels() {
        return {
            debug: 0,
            timer: 1,
            info: 2,
            warn: 3,
            error: 4,
        };
    }

    /**
     * Sets the general log level for the logger.
     * @param level The log level to set (e.g., 'debug', 'info', 'warn', 'error').
     */
    setLogLevel(level: DefaultMethods) {
        const privateThis = this as Signale & {
            _generalLogLevel: string;
            _validateLogLevel: (level: string) => string;
        };
        privateThis._generalLogLevel = privateThis._validateLogLevel(level);
    }
}

/**
 * The default logger instance for the application.
 */
export const logger = new Logger({});

/**
 * Configures the default logger based on the verbosity setting.
 * @param verbose If true, sets the log level to 'debug'; otherwise, sets it to 'warn'.
 */
export function configureLogger(verbose: boolean) {
    if (verbose) {
        logger.setLogLevel("debug");
    } else {
        logger.setLogLevel("warn");
    }
}
