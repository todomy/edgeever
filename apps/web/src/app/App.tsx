import type { AuthSession, AuthUser, MemoDetail, MemoSummary, Notebook, TiptapDoc } from "@edgeever/shared";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  FilePlus2,
  Folder,
  Inbox,
  LayoutList,
  LockKeyhole,
  LogOut,
  Merge,
  MoreHorizontal,
  PanelLeft,
  Plus,
  Save,
  Search,
  Sparkles,
  Tags,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { api } from "@/lib/api";
import { localDb } from "@/lib/local-db";
import { buildNotebookTree, cn, formatDateTime, parseTagsText, type NotebookNode } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Pane = "notebooks" | "memos" | "editor";

export const App = () => {
  const queryClient = useQueryClient();
  const sessionQuery = useQuery({
    queryKey: ["auth", "session"],
    queryFn: () => api.getSession(),
    retry: false,
  });
  const loginMutation = useMutation({
    mutationFn: api.login,
    onSuccess: (session) => {
      queryClient.clear();
      queryClient.setQueryData(["auth", "session"], session);
    },
  });
  const logoutMutation = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData<AuthSession>(["auth", "session"], {
        authRequired: true,
        authenticated: false,
        user: null,
      });
    },
  });

  useEffect(() => {
    const handleUnauthorized = () => {
      const current = queryClient.getQueryData<AuthSession>(["auth", "session"]);
      queryClient.clear();
      queryClient.setQueryData<AuthSession>(["auth", "session"], {
        authRequired: current?.authRequired ?? true,
        authenticated: false,
        user: null,
      });
    };

    window.addEventListener("edgeever:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("edgeever:unauthorized", handleUnauthorized);
  }, [queryClient]);

  if (sessionQuery.isLoading) {
    return <AuthLoadingScreen />;
  }

  const session = sessionQuery.data;

  if (!session?.authenticated) {
    return (
      <LoginScreen
        error={loginMutation.error instanceof Error ? loginMutation.error.message : null}
        isSubmitting={loginMutation.isPending}
        onSubmit={(payload) => loginMutation.mutate(payload)}
      />
    );
  }

  return (
    <WorkspaceApp
      authRequired={session.authRequired}
      isLoggingOut={logoutMutation.isPending}
      user={session.user}
      onLogout={() => logoutMutation.mutate()}
    />
  );
};

