"use client";

import { Children, isValidElement, type MouseEvent, type PointerEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function AutoScrollCarousel({
  children,
  label,
  previousLabel,
  nextLabel,
  interval = 2800,
  itemsPerView = 4,
  forceLoop = false,
  autoplayPaused = false,
}: {
  children: ReactNode;
  label: string;
  previousLabel: string;
  nextLabel: string;
  interval?: number;
  itemsPerView?: 3 | 4 | 5 | 6;
  forceLoop?: boolean;
  autoplayPaused?: boolean;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, native: false, pointerId: -1, startX: 0, lastX: 0, startY: 0, scrollLeft: 0, moved: false });
  const captureRef = useRef<Element | null>(null);
  const nativeGestureUntilRef = useRef(0);
  const scrollIdleTimerRef = useRef<number | undefined>(undefined);
  const suppressClickUntilRef = useRef(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [touching, setTouching] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [startIndex, setStartIndex] = useState(0);
  const [rotation, setRotation] = useState({ sequence: 0, direction: 1, animated: false });
  const items = Children.toArray(children);
  const offset = items.length ? startIndex % items.length : 0;
  const indexedItems = items.map((item, index) => ({ item, index }));
  const orderedItems = indexedItems.slice(offset).concat(indexedItems.slice(0, offset));
  const canNavigate = items.length > 1 && (hasOverflow || forceLoop);
  const paused = hovered || focused || dragging || touching || scrolling || hidden || autoplayPaused;

  useEffect(() => () => {
    window.clearTimeout(scrollIdleTimerRef.current);
    const pointerId = dragRef.current.pointerId;
    dragRef.current.active = false;
    const capture = captureRef.current;
    captureRef.current = null;
    if (capture?.hasPointerCapture(pointerId)) capture.releasePointerCapture(pointerId);
    viewportRef.current?.classList.remove("is-dragging");
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const measure = () => setHasOverflow(items.length > 1 && viewport.scrollWidth - viewport.clientWidth > 2);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    viewport.querySelectorAll(".auto-carousel-item").forEach((item) => observer.observe(item));
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [items.length, itemsPerView, forceLoop]);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(preference.matches);
    const updateVisibility = () => setHidden(document.hidden);
    updateMotion();
    updateVisibility();
    preference.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => { preference.removeEventListener("change", updateMotion); document.removeEventListener("visibilitychange", updateVisibility); };
  }, []);

  const move = useCallback((direction: -1 | 1) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    if (maxScroll <= 2) {
      if (forceLoop && items.length > 1) {
        setStartIndex((current) => (current + direction + items.length) % items.length);
        setRotation((current) => ({ sequence: current.sequence + 1, direction, animated: !reducedMotion }));
      }
      return;
    }
    const firstItem = viewport.querySelector<HTMLElement>(".auto-carousel-item");
    const styles = window.getComputedStyle(viewport);
    const gap = Number.parseFloat(styles.columnGap || styles.gap || "0") || 0;
    const step = (firstItem?.getBoundingClientRect().width || viewport.clientWidth * 0.8) + gap;
    const behavior = reducedMotion ? "auto" : "smooth";
    if (direction > 0 && viewport.scrollLeft >= maxScroll - 4) {
      viewport.scrollTo({ left: 0, behavior });
      return;
    }
    if (direction < 0 && viewport.scrollLeft <= 4) {
      viewport.scrollTo({ left: maxScroll, behavior });
      return;
    }
    viewport.scrollBy({ left: direction * step, behavior });
  }, [forceLoop, items.length, reducedMotion]);

  useEffect(() => {
    if (paused || !canNavigate || reducedMotion) return;
    const timer = window.setInterval(() => move(1), Math.max(1000, interval));
    return () => window.clearInterval(timer);
  }, [interval, canNavigate, move, paused, reducedMotion]);

  function beginDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const viewport = viewportRef.current;
    if (!viewport || !canNavigate || dragRef.current.active) return;
    if ((event.target as Element).closest("input, textarea, select, summary")) return;
    viewport.scrollTo({ left: viewport.scrollLeft, behavior: "auto" });
    // Let touch/pen panning stay with the browser when there is real scroll space.
    const native = event.pointerType !== "mouse" && viewport.scrollWidth - viewport.clientWidth > 2;
    dragRef.current = { active: true, native, pointerId: event.pointerId, startX: event.clientX, lastX: event.clientX, startY: event.clientY, scrollLeft: viewport.scrollLeft, moved: false };
    nativeGestureUntilRef.current = 0;
    if (!native) {
      // Capture the original button/link so an ordinary click keeps its target,
      // while fast mouse drags outside the card cannot end before the threshold.
      const control = (event.target as Element).closest("button, a");
      captureRef.current = control || viewport;
      captureRef.current.setPointerCapture(event.pointerId);
    }
    setDragging(true);
  }

  function drag(event: PointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;
    if (!viewport || !dragRef.current.active || dragRef.current.pointerId !== event.pointerId) return;
    const dx = event.clientX - dragRef.current.startX;
    dragRef.current.lastX = event.clientX;
    const dy = event.clientY - dragRef.current.startY;
    if (dragRef.current.native) {
      if (Math.abs(dx) >= 8 && Math.abs(dx) > Math.abs(dy)) dragRef.current.moved = true;
      return;
    }
    if (!dragRef.current.moved && Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
      endDrag(event);
      return;
    }
    if (!dragRef.current.moved && Math.abs(dx) >= 8) {
      dragRef.current.moved = true;
      captureRef.current = viewport;
      viewport.setPointerCapture(event.pointerId);
      viewport.classList.add("is-dragging");
    }
    if (dragRef.current.moved) {
      event.preventDefault();
      if (viewport.scrollWidth - viewport.clientWidth > 2) viewport.scrollLeft = dragRef.current.scrollLeft - dx;
    }
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;
    if (!viewport || !dragRef.current.active || dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current.active = false;
    setDragging(false);
    if (dragRef.current.native) {
      // pointercancel is normal when native scrolling takes over. Momentum is
      // tracked by onScroll, so autoplay does not resume during a finger swipe.
      if (dragRef.current.moved || event.type === "pointercancel") nativeGestureUntilRef.current = Date.now() + 400;
      if (dragRef.current.moved) suppressClickUntilRef.current = Date.now() + 400;
      return;
    }
    const capture = captureRef.current;
    captureRef.current = null;
    if (dragRef.current.moved) {
      viewport.classList.remove("is-dragging");
      suppressClickUntilRef.current = Date.now() + 400;
      const deltaX = dragRef.current.lastX - dragRef.current.startX;
      if (!hasOverflow && event.type !== "pointercancel" && Math.abs(deltaX) >= 32) move(deltaX < 0 ? 1 : -1);
      event.preventDefault();
    }
    if (capture?.hasPointerCapture(event.pointerId)) capture.releasePointerCapture(event.pointerId);
  }

  function scrollViewport() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    setScrolling(true);
    window.clearTimeout(scrollIdleTimerRef.current);
    scrollIdleTimerRef.current = window.setTimeout(() => setScrolling(false), 220);
    const gesture = dragRef.current;
    if (gesture.native && (gesture.active || Date.now() < nativeGestureUntilRef.current) && Math.abs(viewport.scrollLeft - gesture.scrollLeft) > 2) {
      gesture.moved = true;
      nativeGestureUntilRef.current = Date.now() + 400;
      suppressClickUntilRef.current = Date.now() + 400;
    }
  }

  function suppressDragClick(event: MouseEvent<HTMLDivElement>) {
    if (event.detail > 0 && Date.now() < suppressClickUntilRef.current) {
      suppressClickUntilRef.current = 0;
      event.preventDefault();
      event.stopPropagation();
    }
  }

  return (
    <div
      className={`auto-carousel items-${itemsPerView}${forceLoop ? " is-force-loop" : ""}${rotation.animated && !hasOverflow && !reducedMotion ? " is-rotating" : ""}`}
      data-item-count={items.length}
      data-scrollable={hasOverflow}
      data-rotation={rotation.sequence % 2}
      data-rotation-direction={rotation.direction}
      data-autoplay-paused={paused || reducedMotion}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(true); }}
      onPointerLeave={(event) => { if (event.pointerType === "mouse") setHovered(false); }}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}
    >
      {canNavigate && <button className="auto-carousel-arrow is-previous" type="button" aria-label={previousLabel} onClick={() => move(-1)}>
        <ChevronLeft size={23} />
      </button>}
      <div
        className="auto-carousel-viewport"
        ref={viewportRef}
        tabIndex={canNavigate ? 0 : undefined}
        onAnimationEnd={(event) => { if (event.target === event.currentTarget) setRotation((current) => ({ ...current, animated: false })); }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
          event.preventDefault();
          move(event.key === "ArrowLeft" ? -1 : 1);
        }}
        onPointerDown={beginDrag}
        onPointerMove={drag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={(event) => { if (event.target === captureRef.current) endDrag(event); }}
        onTouchStart={() => setTouching(true)}
        onTouchEnd={(event) => { if (event.touches.length === 0) setTouching(false); }}
        onTouchCancel={() => setTouching(false)}
        onScroll={scrollViewport}
        onClickCapture={suppressDragClick}
        onDragStart={(event) => event.preventDefault()}
      >
        {orderedItems.map(({ item, index }) => <div className="auto-carousel-item" role="group" aria-roledescription="slide" aria-label={`${index + 1} / ${items.length}`} key={isValidElement(item) ? item.key ?? index : index}>{item}</div>)}
      </div>
      {canNavigate && <button className="auto-carousel-arrow is-next" type="button" aria-label={nextLabel} onClick={() => move(1)}>
        <ChevronRight size={23} />
      </button>}
    </div>
  );
}
