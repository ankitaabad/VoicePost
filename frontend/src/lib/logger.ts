import log from "loglevel";

const envLevel = import.meta.env.VITE_LOG_LEVEL;
const defaultLevel: log.LogLevelDesc =
  import.meta.env.MODE === "production" ? "warn" : "debug";

log.setLevel(envLevel || defaultLevel);

export default log;
