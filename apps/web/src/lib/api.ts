import type { AuthSession, MemoDetail, MemoSummary, Notebook, Resource, TiptapDoc } from "@edgeever/shared";

type ListNotebooksResponse = {
  notebooks: Notebook[];
};

type ListMemosResponse = {
  memos: MemoSummary[];
};

type MemoResponse = {
  memo: MemoDetail;
};

type NotebookResponse = {
  notebook: Notebook;
};

type ResourceResponse = {
  resource: Resource;
};

export class ApiRequestError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const headers = new Headers(init?.headers);

  if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const error = body && typeof body === "object" && "error" in body ? (body as { error?: { code?: string; message?: string } }).error : undefined;
    const message =
      body && typeof body === "object" && "error" in body
        ? error?.message
        : response.statusText;

    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent("edgeever:unauthorized"));
    }

    throw new ApiRequestError(message || "Request failed", response.status, error?.code);
  }

  return response.json() as Promise<T>;
};

export const api = {
  getSession: () => request<AuthSession>("/api/v1/auth/session"),

  login: (payload: { username: string; password: string }) =>
    request<AuthSession>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  logout: () =>
    request<{ ok: true }>("/api/v1/auth/logout", {
      method: "POST",
      body: JSON.stringify({}),
    }),

  listNotebooks: () => request<ListNotebooksResponse>("/api/v1/notebooks"),

  createNotebook: (payload: { name: string; parentId?: string | null }) =>
    request<NotebookResponse>("/api/v1/notebooks", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listMemos: (params: { notebookId?: string | null; q?: string }) => {
    const search = new URLSearchParams();

    if (params.notebookId) {
      search.set("notebookId", params.notebookId);
    }

    if (params.q?.trim()) {
      search.set("q", params.q.trim());
    }

    return request<ListMemosResponse>(`/api/v1/memos?${search.toString()}`);
  },

  createMemo: (payload: { notebookId: string; title?: string; contentMarkdown?: string; tags?: string[] }) =>
    request<MemoResponse>("/api/v1/memos", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getMemo: (memoId: string) => request<MemoResponse>(`/api/v1/memos/${memoId}`),

  uploadMemoResource: (memoId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);

    return request<ResourceResponse>(`/api/v1/memos/${memoId}/resources`, {
      method: "POST",
      body: form,
    });
  },

  updateMemo: (
    memoId: string,
    payload: {
      expectedRevision?: number;
      notebookId?: string;
      title?: string;
      contentJson?: TiptapDoc;
      contentMarkdown?: string;
      tags?: string[];
    }
  ) =>
    request<MemoResponse>(`/api/v1/memos/${memoId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deleteMemo: (memoId: string) =>
    request<{ ok: true }>(`/api/v1/memos/${memoId}`, {
      method: "DELETE",
    }),

  mergeMemos: (payload: { memoIds: string[]; notebookId?: string; title?: string }) =>
    request<MemoResponse>("/api/v1/memos/merge", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
