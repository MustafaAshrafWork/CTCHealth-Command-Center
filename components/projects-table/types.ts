import type { Health } from "@/lib/health";

export type ProjectRow = {
  id: string;
  version: number;
  name: string;
  client: string;
  category: string;
  status: string;
  priority: string;
  ownerId: string;
  ownerName: string;
  progress: number;
  startDate: string;
  endDate: string;
  health: Health;
};
