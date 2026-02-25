/**
 * Agent collaboration statistics.
 *
 * Aggregates per-agent metrics across all collaborations:
 * total collaborations, contributions, top partners, activity streaks.
 */

import type { Collaboration } from "./tracker.js";

export interface AgentStats {
  address: string;
  displayName: string;
  totalCollaborations: number;
  activeCollaborations: number;
  completedCollaborations: number;
  totalContributions: number;
  topPartners: PartnerSummary[];
  activityStreak: number;
  lastActiveAt: string | null;
}

export interface PartnerSummary {
  address: string;
  displayName: string;
  sharedProjects: number;
  totalInteractions: number;
}

export class StatsEngine {
  /**
   * Compute stats for a single agent across all collaborations.
   */
  computeAgentStats(
    address: string,
    collaborations: Collaboration[],
  ): AgentStats {
    const relevant = collaborations.filter((c) =>
      c.participants.some((p) => p.address.toLowerCase() === address.toLowerCase()),
    );

    const active = relevant.filter((c) => c.status === "active");
    const completed = relevant.filter((c) => c.status === "completed");

    // Find the agent's display name from any collaboration
    const self = relevant
      .flatMap((c) => c.participants)
      .find((p) => p.address.toLowerCase() === address.toLowerCase());

    // Count contributions across all collaborations
    const totalContributions = relevant
      .flatMap((c) => c.participants)
      .filter((p) => p.address.toLowerCase() === address.toLowerCase())
      .reduce((sum, p) => sum + p.contributions, 0);

    // Build partner map
    const partnerMap = new Map<string, { displayName: string; sharedProjects: number; interactions: number }>();
    for (const collab of relevant) {
      for (const participant of collab.participants) {
        if (participant.address.toLowerCase() === address.toLowerCase()) continue;
        const key = participant.address.toLowerCase();
        const existing = partnerMap.get(key);
        if (existing) {
          existing.sharedProjects++;
          existing.interactions += participant.contributions;
        } else {
          partnerMap.set(key, {
            displayName: participant.displayName,
            sharedProjects: 1,
            interactions: participant.contributions,
          });
        }
      }
    }

    const topPartners = Array.from(partnerMap.entries())
      .map(([addr, data]) => ({
        address: addr,
        displayName: data.displayName,
        sharedProjects: data.sharedProjects,
        totalInteractions: data.interactions,
      }))
      .sort((a, b) => b.sharedProjects - a.sharedProjects)
      .slice(0, 10);

    // Activity streak (consecutive days with activity)
    const activityDates = relevant
      .map((c) => new Date(c.updatedAt).toDateString())
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort()
      .reverse();

    let streak = 0;
    const today = new Date();
    for (let i = 0; i < activityDates.length; i++) {
      const expected = new Date(today);
      expected.setDate(expected.getDate() - i);
      if (activityDates[i] === expected.toDateString()) {
        streak++;
      } else {
        break;
      }
    }

    const lastActive = relevant
      .map((c) => c.updatedAt)
      .sort()
      .reverse()[0] ?? null;

    return {
      address,
      displayName: self?.displayName ?? address.slice(0, 10),
      totalCollaborations: relevant.length,
      activeCollaborations: active.length,
      completedCollaborations: completed.length,
      totalContributions,
      topPartners,
      activityStreak: streak,
      lastActiveAt: lastActive,
    };
  }

  /**
   * Compute stats for all agents that appear in any collaboration.
   */
  computeAllStats(collaborations: Collaboration[]): AgentStats[] {
    const addresses = new Set<string>();
    for (const collab of collaborations) {
      for (const p of collab.participants) {
        addresses.add(p.address.toLowerCase());
      }
    }

    return Array.from(addresses)
      .map((addr) => this.computeAgentStats(addr, collaborations))
      .sort((a, b) => b.totalContributions - a.totalContributions);
  }
}
