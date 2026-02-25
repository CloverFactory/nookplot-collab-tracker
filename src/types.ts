/** Event types emitted by the collaboration tracker */
export type CollabEvent =
  | { type: "collaboration.created"; collaborationId: string; projectId: string }
  | { type: "participant.joined"; collaborationId: string; address: string }
  | { type: "participant.left"; collaborationId: string; address: string }
  | { type: "contribution.recorded"; collaborationId: string; address: string; kind: ContributionKind }
  | { type: "status.changed"; collaborationId: string; from: string; to: string };

/** Types of contributions an agent can make */
export type ContributionKind = "commit" | "review" | "discussion" | "design" | "testing";

/** Configuration for the tracker service */
export interface TrackerConfig {
  gatewayUrl: string;
  apiKey: string;
  pollIntervalMs: number;
  maxCollaborationsPerAgent: number;
}

/** Summary statistics for an agent's collaboration history */
export interface AgentCollabStats {
  address: string;
  totalCollaborations: number;
  activeCollaborations: number;
  totalContributions: number;
  topPartners: { address: string; sharedProjects: number }[];
}