const WorkspaceApp = ({
  authRequired,
  user,
  isLoggingOut,
  onLogout,
}: {
  authRequired: boolean;
  user: AuthUser | null;
  isLoggingOut: boolean;
  onLogout: () => void;
}) => {
  const queryClient = useQueryClient();
  const [activePane, setActivePane] = useState<Pane>("memos");
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null);
  const [selectedMemoId, setSelectedMemoId] = useState<string | null>(null);
  const [selectedMemoIds, setSelectedMemoIds] = useState<Set<string>>(new Set());
  const [multiSelectKeyDown, setMultiSelectKeyDown] = useState(false);
  const [search, setSearch] = useState("");

  const notebooksQuery = useQuery({
    queryKey: ["notebooks"],
    queryFn: () => api.listNotebooks(),
  });

  const notebooks = notebooksQuery.data?.notebooks ?? [];

  useEffect(() => {
    if (!selectedNotebookId && notebooks.length > 0) {
      setSelectedNotebookId(notebooks[0].id);
    }
  }, [notebooks, selectedNotebookId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.key === "Control" || event.key === "Meta") {
        setMultiSelectKeyDown(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      setMultiSelectKeyDown(event.ctrlKey || event.metaKey);
    };

    const handleBlur = () => setMultiSelectKeyDown(false);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  const memosQuery = useQuery({
    queryKey: ["memos", selectedNotebookId, search],
    queryFn: () => api.listMemos({ notebookId: selectedNotebookId, q: search }),
    enabled: Boolean(selectedNotebookId),
  });

  const memos = memosQuery.data?.memos ?? [];

  useEffect(() => {
    if (memos.length === 0) {
      setSelectedMemoId(null);
      return;
    }

    if (!selectedMemoId || !memos.some((memo) => memo.id === selectedMemoId)) {
      setSelectedMemoId(memos[0].id);
    }
  }, [memos, selectedMemoId]);

  const memoQuery = useQuery({
    queryKey: ["memo", selectedMemoId],
    queryFn: () => api.getMemo(selectedMemoId as string),
    enabled: Boolean(selectedMemoId),
  });

  const createNotebookMutation = useMutation({
    mutationFn: api.createNotebook,
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["notebooks"] });
      setSelectedNotebookId(data.notebook.id);
      setActivePane("memos");
    },
  });

  const createMemoMutation = useMutation({
    mutationFn: api.createMemo,
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["memos"] });
      queryClient.setQueryData(["memo", data.memo.id], { memo: data.memo });
      setSelectedMemoId(data.memo.id);
      setActivePane("editor");
    },
  });

  const mergeMutation = useMutation({
    mutationFn: api.mergeMemos,
    onSuccess: async (data) => {
      setSelectedMemoIds(new Set());
      await queryClient.invalidateQueries({ queryKey: ["memos"] });
      queryClient.setQueryData(["memo", data.memo.id], { memo: data.memo });
      setSelectedMemoId(data.memo.id);
      setActivePane("editor");
    },
  });

  const deleteMemoMutation = useMutation({
    mutationFn: api.deleteMemo,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["memos"] });
    },
  });

  const selectedNotebook = notebooks.find((notebook) => notebook.id === selectedNotebookId) ?? null;
  const selectedMemo = memoQuery.data?.memo ?? null;

  const handleCreateNotebook = (parentId?: string | null) => {
    const name = window.prompt("新笔记本名称");

    if (!name?.trim()) {
      return;
    }

    createNotebookMutation.mutate({ name: name.trim(), parentId: parentId ?? null });
  };

  const handleCreateMemo = () => {
    if (!selectedNotebookId) {
      return;
    }

    createMemoMutation.mutate({
      notebookId: selectedNotebookId,
      title: "Untitled memo",
      contentMarkdown: "",
      tags: [],
    });
  };

  const handleMerge = () => {
    if (!selectedNotebookId || selectedMemoIds.size < 2) {
      return;
    }

    mergeMutation.mutate({
      memoIds: Array.from(selectedMemoIds),
      notebookId: selectedNotebookId,
    });
  };

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-emerald-50 text-slate-950">
      <div className="min-w-0 flex-1">
      <main className="grid h-[100dvh] min-h-0 lg:grid-cols-[260px_360px_minmax(0,1fr)]">
        <aside
          className={cn(
            "min-h-0 border-r border-emerald-100 bg-white/90 lg:block",
            activePane === "notebooks" ? "block" : "hidden"
          )}
        >
          <NotebookPane
            authRequired={authRequired}
            user={user}
            notebooks={notebooks}
            selectedNotebookId={selectedNotebookId}
            isLoading={notebooksQuery.isLoading}
            onSelect={(notebookId) => {
              setSelectedNotebookId(notebookId);
              setSelectedMemoIds(new Set());
              setActivePane("memos");
            }}
            onCreateNotebook={handleCreateNotebook}
            onBackToList={() => setActivePane("memos")}
            onLogout={onLogout}
            isLoggingOut={isLoggingOut}
          />
        </aside>

        <section
          className={cn(
            "min-h-0 border-r border-emerald-100 bg-emerald-50/80 lg:block",
            activePane === "memos" ? "block" : "hidden"
          )}
        >
          <MemoListPane
            notebook={selectedNotebook}
            memos={memos}
            selectedMemoId={selectedMemoId}
            selectedMemoIds={selectedMemoIds}
            search={search}
            isLoading={memosQuery.isLoading}
            isCreating={createMemoMutation.isPending}
            isMerging={mergeMutation.isPending}
            multiSelectKeyDown={multiSelectKeyDown}
            onBackToNotebooks={() => setActivePane("notebooks")}
            onSearch={setSearch}
            onCreateMemo={handleCreateMemo}
            onOpenMemo={(memoId) => {
              setSelectedMemoId(memoId);
              setActivePane("editor");
            }}
            onToggleMemo={(memoId) => {
              setSelectedMemoIds((current) => toggleMemoSelection(current, memoId));
            }}
            onMerge={handleMerge}
          />
        </section>

        <section className={cn("min-h-0 min-w-0 bg-white lg:block", activePane === "editor" ? "block" : "hidden")}>
          <EditorPane
            memo={selectedMemo}
            notebooks={notebooks}
            isLoading={memoQuery.isLoading}
            onBackToList={() => setActivePane("memos")}
            onSaved={async (memo) => {
              queryClient.setQueryData(["memo", memo.id], { memo });
              await queryClient.invalidateQueries({ queryKey: ["memos"] });
            }}
            onDeleted={async (memoId) => {
              await deleteMemoMutation.mutateAsync(memoId);
              setSelectedMemoId(null);
              setActivePane("memos");
            }}
          />
        </section>
      </main>
      </div>
    </div>
  );
};

