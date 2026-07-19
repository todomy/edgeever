'use dom';

import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { TiptapDoc } from "@edgeever/shared";
import {
  MOBILE_EDITOR_ACTIVE_FLAGS,
  MOBILE_EDITOR_TOOLBAR_ACTIONS,
  getMobileEditorInputAttributes,
  getMobileEditorPlaceholder,
  getMobileEditorToolbarActionLabel,
  getMobileEditorToolbarLabel,
  type MobileEditorToolbarActionId,
} from "@edgeever/shared/mobile-editor";
import { useDOMImperativeHandle, type DOMImperativeFactory, type DOMProps } from "expo/dom";
import { useCallback, useEffect, useMemo, useRef, type ReactNode, type Ref } from "react";
import {
  createMobileImageUploadPlaceholderSource,
  isMobileImageUploadPlaceholderSource,
  stripMobileImageUploadPlaceholders,
} from "../lib/mobile-image-upload-placeholder";

type EditorDoc = TiptapDoc;

type DOMValue = Parameters<DOMImperativeFactory[string]>[0];

export interface LocalTiptapEditorRef extends DOMImperativeFactory {
  beginImageUpload: (uploadId: DOMValue, previewDataUrl: DOMValue) => void;
  cancelImageUpload: (uploadId: DOMValue) => void;
  completeImageUpload: (uploadId: DOMValue, imageUrl: DOMValue, alt: DOMValue) => void;
  flush: () => void;
  focusEnd: () => void;
  replaceAll: (query: DOMValue, replacement: DOMValue) => void;
  search: (query: DOMValue, index: DOMValue) => void;
}

type LocalTiptapEditorProps = {
  autoFocus?: boolean;
  baseUrl: string;
  content: EditorDoc;
  dom?: DOMProps;
  onChange: (content: EditorDoc) => Promise<void>;
  onLoadResource: (source: string) => Promise<string | null>;
  onPickImage: () => Promise<void>;
  onReady: (startupMs: number) => Promise<void>;
  onSearchResult?: (count: number, index: number) => Promise<void>;
  ref: Ref<LocalTiptapEditorRef>;
  locale: "zh-CN" | "en-US";
  theme: "light" | "dark";
};

const CHANGE_IDLE_MS = 500;
const TRANSIENT_IMAGE_UPLOAD_META = "edgeeverImageUploadPlaceholder";
const ignoreSearchResult = async () => undefined;

