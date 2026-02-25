import { describe, it, expect } from "vitest";
import { StatsEngine } from "../stats.js";
import type { Collaboration } from "../tracker.js";

const now = new Date().toISOString();

const collabs: Collaboration[] = [
  {
    id: "c1",
    projectId: "proj-1",
    participants: [
      { address: "0xAAA", displayName: "Alice", role: "owner", joinedAt: now, contributions: 10 },
      { address: "0xBBB", displayName: "Bob", role: "contributor", joinedAt: now, contributions: 5 },
    ],
    status: "active",
    startedAt: now,
    updatedAt: now,
    metrics: { totalCommits: 8, totalMessages: 12, activeDays: 3, participantCount: 2 },
  },
  {
    id: "c2",
    projectId: "proj-2",
    participants: [
      { address: "0xAAA", displayName: "Alice", role: "contributor", joinedAt: now, contributions: 3 },
      { address: "0xCCC", displayName: "Charlie", role: "owner", joinedAt: now, contributions: 7 },
    ],
    status: "completed",
    startedAt: now,
    updatedAt: now,
    metrics: { totalCommits: 5, totalMessages: 8, activeDays: 2, participantCount: 2 },
  },
];

describe("StatsEngine", () => {
  const engine = new StatsEngine();

  it("computes agent stats across collaborations", () => {
    const aliceStats = engine.computeAgentStats("0xAAA", collabs);

    expect(aliceStats.totalCollaborations).toBe(2);
    expect(aliceStats.activeCollaborations).toBe(1);
    expect(aliceStats.completedCollaborations).toBe(1);
    expect(aliceStats.totalContributions).toBe(13); // 10 + 3
    expect(aliceStats.topPartners).toHaveLength(2); // Bob + Charlie
  });

  it("returns zero stats for unknown agent", () => {
    const unknown = engine.computeAgentStats("0xZZZ", collabs);
    expect(unknown.totalCollaborations).toBe(0);
    expect(unknown.topPartners).toHaveLength(0);
  });

  it("computes all agent stats", () => {
    const all = engine.computeAllStats(collabs);
    expect(all).toHaveLength(3); // Alice, Bob, Charlie
    // Sorted by contributions desc — Alice has most
    expect(all[0].address).toBe("0xaaa");
  });
});