const AuthLoadingScreen = () => (
  <div className="flex h-[100dvh] items-center justify-center bg-emerald-50 text-sm font-medium text-emerald-900">
    EdgeEver
  </div>
);

const LoginScreen = ({
  error,
  isSubmitting,
  onSubmit,
}: {
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (payload: { username: string; password: string }) => void;
}) => {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!username.trim() || !password) {
      return;
    }

    onSubmit({ username: username.trim(), password });
  };

  return (
    <main className="flex h-[100dvh] items-center justify-center bg-emerald-50 px-4 py-8 text-slate-950">
      <section className="w-full max-w-[380px] rounded-md border border-emerald-100 bg-white p-5 shadow-panel">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-emerald-200 bg-emerald-100 text-emerald-900">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold leading-tight tracking-normal">登录 EdgeEver</h1>
            <p className="mt-1 text-sm text-slate-500">自托管笔记工作区</p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">账号</span>
            <input
              autoComplete="username"
              className="h-10 w-full rounded-md border border-emerald-100 bg-emerald-50/50 px-3 text-sm outline-none transition focus:border-emerald-300 focus:bg-white"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">密码</span>
            <input
              autoComplete="current-password"
              className="h-10 w-full rounded-md border border-emerald-100 bg-emerald-50/50 px-3 text-sm outline-none transition focus:border-emerald-300 focus:bg-white"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error ? (
            <div className="rounded-md border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
          ) : null}

          <Button className="w-full justify-center" size="md" type="submit" variant="solid" disabled={isSubmitting}>
            <LockKeyhole className="h-4 w-4" />
            {isSubmitting ? "登录中" : "登录"}
          </Button>
        </form>
      </section>
    </main>
  );
};

const toggleMemoSelection = (current: Set<string>, memoId: string) => {
  const next = new Set(current);

  if (next.has(memoId)) {
    next.delete(memoId);
  } else {
    next.add(memoId);
  }

  return next;
};

