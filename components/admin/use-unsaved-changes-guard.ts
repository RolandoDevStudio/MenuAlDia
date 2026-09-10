"use client";

import { useEffect, useRef } from "react";

export const UNSAVED_LEAVE_MESSAGE =
  "Tienes cambios sin guardar. Si sales ahora, se perderán.\n\n¿Salir sin guardar?";

export function joinSpanish(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} y ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

export function unsavedLeaveMessage(sectionLabels: string[]): string {
  if (sectionLabels.length === 0) return UNSAVED_LEAVE_MESSAGE;
  return `Tienes cambios sin guardar en ${joinSpanish(sectionLabels)}. Si sales ahora, se perderán.\n\n¿Salir sin guardar?`;
}

export function confirmUnsavedLeave(message = UNSAVED_LEAVE_MESSAGE): boolean {
  return window.confirm(message);
}

/** Warns before leaving the page (tabs, links, close/reload) while `dirty`. */
export function useUnsavedChangesGuard(dirty: boolean, message?: string) {
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const messageRef = useRef(message ?? UNSAVED_LEAVE_MESSAGE);
  messageRef.current = message ?? UNSAVED_LEAVE_MESSAGE;

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    const onClick = (event: MouseEvent) => {
      if (!dirtyRef.current) return;
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) return;

      const leaveControl = target.closest("[data-unsaved-guard='leave']");
      if (leaveControl) {
        if (!confirmUnsavedLeave(messageRef.current)) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
        }
        return;
      }

      const anchor = target.closest("a");
      if (!anchor) return;
      if (anchor.getAttribute("target") === "_blank") return;
      if (anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("javascript:")
      ) {
        return;
      }

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }
      if (!confirmUnsavedLeave(messageRef.current)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, []);
}
