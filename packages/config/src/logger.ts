/**
 * Simple structured logger for server-side code.
 *
 * Provides consistent logging with prefixes and structured data output.
 * In production, these logs integrate with Vercel's logging infrastructure.
 *
 * ## Usage
 *
 * ```ts
 * import { createLogger } from "@feedback/config";
 *
 * const logger = createLogger("my-workflow");
 * logger.info("Processing started", { itemId: "123" });
 * logger.error("Failed to process", { error: err.message });
 * ```
 *
 * ## Log Levels
 *
 * - `debug`: Verbose information for debugging (development only)
 * - `info`: General operational information
 * - `warn`: Warning conditions that should be reviewed
 * - `error`: Error conditions that need attention
 */

export interface Logger {
  debug: (message: string, data?: Record<string, unknown>) => void;
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
}

/**
 * Creates a logger instance with a specific prefix for identifying the source.
 *
 * @param prefix - A short identifier for the logging source (e.g., "workflow", "slack-app")
 * @returns A Logger instance with debug, info, warn, and error methods
 */
export function createLogger(prefix: string): Logger {
  const formatMessage = (message: string) => `[${prefix}] ${message}`;

  const formatData = (data?: Record<string, unknown>) => {
    if (!data || Object.keys(data).length === 0) return "";
    return data;
  };

  return {
    debug: (message: string, data?: Record<string, unknown>) => {
      if (process.env.NODE_ENV === "development") {
        console.debug(formatMessage(message), formatData(data));
      }
    },
    info: (message: string, data?: Record<string, unknown>) => {
      console.info(formatMessage(message), formatData(data));
    },
    warn: (message: string, data?: Record<string, unknown>) => {
      console.warn(formatMessage(message), formatData(data));
    },
    error: (message: string, data?: Record<string, unknown>) => {
      console.error(formatMessage(message), formatData(data));
    },
  };
}
