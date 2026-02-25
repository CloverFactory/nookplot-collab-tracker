/**
 * Network sync — pulls live project and collaboration data from the
 * Nookplot gateway and updates the local tracker state.
 *
 * Runs on an interval (default: every 5 minutes) to keep the tracker
 * in sync with network activity.
 */

import { GatewayClient } from "./gateway.js";
import { CollaborationTracker, type Participant } from "./tracker.js";

export interface SyncConfig {
  intervalMs: number;
  maxProjects: number;
}

const DEFAULT_SYNC_CONFIG: SyncConfig = {
  intervalMs: 5 * 60 * 1000, // 5 minutes
  maxProjects: 50,
};

export class NetworkSync {
  private gateway: GatewayClient;
  private tracker: CollaborationTracker;
  private config: SyncConfig;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastSyncAt: string | null = null;

  constructor(
    gateway: GatewayClient,
    tracker: CollaborationTracker,
    config?: Partial<SyncConfig>,
  ) {
    this.gateway = gateway;
    this.tracker = tracker;
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config };
  }

  /**
   * Start the sync loop.
   */
  start(): void {
    if (this.timer) return;
    console.log(`[sync] Starting network sync (interval: ${this.config.intervalMs}ms)`);
    this.syncOnce().catch((err) => console.error("[sync] Initial sync failed:", err));
    this.timer = setInterval(() => {
      this.syncOnce().catch((err) => console.error("[sync] Sync failed:", err));
    }, this.config.intervalMs);
  }

  /**
   * Stop the sync loop.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log("[sync] Stopped.");
    }
  }

  /**
   * Run a single sync cycle.
   */
  async syncOnce(): Promise<{ projectsSynced: number; collaborationsCreated: number }> {
    console.log("[sync] Syncing network projects...");

    const { projects } = await this.gateway.listNetworkProjects(this.config.maxProjects);
    let collaborationsCreated = 0;

    for (const project of projects) {
      if (!project.collaborators || project.collaborators.length === 0) continue;

      // Check if we already track this collaboration
      const existing = await this.tracker.getCollaboration(project.projectId);
      if (existing) continue;

      // Map collaborators + owner to participants
      const participants: { address: string; displayName: string; role: Participant["role"] }[] = [
        {
          address: project.creatorAddress,
          displayName: project.creatorName ?? project.creatorAddress.slice(0, 10),
          role: "owner",
        },
        ...project.collaborators.map((c) => ({
          address: c.address,
          displayName: c.name ?? c.address.slice(0, 10),
          role: "contributor" as const,
        })),
      ];

      await this.tracker.createCollaboration({
        projectId: project.projectId,
        participants,
      });

      collaborationsCreated++;
      console.log(`[sync] New collaboration: ${project.name} (${participants.length} participants)`);
    }

    this.lastSyncAt = new Date().toISOString();
    console.log(`[sync] Done. Synced ${projects.length} projects, created ${collaborationsCreated} collaborations.`);

    return { projectsSynced: projects.length, collaborationsCreated };
  }

  getLastSyncAt(): string | null {
    return this.lastSyncAt;
  }
}
