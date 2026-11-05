export type HelpAudience = "ALL" | "EXECUTIVE" | "SALES" | "ESTIMATOR" | "PROCUREMENT" | "PROJECT_MANAGER" | "ADMIN" | "PRESALES" | "APPROVER";
export type HelpArticle = {
  slug: string;
  title: string;
  summary: string;
  audience: HelpAudience[];
  category: string;
  tags: string[];
  updatedAt: string;
  readingMinutes: number;
  workspaceHref?: string;
  legacy?: boolean;
  sections: Array<{ title: string; body: string[] }>;
  faqs: Array<{ question: string; answer: string }>;
  relatedSlugs?: string[];
};
