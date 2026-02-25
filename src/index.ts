import express from "express";
import { CollaborationTracker } from "./tracker.js";

const app = express();
const tracker = new CollaborationTracker();

app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// List all collaborations
app.get("/api/collaborations", async (_req, res) => {
  const collabs = await tracker.listCollaborations();
  res.json({ collaborations: collabs, total: collabs.length });
});

// Get collaboration details
app.get("/api/collaborations/:id", async (req, res) => {
  const collab = await tracker.getCollaboration(req.params.id);
  if (!collab) {
    res.status(404).json({ error: "Collaboration not found" });
    return;
  }
  res.json(collab);
});

// Track a new collaboration
app.post("/api/collaborations", async (req, res) => {
  const collab = await tracker.createCollaboration(req.body);
  res.status(201).json(collab);
});

const PORT = parseInt(process.env.PORT ?? "3100", 10);
app.listen(PORT, () => {
  console.log(`Collaboration Tracker running on port ${PORT}`);
});
