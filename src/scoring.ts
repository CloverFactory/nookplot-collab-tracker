/**
 * Collaboration scoring engine.
 *
 * Scores collaborations based on 4 dimensions:
 *   - Activity:     message frequency and recency
 *   - Breadth:      number of unique participants
 *   - Depth:        commit count and code contributions
 *   - Consistency:  active days over the collaboration lifetime
 *
 * Each dimension is 0-100, combined into a weighted composite.
 */

import type { Collaboration, CollaborationMetrics } from "./tracker.js";

export interface ScoreBreakdown {
  activity: number;
  breadth: number;
  depth: number;
  consistency: number;
  composite: number;
}

export interface ScoringWeights {
  activity: number;
  breadth: number;
  depth: number;
  consistency: number;
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  activity: 0.3,
  breadth: 0.2,
  depth: 0.3,
  consistency: 0.2,
};

export class CollaborationScorer {
  private weights: ScoringWeights;

  constructor(weights?: Partial<ScoringWeights>) {
    this.weights = { ...DEFAULT_WEIGHTS, ...weights };
  }

  score(collab: Collaboration): ScoreBreakdown {
    const metrics = collab.metrics;

    const activity = this.scoreActivity(metrics);
    const breadth = this.scoreBreadth(metrics);
    const depth = this.scoreDepth(metrics);
    const consistency = this.scoreConsistency(collab);

    const composite = Math.round(
      activity * this.weights.activity +
      breadth * this.weights.breadth +
      depth * this.weights.depth +
      consistency * this.weights.consistency
    );

    return { activity, breadth, depth, consistency, composite };
  }

  private scoreActivity(metrics: CollaborationMetrics): number {
    // 0-100 based on message count (50 messages = max)
    return Math.min(Math.round((metrics.totalMessages / 50) * 100), 100);
  }

  private scoreBreadth(metrics: CollaborationMetrics): number {
    // 0-100 based on participant count (5 participants = max)
    return Math.min(Math.round((metrics.participantCount / 5) * 100), 100);
  }

  private scoreDepth(metrics: CollaborationMetrics): number {
    // 0-100 based on commit count (20 commits = max)
    return Math.min(Math.round((metrics.totalCommits / 20) * 100), 100);
  }

  private scoreConsistency(collab: Collaboration): number {
    // 0-100 based on active days vs total days
    const startDate = new Date(collab.startedAt);
    const now = new Date();
    const totalDays = Math.max(1, Math.ceil((now.getTime() - startDate.getTime()) / 86_400_000));
    return Math.min(Math.round((collab.metrics.activeDays / totalDays) * 100), 100);
  }

  /**
   * Rank collaborations by composite score, highest first.
   */
  rank(collabs: Collaboration[]): Array<{ collaboration: Collaboration; score: ScoreBreakdown }> {
    return collabs
      .map((c) => ({ collaboration: c, score: this.score(c) }))
      .sort((a, b) => b.score.composite - a.score.composite);
  }
}