export default function LocalTiptapEditor(props: LocalTiptapEditorProps) {
  const startedAtRef = useRef(performance.now());
  const changeTimerRef = useRef<number | null>(null);
  const imageUploadInFlightRef = useRef(false);
  const pendingImageSelectionRef = useRef<{ from: number; to: number } | null>(null);
  const onChangeRef = useRef(props.onChange);
  const onLoadResourceRef = useRef(props.onLoadResource);
  const onPickImageRef = useRef(props.onPickImage);
  const onReadyRef = useRef(props.onReady);
  const onSearchResultRef = useRef(props.onSearchResult ?? ignoreSearchResult);

  onChangeRef.current = props.onChange;
  onLoadResourceRef.current = props.onLoadResource;
  onPickImageRef.current = props.onPickImage;
  onReadyRef.current = props.onReady;
  onSearchResultRef.current = props.onSearchResult ?? ignoreSearchResult;
  const protectedImageExtension = useMemo(
    () => createProtectedImageExtension(props.baseUrl, props.locale, (source) => onLoadResourceRef.current(source)),
    [props.baseUrl, props.locale]
  );

  const editor = useEditor({
    autofocus: props.autoFocus ? "end" : false,
    extensions: [
      StarterKit,
      protectedImageExtension,
      Placeholder.configure({
        placeholder: getMobileEditorPlaceholder(props.locale),
      }),
    ],
    content: resolveImageSources(props.content, props.baseUrl),
    editorProps: {
      attributes: getMobileEditorInputAttributes("edgeever-editor-content"),
    },
    onUpdate: ({ editor: activeEditor, transaction }) => {
      if (transaction.getMeta(TRANSIENT_IMAGE_UPLOAD_META)) {
        return;
      }
      if (changeTimerRef.current !== null) {
        window.clearTimeout(changeTimerRef.current);
      }
      changeTimerRef.current = window.setTimeout(() => {
        changeTimerRef.current = null;
        void onChangeRef.current(getPersistableEditorDoc(activeEditor.getJSON() as EditorDoc, props.baseUrl));
      }, CHANGE_IDLE_MS);
    },
  });

  const flush = useCallback(() => {
    if (!editor || editor.isDestroyed) {
      return;
    }
    if (changeTimerRef.current !== null) {
      window.clearTimeout(changeTimerRef.current);
      changeTimerRef.current = null;
    }
    void onChangeRef.current(getPersistableEditorDoc(editor.getJSON() as EditorDoc, props.baseUrl));
  }, [editor, props.baseUrl]);

  const search = useCallback((query: DOMValue, requestedIndex: DOMValue) => {
    const matches = getEditorSearchMatches(editor, typeof query === "string" ? query : "");
    const requestedMatchIndex = typeof requestedIndex === "number" ? requestedIndex : 0;
    const index = matches.length > 0
      ? Math.min(Math.max(requestedMatchIndex, 0), matches.length - 1)
      : 0;
    const match = matches[index];
    if (editor && !editor.isDestroyed && match) {
      editor.commands.setTextSelection({ from: match.from, to: match.to });
    }
    void onSearchResultRef.current(matches.length, index);
  }, [editor]);

  const replaceAll = useCallback((query: DOMValue, replacement: DOMValue) => {
    const normalizedQuery = typeof query === "string" ? query : "";
    const normalizedReplacement = typeof replacement === "string" ? replacement : "";
    const matches = getEditorSearchMatches(editor, normalizedQuery);
    if (!editor || editor.isDestroyed || matches.length === 0) {
      void onSearchResultRef.current(0, 0);
      return;
    }
    editor
      .chain()
      .focus()
      .command(({ tr, dispatch }) => {
        for (const match of [...matches].reverse()) {
          tr.insertText(normalizedReplacement, match.from, match.to);
        }
        dispatch?.(tr);
        return true;
      })
      .run();
    window.requestAnimationFrame(() => search(normalizedQuery, 0));
  }, [editor, search]);

  const beginImageUpload = useCallback((uploadIdValue: DOMValue, previewDataUrlValue: DOMValue) => {
    if (!editor || typeof uploadIdValue !== "string" || typeof previewDataUrlValue !== "string") {
      return;
    }
    insertImageUploadPlaceholder(
      editor,
      createMobileImageUploadPlaceholderSource(uploadIdValue),
      props.locale === "en-US" ? "Uploading image…" : "图片上传中…",
      previewDataUrlValue,
      pendingImageSelectionRef.current
    );
  }, [editor, props.locale]);

  const cancelImageUpload = useCallback((uploadIdValue: DOMValue) => {
    if (!editor || typeof uploadIdValue !== "string") {
      return;
    }
    removeImageUploadPlaceholder(editor, createMobileImageUploadPlaceholderSource(uploadIdValue));
  }, [editor]);

  const completeImageUpload = useCallback((uploadIdValue: DOMValue, imageUrlValue: DOMValue, altValue: DOMValue) => {
    if (!editor || typeof uploadIdValue !== "string" || typeof imageUrlValue !== "string") {
      return;
    }
    replaceImageUploadPlaceholder(
      editor,
      createMobileImageUploadPlaceholderSource(uploadIdValue),
      resolveUrl(imageUrlValue, props.baseUrl),
      typeof altValue === "string" ? altValue : ""
    );
  }, [editor, props.baseUrl]);

  useDOMImperativeHandle(
    props.ref,
    () => ({
      beginImageUpload,
      cancelImageUpload,
      completeImageUpload,
      flush,
      focusEnd: () => editor?.commands.focus("end"),
      replaceAll,
      search,
    }),
    [beginImageUpload, cancelImageUpload, completeImageUpload, editor, flush, replaceAll, search]
  );

  useEffect(() => {
    if (!editor) {
      return;
    }

    void onReadyRef.current(Math.round(performance.now() - startedAtRef.current));
    let focusFrame = 0;
    let focusRetry: number | null = null;
    if (props.autoFocus) {
      const focusAtEnd = () => {
        if (!editor.isDestroyed) {
          editor.commands.focus("end");
        }
      };
      focusFrame = window.requestAnimationFrame(focusAtEnd);
      // The DOM view can report ready one bridge turn before Android attaches
      // its input connection. Keep the HTML selection ready for the native IME
      // handoff without delaying the editor's first visible frame.
      focusRetry = window.setTimeout(focusAtEnd, 120);
    }
    const handlePageHide = () => flush();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flush();
      }
    };
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      if (focusRetry !== null) {
        window.clearTimeout(focusRetry);
      }
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (changeTimerRef.current !== null) {
        window.clearTimeout(changeTimerRef.current);
      }
    };
  }, [editor, flush, props.autoFocus]);

  const toolbarState = useEditorState({
    editor,
    selector: ({ editor: activeEditor }) =>
      (activeEditor?.isActive("bold") ? MOBILE_EDITOR_ACTIVE_FLAGS.bold : 0) |
      (activeEditor?.isActive("bulletList") ? MOBILE_EDITOR_ACTIVE_FLAGS.bulletList : 0) |
      (activeEditor?.isActive("blockquote") ? MOBILE_EDITOR_ACTIVE_FLAGS.blockquote : 0),
  });

  const insertImage = async () => {
    if (!editor || imageUploadInFlightRef.current) {
      return;
    }

    imageUploadInFlightRef.current = true;
    pendingImageSelectionRef.current = {
      from: editor.state.selection.from,
      to: editor.state.selection.to,
    };

    try {
      await onPickImageRef.current();
    } finally {
      pendingImageSelectionRef.current = null;
      imageUploadInFlightRef.current = false;
    }
  };

  const toolbarIcons: Record<MobileEditorToolbarActionId, ReactNode> = {
    image: <ImagePlusIcon />,
    bold: <BoldIcon />,
    bulletList: <ListIcon />,
    blockquote: <QuoteIcon />,
    horizontalRule: <MinusIcon />,
  };
  const toolbarHandlers: Record<MobileEditorToolbarActionId, () => void> = {
    image: () => void insertImage(),
    bold: () => editor?.chain().focus().toggleBold().run(),
    bulletList: () => editor?.chain().focus().toggleBulletList().run(),
    blockquote: () => editor?.chain().focus().toggleBlockquote().run(),
    horizontalRule: () => editor?.chain().focus().setHorizontalRule().run(),
  };

  return (
    <div className="edgeever-editor-shell">
      <style>{getEditorStyles(props.theme)}</style>
      <div aria-label={getMobileEditorToolbarLabel(props.locale)} className="edgeever-editor-toolbar" role="toolbar">
        {MOBILE_EDITOR_TOOLBAR_ACTIONS.map((action) => (
          <ToolbarButton
            key={action.id}
            active={action.activeFlag > 0 && Boolean(toolbarState & action.activeFlag)}
            icon={toolbarIcons[action.id]}
            label={getMobileEditorToolbarActionLabel(action.id, props.locale)}
            onRun={toolbarHandlers[action.id]}
          />
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

const ToolbarButton = ({ active = false, icon, label, onRun }: { active?: boolean; icon: ReactNode; label: string; onRun: () => void }) => (
  <button
    aria-label={label}
    aria-pressed={active}
    className={active ? "is-active" : undefined}
    onMouseDown={(event) => event.preventDefault()}
    onClick={onRun}
    type="button"
  >
    {icon}
  </button>
);

type EditorSearchMatch = { from: number; to: number };

const getEditorSearchMatches = (editor: ReturnType<typeof useEditor>, query: string): EditorSearchMatch[] => {
  const needle = query.trim().toLocaleLowerCase();
  if (!editor || editor.isDestroyed || needle.length === 0) {
    return [];
  }

  const characters: Array<{ char: string; pos: number }> = [];
  let previousTextEnd: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) {
      return;
    }
    if (previousTextEnd !== null && pos > previousTextEnd) {
      characters.push({ char: "\u0000", pos: -1 });
    }
    for (let index = 0; index < node.text.length; index += 1) {
      characters.push({ char: node.text[index] ?? "", pos: pos + index });
    }
    previousTextEnd = pos + node.text.length;
  });

  const haystack = characters.map((item) => item.char).join("").toLocaleLowerCase();
  const matches: EditorSearchMatch[] = [];
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    const start = characters[index];
    const end = characters[index + needle.length - 1];
    if (start && end && start.pos >= 0 && end.pos >= 0) {
      matches.push({ from: start.pos, to: end.pos + 1 });
    }
    index = haystack.indexOf(needle, index + needle.length);
  }
  return matches;
};

