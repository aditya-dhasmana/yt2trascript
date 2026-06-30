import "dotenv/config";
import { createApp } from "./app.js";
import { loadConfig, validateEnvironment } from "./lib/config/environment.js";

const config = loadConfig();
const environmentReport = validateEnvironment(config);
const app = createApp({ config, environmentReport });

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}. Official backend: yt-transcript-server/server.js`);
  console.log("BACKEND CAPABILITIES", environmentReport.capabilities);
});
