export type EventType = "page_view" | "cta_click";

export type ClickEventPayload = {
  type: EventType;
  target: string;
  visitorId: string;
  page: string;
  referrer: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
};

export type StatsResponse = {
  totalEvents: number;
  pageViews: number;
  totalClicks: number;
  uniqueVisitors: number;
  byTarget: Record<string, number>;
  recentEvents: Array<{
    type: EventType;
    target: string;
    visitorId: string;
    page: string;
    referrer: string;
    createdAt: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
  }>;
};