const EditorIcon = ({ children, size, strokeWidth }: { children: ReactNode; size: number; strokeWidth: number }) => (
  <svg aria-hidden="true" fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} viewBox="0 0 24 24" width={size}>
    {children}
  </svg>
);

// Keep the same Lucide paths as the PWA toolbar without pulling the full icon
// barrel into the standalone DOM bundle (which adds roughly 1.8 MB in Metro).
const ImagePlusIcon = () => (
  <EditorIcon size={18} strokeWidth={2}>
    <path d="M16 5h6" />
    <path d="M19 2v6" />
    <path d="M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    <circle cx="9" cy="9" r="2" />
  </EditorIcon>
);

const BoldIcon = () => (
  <EditorIcon size={17} strokeWidth={2.4}>
    <path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" />
  </EditorIcon>
);

const ListIcon = () => (
  <EditorIcon size={18} strokeWidth={2.2}>
    <path d="M3 5h.01M3 12h.01M3 19h.01M8 5h13M8 12h13M8 19h13" />
  </EditorIcon>
);

const QuoteIcon = () => (
  <EditorIcon size={17} strokeWidth={2.2}>
    <path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z" />
    <path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z" />
  </EditorIcon>
);

const MinusIcon = () => (
  <EditorIcon size={18} strokeWidth={2.4}>
    <path d="M5 12h14" />
  </EditorIcon>
);

