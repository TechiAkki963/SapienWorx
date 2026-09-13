"use client";

import { useEffect } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function inferAutocomplete(input: HTMLInputElement) {
  const label = input.closest("label")?.textContent?.toLowerCase() ?? "";
  const aria = input.getAttribute("aria-label")?.toLowerCase() ?? "";
  const hint = `${label} ${aria} ${input.placeholder?.toLowerCase() ?? ""}`;

  if (/verification code|one-time|otp|six-digit|recovery code/.test(hint)) return "one-time-code";
  if (input.type === "email" || /email/.test(hint)) return "email";
  if (input.type === "tel" || /mobile|phone/.test(hint)) return "tel";
  if (/first name/.test(hint)) return "given-name";
  if (/last name|surname/.test(hint)) return "family-name";
  if (/full name/.test(hint)) return "name";
  if (/company|organisation|organization/.test(hint)) return "organization";
  if (/designation|job title/.test(hint)) return "organization-title";
  if (/\bcity\b/.test(hint)) return "address-level2";
  if (/\bstate\b/.test(hint)) return "address-level1";
  if (input.type === "password") {
    return /new password|create password|confirm password|set a secure password|re-enter/.test(hint)
      ? "new-password"
      : "current-password";
  }
  return null;
}

function enhanceInput(input: HTMLInputElement) {
  if (!input.closest(".auth-page")) return;

  let autocomplete = input.getAttribute("autocomplete") ?? "";
  if (!autocomplete) {
    const inferred = inferAutocomplete(input);
    if (inferred) {
      input.setAttribute("autocomplete", inferred);
      autocomplete = inferred;
    }
  }

  if (!input.name && autocomplete && autocomplete !== "off") {
    input.name = autocomplete.replace(/\s+/g, "-");
  }
}

function enhanceAuthSemantics(root: ParentNode = document) {
  if (root instanceof HTMLInputElement) enhanceInput(root);
  root.querySelectorAll<HTMLInputElement>(".auth-page input").forEach(enhanceInput);

  const otpGroups = root instanceof HTMLElement && root.matches(".otp-inputs")
    ? [root]
    : [...root.querySelectorAll<HTMLElement>(".otp-inputs")];

  otpGroups.forEach((group) => {
    const otpInputs = [...group.querySelectorAll<HTMLInputElement>("input")];
    otpInputs.forEach((input, index) => {
      input.setAttribute("autocomplete", index === 0 ? "one-time-code" : "off");
      if (!input.name && index === 0) input.name = "one-time-code";
    });
  });
}

function modalBranch(dialog: HTMLElement) {
  const siblings = new Set<HTMLElement>();
  let node: HTMLElement | null = dialog;

  while (node?.parentElement) {
    const parentElement: HTMLElement = node.parentElement;
    [...parentElement.children].forEach((child) => {
      if (child !== node && child instanceof HTMLElement) siblings.add(child);
    });
    if (parentElement === document.body) break;
    node = parentElement;
  }

  return [...siblings];
}

export function InteractionAccessibility() {
  useEffect(() => {
    enhanceAuthSemantics();

    const semanticObserver = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) enhanceAuthSemantics(node);
        });
      }
    });
    semanticObserver.observe(document.body, { subtree: true, childList: true });

    let activeDialog: HTMLElement | null = null;
    let previousFocus: HTMLElement | null = null;
    let inerted: Array<{ element: HTMLElement; inert: boolean; ariaHidden: string | null }> = [];

    const restoreBackground = () => {
      inerted.forEach(({ element, inert, ariaHidden }) => {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      });
      inerted = [];
      activeDialog = null;
      previousFocus?.focus({ preventScroll: true });
      previousFocus = null;
    };

    const activateDialog = (dialog: HTMLElement) => {
      if (activeDialog === dialog) return;
      if (activeDialog) restoreBackground();

      activeDialog = dialog;
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (!dialog.hasAttribute("tabindex")) dialog.tabIndex = -1;

      inerted = modalBranch(dialog).map((element) => ({
        element,
        inert: element.inert,
        ariaHidden: element.getAttribute("aria-hidden"),
      }));
      inerted.forEach(({ element }) => {
        element.inert = true;
        element.setAttribute("aria-hidden", "true");
      });

      window.requestAnimationFrame(() => {
        if (!document.contains(dialog)) return;
        if (!dialog.contains(document.activeElement)) {
          const first = dialog.querySelector<HTMLElement>(FOCUSABLE);
          (first ?? dialog).focus({ preventScroll: true });
        }
      });
    };

    const syncDialog = () => {
      const next = document.querySelector<HTMLElement>("[role='dialog'][aria-modal='true']");
      if (next) activateDialog(next);
      else if (activeDialog) restoreBackground();
    };

    const dialogObserver = new MutationObserver(syncDialog);
    dialogObserver.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-modal", "hidden"] });
    syncDialog();

    const onKeyDown = (event: KeyboardEvent) => {
      if (!activeDialog) return;

      if (event.key === "Escape") {
        const cancel = [...activeDialog.querySelectorAll<HTMLButtonElement>("button")].find((button) => /cancel|close|dismiss|back/i.test(button.textContent ?? ""));
        if (cancel) {
          event.preventDefault();
          cancel.click();
        }
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = [...activeDialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => !element.hasAttribute("disabled") && element.getClientRects().length > 0);
      if (!focusable.length) {
        event.preventDefault();
        activeDialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      semanticObserver.disconnect();
      dialogObserver.disconnect();
      document.removeEventListener("keydown", onKeyDown, true);
      if (activeDialog) restoreBackground();
    };
  }, []);

  return null;
}
