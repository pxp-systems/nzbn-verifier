type LogLevel = "info" | "warn" | "error";

interface SafeLogMeta {
  sessionId?: string;
  event?: string;
  details?: Record<string, string | number | boolean | undefined>;
}

function formatMeta(meta?: SafeLogMeta): string {
  if (!meta) {
    return "";
  }

  const safeMeta = {
    sessionId: meta.sessionId,
    event: meta.event,
    details: meta.details
  };

  return ` ${JSON.stringify(safeMeta)}`;
}

function write(level: LogLevel, message: string, meta?: SafeLogMeta): void {
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}${formatMeta(meta)}`;

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export const safeLogger = {
  info(message: string, meta?: SafeLogMeta): void {
    write("info", message, meta);
  },
  warn(message: string, meta?: SafeLogMeta): void {
    write("warn", message, meta);
  },
  error(message: string, meta?: SafeLogMeta): void {
    write("error", message, meta);
  }
};