const mapImageSources = (doc: EditorDoc, mapSource: (source: string) => string): EditorDoc => {
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(visit);
    }
    if (!value || typeof value !== "object") {
      return value;
    }
    const node = value as Record<string, unknown>;
    const next = Object.fromEntries(Object.entries(node).map(([key, child]) => [key, visit(child)]));
    if (node.type === "image" && next.attrs && typeof next.attrs === "object") {
      const attrs = next.attrs as Record<string, unknown>;
      if (typeof attrs.src === "string") {
        next.attrs = { ...attrs, src: mapSource(attrs.src) };
      }
    }
    return next;
  };

  return visit(doc) as EditorDoc;
};

const resolveImageSources = (doc: EditorDoc, baseUrl: string) => mapImageSources(doc, (source) => resolveUrl(source, baseUrl));

const normalizeImageSources = (doc: EditorDoc, baseUrl: string) => {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  return mapImageSources(doc, (source) => source.startsWith(`${normalizedBaseUrl}/`) ? source.slice(normalizedBaseUrl.length) : source);
};

const getPersistableEditorDoc = (doc: EditorDoc, baseUrl: string) =>
  normalizeImageSources(stripMobileImageUploadPlaceholders(doc), baseUrl);

const normalizeProtectedResourceSource = (source: string, baseUrl: string) => {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const relativeSource = source.startsWith(`${normalizedBaseUrl}/`) ? source.slice(normalizedBaseUrl.length) : source;
  return relativeSource.startsWith("/api/v1/resources/") ? relativeSource : null;
};

const resolveUrl = (source: string, baseUrl: string) => {
  if (!source.startsWith("/")) {
    return source;
  }
  return `${baseUrl.replace(/\/+$/, "")}${source}`;
};

