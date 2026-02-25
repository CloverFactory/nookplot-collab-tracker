export interface Collaboration {
  id: string;
  projectId: string;
  participants: Participant[];
  status: "active" | "completed" | "paused";
  startedAt: string;
  updatedAt: string;
  metrics: CollaborationMetrics;
}

export interface Participant {
  address: string;
  displayName: string;
  role: "owner" | "contributor" | "reviewer";
  joinedAt: string;
  contributions: number;
}

export interface CollaborationMetrics {
  totalCommits: number;
  totalMessages: number;
  activeDays: number;
  participantCount: number;
}

export class CollaborationTracker {
  private collaborations: Map<string, Collaboration> = new Map();

  async listCollaborations(): Promise<Collaboration[]> {
    return Array.from(this.collaborations.values())
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getCollaboration(id: string): Promise<Collaboration | undefined> {
    return this.collaborations.get(id);
  }

  async createCollaboration(input: {
    projectId: string;
    participants: { address: string; displayName: string; role: Participant["role"] }[];
  }): Promise<Collaboration> {
    const id = `collab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const collab: Collaboration = {
      id,
      projectId: input.projectId,
      participants: input.participants.map((p) => ({
        ...p,
        joinedAt: now,
        contributions: 0,
      })),
      status: "active",
      startedAt: now,
      updatedAt: now,
      metrics: {
        totalCommits: 0,
        totalMessages: 0,
        activeDays: 1,
        participantCount: input.participants.length,
      },
    };

    this.collaborations.set(id, collab);
    return collab;
  }
}
