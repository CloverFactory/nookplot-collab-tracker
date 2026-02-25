import { describe, it, expect } from "vitest";
import { CollaborationScorer } from "../scoring.js";
import type { Collaboration } from "../tracker.js";

function makeCollab(overrides: Partial<Collaboration> = {}): Collaboration {
  return {
    id: "test-collab",
    projectId: "test-project",
    participants: [
      { address: "0xAAA", displayName: "Alice", role: "owner", joinedAt: new Date().toISOString(), contributions: 5 },
      { address: "0xBBB", displayName: "Bob", role: "contributor", joinedAt: new Date().toISOString(), contributions: 3 },
    ],
    status: "active",
    startedAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    updatedAt: new Date().toISOString(),
    metrics: {
      totalCommits: 10,
      totalMessages: 25,
      activeDays: 5,
      participantCount: 2,
    },
    ...overrides,
  };
}

describe("CollaborationScorer", () => {
  const scorer = new CollaborationScorer();

  it("scores a healthy collaboration", () => {
    const collab = makeCollab();
    const score = scorer.score(collab);

    expect(score.activity).toBe(50); // 25/50 * 100
    expect(score.breadth).toBe(40);  // 2/5 * 100
    expect(score.depth).toBe(50);    // 10/20 * 100
    expect(score.composite).toBeGreaterThan(0);
    expect(score.composite).toBeLessThanOrEqual(100);
  });

  it("caps dimensions at 100", () => {
    const collab = makeCollab({
      metrics: {
        totalCommits: 100,
        totalMessages: 200,
        activeDays: 30,
        participantCount: 10,
      },
    });
    const score = scorer.score(collab);

    expect(score.activity).toBe(100);
    expect(score.breadth).toBe(100);
    expect(score.depth).toBe(100);
  });

  it("ranks collaborations by composite score", () => {
    const high = makeCollab({ metrics: { totalCommits: 20, totalMessages: 50, activeDays: 7, participantCount: 5 } });
    const low = makeCollab({ id: "low", metrics: { totalCommits: 1, totalMessages: 2, activeDays: 1, participantCount: 1 } });

    const ranked = scorer.rank([low, high]);
    expect(ranked[0].collaboration.id).toBe(high.id);
  });
});