const createProtectedImageExtension = (
  baseUrl: string,
  locale: "zh-CN" | "en-US",
  loadResource: (source: string) => Promise<string | null>
) => Image.extend({
  addNodeView() {
    return ({ node }) => {
      if (isMobileImageUploadPlaceholderSource(node.attrs.src)) {
        const placeholder = document.createElement("div");
        placeholder.className = "edgeever-image-upload-placeholder";
        placeholder.contentEditable = "false";
        placeholder.setAttribute("role", "status");
        placeholder.setAttribute("aria-live", "polite");

        const preview = document.createElement("img");
        preview.className = "edgeever-image-upload-preview";
        preview.alt = "";
        const previewSource = String(node.attrs.title ?? "");
        if (previewSource) {
          preview.src = previewSource;
        }

        const overlay = document.createElement("div");
        overlay.className = "edgeever-image-upload-overlay";
        const spinner = document.createElement("span");
        spinner.className = "edgeever-image-upload-spinner";
        spinner.setAttribute("aria-hidden", "true");
        overlay.append(spinner, locale === "en-US" ? "Uploading image…" : "图片上传中…");
        if (previewSource) {
          placeholder.append(preview);
        }
        placeholder.append(overlay);

        return {
          dom: placeholder,
          update: (updatedNode) => isMobileImageUploadPlaceholderSource(updatedNode.attrs.src),
        };
      }

      const image = document.createElement("img");
      const imageType = node.type;
      let requestId = 0;

      const clearRequest = () => {
        requestId += 1;
      };

      const renderNode = (attributes: Record<string, unknown>) => {
        clearRequest();
        const source = String(attributes.src ?? "");
        const alt = String(attributes.alt ?? "");
        const title = String(attributes.title ?? "");
        image.alt = alt;
        if (title) {
          image.title = title;
        } else {
          image.removeAttribute("title");
        }

        const protectedSource = normalizeProtectedResourceSource(source, baseUrl);
        if (!protectedSource) {
          image.src = resolveUrl(source, baseUrl);
          return;
        }

        image.removeAttribute("src");
        const activeRequestId = requestId;
        void loadResource(protectedSource)
          .then((dataUrl) => {
            if (activeRequestId === requestId) {
              image.src = dataUrl ?? resolveUrl(source, baseUrl);
            }
          })
          .catch(() => {
            if (activeRequestId === requestId) {
              image.src = resolveUrl(source, baseUrl);
            }
          });
      };

      renderNode(node.attrs);

      return {
        dom: image,
        update: (updatedNode) => {
          if (updatedNode.type !== imageType) {
            return false;
          }
          renderNode(updatedNode.attrs);
          return true;
        },
        destroy: clearRequest,
      };
    };
  },
}).configure({
  allowBase64: false,
  inline: false,
});

type TiptapEditor = NonNullable<ReturnType<typeof useEditor>>;
type ImageUploadPlaceholderMatch = { nodeSize: number; pos: number };

const findImageUploadPlaceholder = (
  editor: TiptapEditor,
  source: string
): ImageUploadPlaceholderMatch | null => {
  let match: ImageUploadPlaceholderMatch | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "image" && node.attrs.src === source) {
      match = { nodeSize: node.nodeSize, pos };
      return false;
    }
  });
  return match as ImageUploadPlaceholderMatch | null;
};

const insertImageUploadPlaceholder = (
  editor: TiptapEditor,
  source: string,
  alt: string,
  previewDataUrl: string,
  selection: { from: number; to: number } | null
) => {
  const imageType = editor.schema.nodes.image;
  if (!imageType) {
    return;
  }
  editor.chain().command(({ tr, dispatch }) => {
    const from = Math.min(selection?.from ?? tr.selection.from, tr.doc.content.size);
    const to = Math.min(Math.max(selection?.to ?? tr.selection.to, from), tr.doc.content.size);
    tr.replaceRangeWith(from, to, imageType.create({ alt, src: source, title: previewDataUrl }));
    tr.setMeta(TRANSIENT_IMAGE_UPLOAD_META, true);
    dispatch?.(tr);
    return true;
  }).run();
};

const replaceImageUploadPlaceholder = (
  editor: TiptapEditor,
  placeholderSource: string,
  imageSource: string,
  alt: string
) => {
  const match = findImageUploadPlaceholder(editor, placeholderSource);
  if (!match) {
    return;
  }
  editor.chain().command(({ tr, dispatch }) => {
    const node = tr.doc.nodeAt(match.pos);
    if (!node) {
      return false;
    }
    tr.setNodeMarkup(match.pos, node.type, { ...node.attrs, alt, src: imageSource, title: null });
    dispatch?.(tr);
    return true;
  }).run();
};

const removeImageUploadPlaceholder = (editor: TiptapEditor, source: string) => {
  const match = findImageUploadPlaceholder(editor, source);
  if (!match) {
    return;
  }
  editor.chain().command(({ tr, dispatch }) => {
    tr.delete(match.pos, match.pos + match.nodeSize);
    tr.setMeta(TRANSIENT_IMAGE_UPLOAD_META, true);
    dispatch?.(tr);
    return true;
  }).run();
};