const NotebookPane = ({
  authRequired,
  user,
  notebooks,
  selectedNotebookId,
  isLoading,
  onSelect,
  onCreateNotebook,
  onBackToList,
  onLogout,
  isLoggingOut,
}: {
  authRequired: boolean;
  user: AuthUser | null;
  notebooks: Notebook[];
  selectedNotebookId: string | null;
  isLoading: boolean;
  onSelect: (notebookId: string) => void;
  onCreateNotebook: (parentId?: string | null) => void;
  onBackToList: () => void;
  onLogout: () => void;
  isLoggingOut: boolean;
}) => {
  const tree = useMemo(() => buildNotebookTree(notebooks), [notebooks]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-[calc(4rem+env(safe-area-inset-top))] shrink-0 items-end justify-between border-b border-emerald-100 px-4 pb-3 pt-[env(safe-area-inset-top)] lg:h-16 lg:items-center lg:pb-0 lg:pt-0">
        <div>
          <div className="text-base font-semibold tracking-normal lg:hidden">笔记本</div>
          <div className="hidden text-base font-semibold tracking-normal lg:block">EdgeEver</div>
          <div className="text-xs text-slate-500">{user?.username ?? "Cloudflare-native notes"}</div>
        </div>
        <div className="flex items-center gap-1">
          <Button className="lg:hidden" size="icon" variant="ghost" title="返回笔记列表" onClick={onBackToList}>
            <LayoutList className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" title="新建笔记本" onClick={() => onCreateNotebook(null)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-3 flex items-center gap-2 px-2 text-xs font-semibold uppercase text-slate-500">
          <Folder className="h-4 w-4" />
          Notebooks
        </div>

        {isLoading ? (
          <div className="px-2 py-3 text-sm text-slate-500">加载中</div>
        ) : (
          <div className="space-y-1">
            {tree.map((node) => (
              <NotebookTreeItem
                key={node.id}
                node={node}
                depth={0}
                selectedNotebookId={selectedNotebookId}
                onSelect={onSelect}
                onCreateNotebook={onCreateNotebook}
              />
            ))}
          </div>
        )}
      </div>

      <footer className="border-t border-emerald-100 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <div className={cn("grid gap-2", authRequired ? "grid-cols-4" : "grid-cols-3")}>
          <Button size="icon" variant="ghost" title="标签">
            <Tags className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" title="资产">
            <Archive className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" title="设置">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
          {authRequired ? (
            <Button size="icon" variant="ghost" title="退出登录" onClick={onLogout} disabled={isLoggingOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </footer>
    </div>
  );
};

const NotebookTreeItem = ({
  node,
  depth,
  selectedNotebookId,
  onSelect,
  onCreateNotebook,
}: {
  node: NotebookNode;
  depth: number;
  selectedNotebookId: string | null;
  onSelect: (notebookId: string) => void;
  onCreateNotebook: (parentId?: string | null) => void;
}) => {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;
  const selected = node.id === selectedNotebookId;

  return (
    <div>
      <div
        className={cn(
          "group flex h-9 items-center gap-1 rounded-md px-2 text-sm transition",
          selected ? "border border-emerald-200 bg-emerald-100 text-emerald-950" : "text-slate-700 hover:bg-emerald-50"
        )}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        <button
          className="flex h-6 w-5 items-center justify-center rounded"
          onClick={() => setOpen((value) => !value)}
          title={hasChildren ? "展开/折叠" : undefined}
        >
          {hasChildren ? (
            open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
          ) : (
            <span className="h-4 w-4" />
          )}
        </button>
        <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => onSelect(node.id)}>
          {node.slug === "inbox" ? <Inbox className="h-4 w-4 shrink-0" /> : <Folder className="h-4 w-4 shrink-0" />}
          <span className="truncate">{node.name}</span>
        </button>
        <button
          className={cn(
            "hidden h-6 w-6 items-center justify-center rounded-md group-hover:flex",
            selected ? "hover:bg-emerald-200" : "hover:bg-emerald-100"
          )}
          title="新建子笔记本"
          onClick={() => onCreateNotebook(node.id)}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {hasChildren && open ? (
        <div className="mt-1 space-y-1">
          {node.children.map((child) => (
            <NotebookTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedNotebookId={selectedNotebookId}
              onSelect={onSelect}
              onCreateNotebook={onCreateNotebook}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

const MemoListPane = ({
  notebook,
  memos,
  selectedMemoId,
  selectedMemoIds,
  search,
  isLoading,
  isCreating,
  isMerging,
  multiSelectKeyDown,
  onBackToNotebooks,
  onSearch,
  onCreateMemo,
  onOpenMemo,
  onToggleMemo,
  onMerge,
}: {
  notebook: Notebook | null;
  memos: MemoSummary[];
  selectedMemoId: string | null;
  selectedMemoIds: Set<string>;
  search: string;
  isLoading: boolean;
  isCreating: boolean;
  isMerging: boolean;
  multiSelectKeyDown: boolean;
  onBackToNotebooks: () => void;
  onSearch: (value: string) => void;
  onCreateMemo: () => void;
  onOpenMemo: (memoId: string) => void;
  onToggleMemo: (memoId: string) => void;
  onMerge: () => void;
}) => (
  <div className="relative flex h-full min-h-0 flex-col">
    <header className="border-b border-emerald-100 bg-white px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:py-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button className="lg:hidden" size="icon" variant="ghost" title="打开笔记本" onClick={onBackToNotebooks}>
            <PanelLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold text-slate-950 lg:text-sm">{notebook?.name ?? "全部笔记"}</div>
            <div className="text-xs text-slate-500">{memos.length} memos</div>
          </div>
        </div>
        <Button className="hidden lg:inline-flex" size="icon" variant="solid" title="新建笔记" onClick={onCreateMemo} disabled={!notebook || isCreating}>
          <FilePlus2 className="h-4 w-4" />
        </Button>
      </div>
      <label className="flex h-9 items-center gap-2 rounded-md border border-emerald-100 bg-emerald-50/70 px-3 text-sm text-slate-500">
        <Search className="h-4 w-4" />
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-slate-900 outline-none placeholder:text-slate-400"
          placeholder="Search memos"
        />
      </label>
    </header>

    <div className="relative min-h-0 flex-1 overflow-y-auto p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {selectedMemoIds.size > 0 ? (
        <div className="sticky top-0 z-10 mb-3 flex items-center justify-between rounded-md border border-emerald-100 bg-white px-3 py-2 shadow-panel">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckSquare className="h-4 w-4 text-emerald-700" />
            {selectedMemoIds.size} selected
          </div>
          <Button size="sm" variant="solid" onClick={onMerge} disabled={selectedMemoIds.size < 2 || isMerging}>
            <Merge className="h-4 w-4" />
            合并
          </Button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="px-2 py-4 text-sm text-slate-500">加载中</div>
      ) : memos.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
          No memos
        </div>
      ) : (
        <div className="space-y-2">
          {memos.map((memo) => (
            <MemoCard
              key={memo.id}
              memo={memo}
              selected={memo.id === selectedMemoId}
              checked={selectedMemoIds.has(memo.id)}
              multiSelectKeyDown={multiSelectKeyDown}
              onOpen={() => onOpenMemo(memo.id)}
              onToggle={() => onToggleMemo(memo.id)}
            />
          ))}
        </div>
      )}
    </div>
    {selectedMemoIds.size === 0 ? (
      <button
        className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 flex h-14 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-100 px-5 text-sm font-semibold text-emerald-950 shadow-panel transition hover:bg-emerald-200 disabled:opacity-50 lg:hidden"
        title="新建笔记"
        onClick={onCreateMemo}
        disabled={!notebook || isCreating}
      >
        <FilePlus2 className="h-5 w-5" />
        新建
      </button>
    ) : null}
  </div>
);

const MemoCard = ({
  memo,
  selected,
  checked,
  multiSelectKeyDown,
  onOpen,
  onToggle,
}: {
  memo: MemoSummary;
  selected: boolean;
  checked: boolean;
  multiSelectKeyDown: boolean;
  onOpen: () => void;
  onToggle: () => void;
}) => {
  const handledModifierPointerRef = useRef(false);

  const shouldToggleSelection = (event: MouseEvent<HTMLElement>) =>
    event.ctrlKey || event.metaKey || multiSelectKeyDown;

  const markModifierPointerHandled = () => {
    handledModifierPointerRef.current = true;
    window.setTimeout(() => {
      handledModifierPointerRef.current = false;
    }, 450);
  };

  const handleModifierToggle = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    markModifierPointerHandled();
    onToggle();
  };

  const handleMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    if (shouldToggleSelection(event)) {
      handleModifierToggle(event);
    }
  };

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (handledModifierPointerRef.current) {
      event.preventDefault();
      event.stopPropagation();
      handledModifierPointerRef.current = false;
      return;
    }

    if (shouldToggleSelection(event)) {
      handleModifierToggle(event);
      return;
    }

    onOpen();
  };

  const handleContextMenu = (event: MouseEvent<HTMLButtonElement>) => {
    if (!shouldToggleSelection(event) && !handledModifierPointerRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (!handledModifierPointerRef.current) {
      markModifierPointerHandled();
      onToggle();
    }
  };

  return (
    <article
      className={cn(
        "rounded-md border bg-white p-3 transition",
        selected ? "border-emerald-300 shadow-panel" : "border-emerald-100 hover:border-emerald-200",
        checked && "border-emerald-300 bg-emerald-50/70"
      )}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="mt-1 h-5 w-5 shrink-0 rounded border-emerald-300 text-emerald-600"
          aria-label={`选择 ${memo.title ?? memo.excerpt}`}
        />
        <button
          className={cn("min-w-0 flex-1 text-left", multiSelectKeyDown && "cursor-copy")}
          onMouseDown={handleMouseDown}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          title="Ctrl/Cmd 点击切换选择"
        >
          <div className="mb-1 truncate text-sm font-semibold text-slate-950">{memo.title || "Untitled memo"}</div>
          <div className="line-clamp-2 min-h-[40px] text-sm leading-5 text-slate-600">{memo.excerpt || "Empty memo"}</div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <time className="text-xs text-slate-400">{formatDateTime(memo.updatedAt)}</time>
            {memo.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
                #{tag}
              </span>
            ))}
          </div>
        </button>
      </div>
    </article>
  );
};

const SUPPORTED_PASTE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"]);

const getImageFilesFromDataTransfer = (dataTransfer: DataTransfer | null) => {
  if (!dataTransfer) {
    return [];
  }

  const fileItems = Array.from(dataTransfer.items ?? [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));
  const files = fileItems.length > 0 ? fileItems : Array.from(dataTransfer.files ?? []);

  return files.filter((file) => SUPPORTED_PASTE_IMAGE_TYPES.has(file.type));
};

const EditorPane = ({
  memo,
  notebooks,
  isLoading,
  onBackToList,
  onSaved,
  onDeleted,
}: {
  memo: MemoDetail | null;
  notebooks: Notebook[];
  isLoading: boolean;
  onBackToList: () => void;
  onSaved: (memo: MemoDetail) => Promise<void>;
  onDeleted: (memoId: string) => Promise<void>;
}) => {
  const [title, setTitle] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [imageUploadState, setImageUploadState] = useState<"idle" | "uploading" | "error">("idle");
  const memoRef = useRef<MemoDetail | null>(memo);
  const editorRef = useRef<Editor | null>(null);
  const insertImageFiles = useCallback((files: File[]) => {
    const currentMemo = memoRef.current;
    const currentEditor = editorRef.current;

    if (!currentMemo || !currentEditor || files.length === 0) {
      return;
    }

    const targetMemoId = currentMemo.id;

    void (async () => {
      setImageUploadState("uploading");

      try {
        for (const file of files) {
          const { resource } = await api.uploadMemoResource(targetMemoId, file);

          if (memoRef.current?.id !== targetMemoId || !editorRef.current) {
            setImageUploadState("idle");
            return;
          }

          editorRef.current
            .chain()
            .focus()
            .setImage({
              src: resource.url,
              alt: resource.filename ?? file.name,
              title: resource.filename ?? file.name,
            })
            .run();
        }

        setImageUploadState("idle");
      } catch {
        setImageUploadState("error");
        window.setTimeout(() => setImageUploadState("idle"), 2200);
      }
    })();
  }, []);
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({
        allowBase64: false,
        inline: false,
      }),
      Placeholder.configure({
        placeholder: "Start writing...",
      }),
    ],
    content: memo?.contentJson ?? { type: "doc", content: [{ type: "paragraph" }] },
    editorProps: {
      attributes: {
        class: "prose prose-slate max-w-none",
      },
      handlePaste: (_view, event) => {
        const files = getImageFilesFromDataTransfer(event.clipboardData);

        if (files.length === 0) {
          return false;
        }

        event.preventDefault();
        insertImageFiles(files);
        return true;
      },
      handleDrop: (_view, event) => {
        const files = getImageFilesFromDataTransfer(event.dataTransfer);

        if (files.length === 0) {
          return false;
        }

        event.preventDefault();
        insertImageFiles(files);
        return true;
      },
    },
  });

  useEffect(() => {
    memoRef.current = memo;
  }, [memo]);

  useEffect(() => {
    editorRef.current = editor;

    return () => {
      if (editorRef.current === editor) {
        editorRef.current = null;
      }
    };
  }, [editor]);

  useEffect(() => {
    if (!memo) {
      setTitle("");
      setTagsText("");
      editor?.commands.clearContent();
      return;
    }

    setTitle(memo.title ?? "");
    setTagsText(memo.tags.join(", "));

    if (editor) {
      editor.commands.setContent(memo.contentJson);
    }
  }, [editor, memo]);

  useEffect(() => {
    if (!editor || !memo) {
      return;
    }

    const persistDraft = () => {
      void localDb.drafts.put({
        memoId: memo.id,
        title,
        tagsText,
        contentJson: editor.getJSON() as TiptapDoc,
        updatedAt: new Date().toISOString(),
      });
    };

    editor.on("update", persistDraft);
    return () => {
      editor.off("update", persistDraft);
    };
  }, [editor, memo, tagsText, title]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!memo || !editor) {
        throw new Error("No memo selected");
      }

      return api.updateMemo(memo.id, {
        expectedRevision: memo.revision,
        title,
        contentJson: editor.getJSON() as TiptapDoc,
        tags: parseTagsText(tagsText),
      });
    },
    onMutate: () => setSaveState("saving"),
    onSuccess: async (data) => {
      await localDb.drafts.delete(data.memo.id);
      await onSaved(data.memo);
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1400);
    },
    onError: () => setSaveState("idle"),
  });

  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-500">加载中</div>;
  }

  if (!memo) {
    return (
      <div className="flex h-full items-center justify-center bg-white px-8 text-center">
        <div>
          <Sparkles className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <div className="text-sm font-medium text-slate-700">Select or create a memo</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
      <header className="shrink-0 border-b border-emerald-100 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <Button className="lg:hidden" size="icon" variant="ghost" title="返回列表" onClick={onBackToList}>
              <LayoutList className="h-4 w-4" />
            </Button>
            <select
              value={memo.notebookId}
              className="h-8 min-w-0 max-w-[170px] rounded-md border border-emerald-100 bg-emerald-50/70 px-2 text-xs text-emerald-900 outline-none sm:max-w-none"
              onChange={(event) => {
                void api
                  .updateMemo(memo.id, {
                    expectedRevision: memo.revision,
                    notebookId: event.target.value,
                  })
                  .then((data) => onSaved(data.memo));
              }}
            >
              {notebooks.map((notebook) => (
                <option key={notebook.id} value={notebook.id}>
                  {notebook.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {imageUploadState !== "idle" ? (
              <span
                className={cn(
                  "hidden rounded-md px-2 py-1 text-xs font-medium sm:inline-flex",
                  imageUploadState === "error"
                    ? "bg-rose-50 text-rose-700"
                    : "bg-emerald-50 text-emerald-700"
                )}
              >
                {imageUploadState === "error" ? "图片上传失败" : "图片上传中"}
              </span>
            ) : null}
            <Button size="sm" variant="ghost" title="删除笔记" onClick={() => void onDeleted(memo.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="solid" onClick={() => saveMutation.mutate()} disabled={!editor || saveMutation.isPending}>
              <Save className="h-4 w-4" />
              {saveState === "saving" ? "保存中" : saveState === "saved" ? "已保存" : "保存"}
            </Button>
          </div>
        </div>

        <div className="space-y-3 px-4 pb-4 sm:px-7">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="block w-full border-0 bg-transparent text-2xl font-semibold leading-tight text-slate-950 outline-none placeholder:text-slate-300 sm:text-3xl"
            placeholder="Untitled memo"
          />
          <label className="flex h-8 items-center gap-2 text-sm text-slate-500">
            <Tags className="h-4 w-4" />
            <input
              value={tagsText}
              onChange={(event) => setTagsText(event.target.value)}
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400"
              placeholder="tags"
            />
          </label>
        </div>
      </header>

      <div className="edgeever-editor min-h-0 flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};
