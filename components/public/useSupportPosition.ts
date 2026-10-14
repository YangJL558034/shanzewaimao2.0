"use client";

import { type KeyboardEvent, type MouseEvent, type PointerEvent, type RefObject, useEffect, useRef, useState } from "react";

type Position = { x: number; y: number };
type PositionOptions = { disabled: boolean; open: boolean; expanded: boolean; replyKey?: string };

/** Position is deliberately in memory: refresh restores the default right-side placement. */
export function useSupportPosition(supportRef: RefObject<HTMLDivElement | null>, { disabled, open, expanded, replyKey }: PositionOptions) {
  const position = useRef<Position>({ x: 0, y: 0 });
  const gesture = useRef({ active: false, pointerId: -1, clientX: 0, clientY: 0, startX: 0, startY: 0, moved: false });
  const gestureElement = useRef<HTMLDivElement | null>(null);
  const captureElement = useRef<Element | null>(null);
  const suppressClickUntil = useRef(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const cancel = () => {
      const element = gestureElement.current;
      const capture = captureElement.current;
      const pointerId = gesture.current.pointerId;
      gesture.current.active = false;
      gesture.current.moved = false;
      gesture.current.pointerId = -1;
      gestureElement.current = null;
      captureElement.current = null;
      element?.classList.remove("is-position-dragging");
      if (capture?.hasPointerCapture(pointerId)) capture.releasePointerCapture(pointerId);
      setDragging(false);
    };
    if (disabled) cancel();
    return cancel;
  }, [disabled]);

  function bounds() {
    const support = supportRef.current;
    if (!support) return null;
    const viewport = window.visualViewport;
    const visibleLeft = viewport?.offsetLeft || 0;
    const visibleTop = viewport?.offsetTop || 0;
    const visibleRight = visibleLeft + (viewport?.width || window.innerWidth);
    const visibleBottom = visibleTop + (viewport?.height || window.innerHeight);
    const computed = window.getComputedStyle(support);
    const transform = computed.transform === "none" ? { m41: 0, m42: 0 } : new DOMMatrixReadOnly(computed.transform);
    const rectangles = [support.getBoundingClientRect(), ...Array.from(support.children).map((child) => child.getBoundingClientRect())].filter((rectangle) => rectangle.width > 0 && rectangle.height > 0);
    const left = Math.min(...rectangles.map((rectangle) => rectangle.left)) - transform.m41;
    const right = Math.max(...rectangles.map((rectangle) => rectangle.right)) - transform.m41;
    const top = Math.min(...rectangles.map((rectangle) => rectangle.top)) - transform.m42;
    const bottom = Math.max(...rectangles.map((rectangle) => rectangle.bottom)) - transform.m42;
    const keyboard = Math.max(0, window.innerHeight - visibleBottom);
    const bottomSpacing = Math.max(12, (Number.parseFloat(computed.bottom) || 0) - keyboard);
    return { minX: visibleLeft + 12 - left, maxX: visibleRight - 12 - right, minY: visibleTop + 12 - top, maxY: visibleBottom - bottomSpacing - bottom };
  }

  function place(next: Position) {
    const support = supportRef.current;
    const limits = bounds();
    if (!support || !limits) return;
    const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(Math.max(minimum, maximum), value));
    position.current = { x: clamp(next.x, limits.minX, limits.maxX), y: clamp(next.y, limits.minY, limits.maxY) };
    support.style.setProperty("--customer-support-drag-x", `${position.current.x}px`);
    support.style.setProperty("--customer-support-drag-y", `${position.current.y}px`);
  }

  useEffect(() => {
    const support = supportRef.current;
    if (disabled || !support) return;
    const viewport = window.visualViewport;
    const update = () => {
      const visibleHeight = viewport?.height || window.innerHeight;
      const visibleBottom = (viewport?.offsetTop || 0) + visibleHeight;
      const keyboard = Math.max(0, window.innerHeight - visibleBottom);
      support.style.setProperty("--customer-support-visible-height", `${visibleHeight}px`);
      support.style.setProperty("--customer-support-visible-width", `${viewport?.width || window.innerWidth}px`);
      support.style.setProperty("--customer-support-keyboard-offset", `${keyboard}px`);
      support.style.setProperty("--customer-support-viewport-right-offset", `${Math.max(0, window.innerWidth - (viewport?.width || window.innerWidth) - (viewport?.offsetLeft || 0))}px`);
      const bottomSpacing = Math.max(12, (Number.parseFloat(window.getComputedStyle(support).bottom) || 0) - keyboard);
      support.style.setProperty("--customer-support-available-height", `${Math.max(48, visibleHeight - bottomSpacing - 12)}px`);
      place({ x: gesture.current.active ? position.current.x : 0, y: position.current.y });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(support);
    Array.from(support.children).forEach((child) => observer.observe(child));
    window.addEventListener("resize", update);
    window.addEventListener("customer-support-consent-change", update);
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("customer-support-consent-change", update);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
    };
  }, [disabled, open, expanded, replyKey, supportRef]);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (disabled || gesture.current.active || (event.pointerType === "mouse" && event.button !== 0)) return;
    // A fresh press is intentional; only suppress the click synthesized by the previous drag.
    suppressClickUntil.current = 0;
    const target = event.target as HTMLElement;
    const handle = target.closest(".customer-support-drag-handle");
    if (event.pointerType !== "mouse" && !handle) return;
    if (target.closest("input, textarea, select, summary, .customer-chat-body, .customer-reply-alert, [data-support-position-exclude]")) return;
    if (!handle && target.closest("a, button") && !target.closest(".customer-channel-item")) return;
    gestureElement.current = supportRef.current;
    gesture.current = { active: true, pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, startX: position.current.x, startY: position.current.y, moved: false };
    // Capture the original control immediately, preserving its normal click target
    // while fast pointer moves outside the grip still reach this component.
    captureElement.current = handle || target.closest(".customer-channel-item") || supportRef.current;
    captureElement.current?.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const support = supportRef.current;
    const current = gesture.current;
    if (!support || !current.active || current.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - current.clientX;
    const deltaY = event.clientY - current.clientY;
    if (!current.moved && Math.hypot(deltaX, deltaY) >= 6) {
      current.moved = true;
      captureElement.current = support;
      support.setPointerCapture(event.pointerId);
      support.classList.add("is-position-dragging");
      setDragging(true);
    }
    if (!current.moved) return;
    event.preventDefault();
    place({ x: current.startX + deltaX, y: current.startY + deltaY });
  }

  function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
    const support = gestureElement.current || supportRef.current;
    const current = gesture.current;
    if (!support || !current.active || current.pointerId !== event.pointerId) return;
    current.active = false;
    const capture = captureElement.current;
    captureElement.current = null;
    gestureElement.current = null;
    if (!current.moved) {
      if (capture?.hasPointerCapture(event.pointerId)) capture.releasePointerCapture(event.pointerId);
      return;
    }
    suppressClickUntil.current = Date.now() + 400;
    support.classList.remove("is-position-dragging");
    setDragging(false);
    // Read the final dragged rectangle before enabling the right-docking transition.
    support.getBoundingClientRect();
    place({ x: 0, y: position.current.y });
    if (capture?.hasPointerCapture(event.pointerId)) capture.releasePointerCapture(event.pointerId);
    event.preventDefault();
  }

  function onPointerCaptureLost(event: PointerEvent<HTMLDivElement>) {
    if (event.target === captureElement.current) onPointerEnd(event);
  }

  function onClickCapture(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("[data-support-position-exclude]")) return;
    if (event.detail > 0 && Date.now() < suppressClickUntil.current) {
      suppressClickUntil.current = 0;
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function onHandleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown" && event.key !== "Home") return;
    event.preventDefault();
    place({ x: 0, y: event.key === "Home" ? 0 : position.current.y + (event.key === "ArrowUp" ? -24 : 24) });
  }

  return { dragging, onPointerDown, onPointerMove, onPointerEnd, onPointerCaptureLost, onClickCapture, onHandleKeyDown };
}
