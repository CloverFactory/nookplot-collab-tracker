/**
 * Collaboration Tracker — main entry point.
 *
 * Wires together all modules: tracker, scorer, stats, gateway client,
 * network sync, event emitter, dashboard routes, and middleware.
 */

import express from "express";
import { loadConfig } from "./config.js";
import { CollaborationTracker } from "./tracker.js";
import { CollaborationScorer } from "./scoring.js";
import { StatsEngine } from "./stats.js";
import { GatewayClient } from "./gateway.js";
import { NetworkSync } from "./sync.js";
import { CollabEventEmitter } from "./events.js";
import { createDashboardRouter } from "./routes.js";
import { rateLimiter, cors, requestLogger, errorHandler } from "./middleware.js";

const config = loadConfig();
const app = express();

// Core services
const tracker = new CollaborationTracker();
const scorer = new CollaborationScorer();
const stats = new StatsEngine();
const events = new CollabEventEmitter();

// Gateway client + network sync
const gateway = new GatewayClient({
  baseUrl: config.gatewayUrl,
  apiKey: config.gatewayApiKey,
});
const sync = new NetworkSync(gateway, tracker, {
  intervalMs: config.syncIntervalMs,
  maxProjects: config.maxProjects,
});

// Log events
events.onAll((event) => {
  if (config.logLevel === "debug") {
    console.log("[event]", JSON.stringify(event));
  }
});

// Middleware
app.use(express.json());
app.use(requestLogger);
app.use(cors(config));
app.use(rateLimiter(60_000, 100));

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    lastSync: sync.getLastSyncAt(),
  });
});

// API routes
app.get("/api/collaborations", async (_req, res) => {
  const collabs = await tracker.listCollaborations();
  res.json({ collaborations: collabs, total: collabs.length });
});

app.get("/api/collaborations/:id", async (req, res) => {
  const collab = await tracker.getCollaboration(req.params.id);
  if (!collab) {
    res.status(404).json({ error: "Collaboration not found" });
    return;
  }
  res.json(collab);
});

app.post("/api/collaborations", async (req, res) => {
  const collab = await tracker.createCollaboration(req.body);
  events.emit({
    type: "collaboration.created",
    collaborationId: collab.id,
    projectId: collab.projectId,
  });
  res.status(201).json(collab);
});

// Dashboard routes
app.use("/api", createDashboardRouter(tracker, scorer, stats));

// Error handler (must be last)
app.use(errorHandler);

// Start server + sync
app.listen(config.port, () => {
  console.log(`Collaboration Tracker running on port ${config.port}`);
  console.log(`Gateway: ${config.gatewayUrl}`);
  console.log(`Sync interval: ${config.syncIntervalMs}ms`);

  if (config.gatewayApiKey) {
    sync.start();
  } else {
    console.warn("Skipping network sync — no API key configured");
  }
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("Shutting down...");
  sync.stop();
  events.clear();
  process.exit(0);
});
