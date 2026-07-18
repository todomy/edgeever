'use dom';

import type { DOMProps } from "expo/dom";

type EditorRuntimePrewarmProps = {
  dom?: DOMProps;
};

// Mounting this tiny DOM component after the native workspace is interactive
// starts the platform WebView runtime without parsing the much larger TipTap
// editor bundle. The component stays mounted so the renderer remains warm for
// the first real editor opening.
export default function EditorRuntimePrewarm(_props: EditorRuntimePrewarmProps) {
  return null;
}
