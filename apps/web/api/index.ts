// One Node.js function handles all same-origin /api requests; Express keeps its original URL.
import { createApp } from "../../api/src/app.js";
import { loadEnv } from "../../api/src/config/env.js";
import { createContainer } from "../../api/src/container.js";

const container = createContainer(loadEnv(), {
  subscribeReports: false,
  reportExecution: "request",
});
export default createApp(container);