const getEditorStyles = (theme: "light" | "dark") => `
  :root { color-scheme: ${theme}; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  * { box-sizing: border-box; }
  html, body, #root { width: 100%; height: 100%; margin: 0; background: ${theme === "dark" ? "#0f172a" : "#fff"}; }
  body { overflow: hidden; color: ${theme === "dark" ? "#f8fafc" : "#0f172a"}; }
  .edgeever-editor-shell { display: flex; height: 100%; min-height: 100%; flex-direction: column; background: ${theme === "dark" ? "#0f172a" : "#fff"}; }
  .edgeever-editor-toolbar { display: flex; flex: 0 0 auto; align-items: center; gap: 4px; min-height: 38px; overflow-x: auto; padding: 6px 12px; border-block: 1px solid ${theme === "dark" ? "#334155" : "#f1f5f9"}; background: ${theme === "dark" ? "#0f172a" : "#fff"}; scrollbar-width: none; }
  .edgeever-editor-toolbar::-webkit-scrollbar { display: none; }
  .edgeever-editor-toolbar button { display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center; width: 36px; min-height: 32px; padding: 0; border: 1px solid transparent; border-radius: 999px; background: transparent; color: ${theme === "dark" ? "#cbd5e1" : "#64748b"}; }
  .edgeever-editor-toolbar button:active, .edgeever-editor-toolbar button.is-active { border-color: ${theme === "dark" ? "#166534" : "#bbf7d0"}; background: ${theme === "dark" ? "#14532d" : "#ecfdf5"}; color: ${theme === "dark" ? "#86efac" : "#047857"}; }
  .tiptap { min-height: 100%; outline: none; }
  .edgeever-editor-shell > div:last-child { min-height: 0; flex: 1; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
  .edgeever-editor-content { min-height: 100%; padding: 18px 12px 32px; font-size: 17px; line-height: 1.7; word-break: break-word; caret-color: #0f766e; }
  .edgeever-editor-content > :first-child { margin-top: 0; }
  .edgeever-editor-content p.is-editor-empty:first-child::before { float: left; height: 0; color: #94a3b8; content: attr(data-placeholder); pointer-events: none; }
  .edgeever-editor-content h1, .edgeever-editor-content h2, .edgeever-editor-content h3 { line-height: 1.3; }
  .edgeever-editor-content blockquote { margin-left: 0; padding-left: 14px; border-left: 3px solid #5eead4; color: ${theme === "dark" ? "#cbd5e1" : "#475569"}; }
  .edgeever-editor-content pre { overflow-x: auto; border-radius: 10px; padding: 14px; background: #0f172a; color: #e2e8f0; }
  .edgeever-editor-content code { border-radius: 4px; padding: 2px 4px; background: ${theme === "dark" ? "#1e293b" : "#f1f5f9"}; }
  .edgeever-editor-content pre code { padding: 0; background: transparent; }
  .edgeever-editor-content img { display: block; max-width: 100%; height: auto; margin: 14px auto; border-radius: 10px; }
  .edgeever-image-upload-placeholder { position: relative; min-height: 112px; margin: 14px 0; overflow: hidden; border-radius: 10px; background: ${theme === "dark" ? "#1e293b" : "#f1f5f9"}; }
  .edgeever-image-upload-preview { display: block; width: 100%; max-height: 360px; margin: 0 !important; object-fit: contain; border-radius: 10px; }
  .edgeever-image-upload-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 10px; border-radius: 10px; background: rgba(15, 23, 42, 0.38); color: #fff; font-size: 14px; font-weight: 600; text-shadow: 0 1px 2px rgba(15, 23, 42, 0.45); }
  .edgeever-image-upload-spinner { width: 18px; height: 18px; border: 2px solid ${theme === "dark" ? "#475569" : "#cbd5e1"}; border-top-color: #0f766e; border-radius: 999px; animation: edgeever-image-upload-spin 0.8s linear infinite; }
  @keyframes edgeever-image-upload-spin { to { transform: rotate(360deg); } }
  .edgeever-editor-content hr { margin: 24px 0; border: 0; border-top: 1px solid #cbd5e1; }
`;
