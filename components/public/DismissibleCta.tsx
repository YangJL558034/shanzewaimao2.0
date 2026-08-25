"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

const STORAGE_KEY = "enercore_public_cta_dismissed";

export function DismissibleCta({
  title,
  description,
  buttonLabel,
  buttonHref,
  closeLabel,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  buttonHref: string;
  closeLabel: string;
}) {
  const version = `${title}|${description}|${buttonLabel}|${buttonHref}`;
  const [hidden, setHidden] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(STORAGE_KEY) === version);
    } catch {
      setHidden(false);
    }
  }, [version]);

  function close() {
    try {
      window.localStorage.setItem(STORAGE_KEY, version);
    } catch {
      // The banner can still be closed when private browsing blocks storage.
    }
    setClosing(true);
    window.setTimeout(() => setHidden(true), 220);
  }

  if (hidden) return null;

  return (
    <section className={`cta-strip cta-dismissible${closing ? " is-closing" : ""}`} aria-label={title}>
      <button className="cta-close" type="button" onClick={close} aria-label={closeLabel} title={closeLabel}>
        <X size={20} strokeWidth={2.2} />
      </button>
      <div className="container-site cta-inner">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <Link className="btn" href={buttonHref}>
          {buttonLabel} →
        </Link>
      </div>
    </section>
  );
}
