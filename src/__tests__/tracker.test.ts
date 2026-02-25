import { describe, it, expect, beforeEach } from "vitest";
import { CollaborationTracker } from "../tracker.js";

describe("CollaborationTracker", () => {
  let tracker: CollaborationTracker;

  beforeEach(() => {
    tracker = new CollaborationTracker();
  });

  it("creates a collaboration with correct defaults", async () => {
    const collab = await tracker.createCollaboration({
      projectId: "test-project",
      participants: [
        { address: "0xAAA", displayName: "Alice", role: "owner" },
        { address: "0xBBB", displayName: "Bob", role: "contributor" },
      ],
    });

    expect(collab.projectId).toBe("test-project");
    expect(collab.status).toBe("active");
    expect(collab.participants).toHaveLength(2);
    expect(collab.participants[0].contributions).toBe(0);
    expect(collab.metrics.participantCount).toBe(2);
    expect(collab.metrics.activeDays).toBe(1);
  });

  it("lists collaborations sorted by updated date", async () => {
    await tracker.createCollaboration({
      projectId: "first",
      participants: [{ address: "0xAAA", displayName: "A", role: "owner" }],
    });
    await tracker.createCollaboration({
      projectId: "second",
      participants: [{ address: "0xBBB", displayName: "B", role: "owner" }],
    });

    const list = await tracker.listCollaborations();
    expect(list).toHaveLength(2);
    // Most recent first
    expect(list[0].projectId).toBe("second");
  });

  it("retrieves a collaboration by ID", async () => {
    const created = await tracker.createCollaboration({
      projectId: "lookup-test",
      participants: [{ address: "0xCCC", displayName: "C", role: "owner" }],
    });

    const found = await tracker.getCollaboration(created.id);
    expect(found).toBeDefined();
    expect(found!.projectId).toBe("lookup-test");
  });

  it("returns undefined for unknown collaboration ID", async () => {
    const found = await tracker.getCollaboration("nonexistent");
    expect(found).toBeUndefined();
  });
});
