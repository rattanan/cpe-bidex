"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { getFormFieldMetadata } from "@/lib/form-field-metadata";

type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
let assistanceId = 0;

function controlForLabel(label: HTMLLabelElement) {
  if (label.htmlFor) {
    const associated = document.getElementById(label.htmlFor) as FormControl | null;
    if (associated) return associated;
  }
  return label.querySelector<FormControl>("input:not([type=hidden]), select, textarea")
    ?? label.closest(".field")?.querySelector<FormControl>("input:not([type=hidden]), select, textarea")
    ?? null;
}

function helpElement(control: FormControl, labelText: string, standalone = false) {
  const help = getFormFieldMetadata(control.name, labelText);
  assistanceId += 1;
  const helpId = `${control.id || control.name.replace(/[^a-zA-Z0-9_-]/g, "-")}-field-help-${assistanceId}`;
  const wrapper = document.createElement("span");
  wrapper.className = `field-help${standalone ? " field-help-standalone" : ""}`;
  wrapper.dataset.fieldHelp = "true";
  const trigger = document.createElement("span");
  trigger.className = "field-help-trigger";
  trigger.tabIndex = 0;
  trigger.setAttribute("role", "button");
  trigger.setAttribute("aria-label", `คำอธิบายฟิลด์ ${labelText}`);
  trigger.setAttribute("aria-describedby", helpId);
  trigger.textContent = "?";
  const tooltip = document.createElement("span");
  tooltip.className = "field-help-tooltip";
  tooltip.id = helpId;
  tooltip.setAttribute("role", "tooltip");
  const description = document.createElement("strong");
  description.textContent = help.description;
  const example = document.createElement("span");
  example.textContent = `ตัวอย่าง: ${help.example}`;
  tooltip.append(description, example);
  wrapper.append(trigger, tooltip);
  return wrapper;
}

function helpAnchorForLabel(label: HTMLLabelElement, labelText: string) {
  const existing = label.querySelector<HTMLElement>(":scope > [data-field-label-content], :scope > span:not(.required):not(.sr-only)");
  if (existing) {
    existing.classList.add("field-label-content");
    existing.dataset.fieldLabelContent = "true";
    label.classList.add("field-label-assisted");
    return existing;
  }
  const anchor = document.createElement("span");
  anchor.className = "field-label-content";
  anchor.dataset.fieldLabelContent = "true";
  anchor.textContent = labelText;
  const textNode = Array.from(label.childNodes).find((node) =>
    node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()),
  );
  if (textNode) textNode.replaceWith(anchor); else label.prepend(anchor);
  label.classList.add("field-label-assisted");
  return anchor;
}

function placeHelpAfterLabelText(label: HTMLLabelElement, labelText: string, help: HTMLElement) {
  helpAnchorForLabel(label, labelText).append(help);
}

function decorate(root: ParentNode) {
  root.querySelectorAll<HTMLLabelElement>("form label").forEach((label) => {
    if (label.closest(".field-help")) return;
    const control = controlForLabel(label);
    if (!control?.name || ["checkbox", "radio", "hidden"].includes(control.type)) return;
    const labelText = (label.querySelector(":scope > span:not(.required):not(.sr-only)")?.textContent ?? label.childNodes[0]?.textContent ?? control.name).replace("*", "").trim();
    if (label.dataset.fieldAssistance === "true") {
      const misplacedHelp = label.querySelector<HTMLElement>(":scope > .field-help[data-field-help='true']");
      if (misplacedHelp) placeHelpAfterLabelText(label, labelText, misplacedHelp);
      return;
    }
    placeHelpAfterLabelText(label, labelText, helpElement(control, labelText));
    label.dataset.fieldAssistance = "true";
    control.dataset.fieldAssistance = "true";
  });

  root.querySelectorAll<FormControl>("form input:not([type=hidden]):not([type=checkbox]):not([type=radio]), form select, form textarea").forEach((control) => {
    if (!control.name || control.dataset.fieldAssistance === "true") return;
    const labelText = control.getAttribute("aria-label") ?? control.getAttribute("placeholder") ?? control.name;
    const help = helpElement(control, labelText, true);
    const anchor = control.closest(".input-unit") ?? control;
    anchor.before(help);
    control.dataset.fieldAssistance = "true";
  });
}

export function FormFieldAssistance() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname.startsWith("/cpe")) return;
    decorate(document);
    const observer = new MutationObserver((entries) => entries.forEach((entry) => entry.addedNodes.forEach((node) => {
      if (node instanceof HTMLElement) decorate(node);
    })));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);
  return null;
}
