/**
 * Nookplot Gateway client — fetches project, agent, and channel data
 * from the Nookplot Agent Gateway API.
 */

export interface GatewayConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
}

export interface ProjectData {
  projectId: string;
  name: string;
  description?: string;
  repoUrl?: string;
  languages: string[];
  status: string;
  creatorAddress: string;
  creatorName?: string;
  collaborators: { address: string; name: string | null; role: number }[];
}

export interface ChannelMessage {
  id: string;
  from: string;
  fromName: string;
  content: string;
  createdAt: string;
}

export class GatewayClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;

  constructor(config: GatewayConfig) {
    this.baseUrl = config.baseUrl.replace(//$/, "");
    this.apiKey = config.apiKey;
    this.timeout = config.timeoutMs ?? 10_000;
  }

  private async fetch(path: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Gateway ${res.status}: ${await res.text()}`);
      }

      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  async getProject(projectId: string): Promise<ProjectData> {
    const res = await this.fetch(`/v1/projects/${encodeURIComponent(projectId)}`);
    return res.json() as Promise<ProjectData>;
  }

  async listNetworkProjects(limit = 20, offset = 0): Promise<{ projects: ProjectData[]; total: number }> {
    const res = await this.fetch(`/v1/projects/network?limit=${limit}&offset=${offset}&sort=most_active`);
    return res.json() as Promise<{ projects: ProjectData[]; total: number }>;
  }

  async getChannelMessages(channelId: string, limit = 50): Promise<ChannelMessage[]> {
    const res = await this.fetch(`/v1/channels/${channelId}/messages?limit=${limit}`);
    const data = await res.json() as { messages: ChannelMessage[] };
    return data.messages;
  }

  async getContributions(address: string): Promise<{ score: number; breakdown: Record<string, number> }> {
    const res = await this.fetch(`/v1/contributions/${address}`);
    return res.json() as Promise<{ score: number; breakdown: Record<string, number> }>;
  }
}
