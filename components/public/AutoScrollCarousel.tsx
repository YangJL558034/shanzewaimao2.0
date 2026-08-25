"use client";

import { Children, type PointerEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function AutoScrollCarousel({
  children,
  label,
  previousLabel,
  nextLabel,
  interval = 2800,
  itemsPerView = 4,
}: {
  children: ReactNode;
  label: string;
  previousLabel: string;
  nextLabel: string;
  interval?: number;
  itemsPerView?: 4 | 5 | 6;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, startX: 0, scrollLeft: 0 });
  const [paused, setPaused] = useState(false);
  const items = Children.toArray(children);
  const hasOverflow = items.length > itemsPerView;

  const move = useCallback((direction: -1 | 1) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const firstItem = viewport.querySelector<HTMLElement>(".auto-carousel-item");
    const styles = window.getComputedStyle(viewport);
    const gap = Number.parseFloat(styles.columnGap || styles.gap || "0");
    const step = (firstItem?.getBoundingClientRect().width || viewport.clientWidth * 0.8) + gap;
    const maxScroll = viewport.scrollWidth - viewport.clientWidth;
    if (direction > 0 && viewport.scrollLeft >= maxScroll - 4) {
      viewport.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }
    if (direction < 0 && viewport.scrollLeft <= 4) {
      viewport.scrollTo({ left: maxScroll, behavior: "smooth" });
      return;
    }
    viewport.scrollBy({ left: direction * step, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (paused || items.length <= itemsPerView || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => move(1), interval);
    return () => window.clearInterval(timer);
  }, [interval, items.length, itemsPerView, move, paused]);

  function beginDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    dragRef.current = { active: true, startX: event.clientX, scrollLeft: viewport.scrollLeft };
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add("is-dragging");
    setPaused(true);
  }

  function drag(event: PointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;
    if (!viewport || !dragRef.current.active) return;
    viewport.scrollLeft = dragRef.current.scrollLeft - (event.clientX - dragRef.current.startX);
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;
    if (!viewport || !dragRef.current.active) return;
    dragRef.current.active = false;
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    viewport.classList.remove("is-dragging");
    setPaused(false);
  }

  return (
    <div
      className={`auto-carousel items-${itemsPerView}`}
      role="region"
      aria-label={label}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {hasOverflow && <button className="auto-carousel-arrow is-previous" type="button" aria-label={previousLabel} onClick={() => move(-1)}>
        <ChevronLeft size={23} />
      </button>}
      <div
        className="auto-carousel-viewport"
        ref={viewportRef}
        onPointerDown={beginDrag}
        onPointerMove={drag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {items.map((item, index) => <div className="auto-carousel-item" key={index}>{item}</div>)}
      </div>
      {hasOverflow && <button className="auto-carousel-arrow is-next" type="button" aria-label={nextLabel} onClick={() => move(1)}>
        <ChevronRight size={23} />
      </button>}
    </div>
  );
}
