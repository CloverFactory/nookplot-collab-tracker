/**
 * Express routes for the collaboration dashboard API.
 *
 * GET  /api/dashboard           — Overview stats
 * GET  /api/agents/:address     — Agent-specific stats
 * GET  /api/rankings            — Ranked collaborations by score
 * GET  /api/network/graph       — Network graph data (nodes + edges)
 */

import { Router } from "express";
import { CollaborationTracker } from "./tracker.js";
import { CollaborationScorer } from "./scoring.js";
import { StatsEngine } from "./stats.js";

export function createDashboardRouter(
  tracker: CollaborationTracker,
  scorer: CollaborationScorer,
  stats: StatsEngine,
): Router {
  const router = Router();

  // Dashboard overview
  router.get("/dashboard", async (_req, res) => {
    const collabs = await tracker.listCollaborations();
    const active = collabs.filter((c) => c.status === "active");
    const totalParticipants = new Set(
      collabs.flatMap((c) => c.participants.map((p) => p.address.toLowerCase())),
    ).size;
    const totalContributions = collabs.reduce(
      (sum, c) => sum + c.metrics.totalCommits + c.metrics.totalMessages,
      0,
    );

    res.json({
      totalCollaborations: collabs.length,
      activeCollaborations: active.length,
      totalParticipants,
      totalContributions,
      topCollaborations: scorer
        .rank(collabs)
        .slice(0, 5)
        .map((r) => ({
          projectId: r.collaboration.projectId,
          score: r.score.composite,
          participants: r.collaboration.participants.length,
        })),
    });
  });

  // Agent stats
  router.get("/agents/:address", async (req, res) => {
    const collabs = await tracker.listCollaborations();
    const agentStats = stats.computeAgentStats(req.params.address, collabs);

    if (agentStats.totalCollaborations === 0) {
      res.status(404).json({ error: "Agent has no collaborations" });
      return;
    }

    res.json(agentStats);
  });

  // Rankings
  router.get("/rankings", async (req, res) => {
    const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 100);
    const collabs = await tracker.listCollaborations();
    const ranked = scorer.rank(collabs).slice(0, limit);

    res.json({
      rankings: ranked.map((r, i) => ({
        rank: i + 1,
        projectId: r.collaboration.projectId,
        score: r.score,
        participants: r.collaboration.participants.map((p) => ({
          address: p.address,
          displayName: p.displayName,
          role: p.role,
          contributions: p.contributions,
        })),
        status: r.collaboration.status,
      })),
      total: collabs.length,
    });
  });

  // Network graph
  router.get("/network/graph", async (_req, res) => {
    const collabs = await tracker.listCollaborations();

    // Nodes = unique agents
    const nodeMap = new Map<string, { address: string; displayName: string; collaborations: number }>();
    for (const collab of collabs) {
      for (const p of collab.participants) {
        const key = p.address.toLowerCase();
        const existing = nodeMap.get(key);
        if (existing) {
          existing.collaborations++;
        } else {
          nodeMap.set(key, { address: p.address, displayName: p.displayName, collaborations: 1 });
        }
      }
    }

    // Edges = shared collaborations between agents
    const edgeMap = new Map<string, { source: string; target: string; weight: number }>();
    for (const collab of collabs) {
      const participants = collab.participants;
      for (let i = 0; i < participants.length; i++) {
        for (let j = i + 1; j < participants.length; j++) {
          const a = participants[i].address.toLowerCase();
          const b = participants[j].address.toLowerCase();
          const key = [a, b].sort().join("-");
          const existing = edgeMap.get(key);
          if (existing) {
            existing.weight++;
          } else {
            edgeMap.set(key, { source: a, target: b, weight: 1 });
          }
        }
      }
    }

    res.json({
      nodes: Array.from(nodeMap.values()),
      edges: Array.from(edgeMap.values()),
    });
  });

  return router;
}
