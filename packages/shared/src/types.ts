import type { TiptapDoc } from "./content";

export type Notebook = {
  id: string;
  parentId: string | null;
  name: string;
  slug: string | null;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type MemoSummary = {
  id: string;
  notebookId: string;
  title: string | null;
  excerpt: string;
  tags: string[];
  isPinned: boolean;
  isArchived: boolean;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type MemoDetail = MemoSummary & {
  contentJson: TiptapDoc;
  contentMarkdown: string;
  contentText: string;
  sourceMemoIds: string[];
  mergeSourceCount: number;
  mergedIntoMemoId: string | null;
};

export type ResourceKind = "image" | "attachment";

export type Resource = {
  id: string;
  memoId: string;
  originalMemoId: string | null;
  kind: ResourceKind;
  mimeType: string | null;
  filename: string | null;
  byteSize: number;
  sha256: string | null;
  width: number | null;
  height: number | null;
  createdAt: string;
  updatedAt: string;
  url: string;
};

export type AuthUser = {
  id: string;
  username: string;
  displayName: string | null;
};

export type AuthSession = {
  authRequired: boolean;
  authenticated: boolean;
  user: AuthUser | null;
};

export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};
