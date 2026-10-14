"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { SeoImage } from "@/components/public/SeoImage";
import { useImageSeo } from "@/components/public/ImageSeoProvider";
import { isOptimizedImagePath } from "@/lib/image-seo";
import { ExternalLink, Maximize2, X } from "lucide-react";
import { AutoScrollCarousel } from "@/components/public/AutoScrollCarousel";
import { resolveCertificateCategory } from "@/lib/certificate-categories";
import "./certificate-gallery.css";

export type CertificateDocument = {
  id: string;
  name: string;
  category?: string | null;
  issuer: string | null;
  certificateNo: string | null;
  image: string | null;
  fileUrl: string | null;
  expiresAt: string | null;
};

/** Document links may be root-relative or HTTPS, never protocol-relative or executable URLs. */
export function safeCertificateUrl(value: string | null | undefined) {
  const source = value?.trim() || "";
  if (!source || source.includes("\\") || /[\u0000-\u001f\u007f]/.test(source)) return "";
  if (source.startsWith("/") && !source.startsWith("//")) return source;
  try {
    const url = new URL(source);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : "";
  } catch { return ""; }
}

function documentIsOriginal(value: string) {
  if (!value) return false;
  try { return !new URL(value, "https://shanzesz.com").pathname.startsWith("/references/"); }
  catch { return false; }
}

export function CertificateGallery({ certificates, locale }: { certificates: CertificateDocument[]; locale: string; now: number }) {
  const zh = locale === "zh";
  const imageSeo = useImageSeo();
  const sourceAliases = useMemo(() => {
    const aliases = new Map<string, string>();
    for (const [source, metadata] of Object.entries(imageSeo)) {
      if (!isOptimizedImagePath(source) && !aliases.has(metadata.src)) aliases.set(metadata.src, source);
    }
    return aliases;
  }, [imageSeo]);
  const originalSource = (value?: string | null) => {
    if (!value) return "";
    let key = value.split(/[?#]/)[0];
    if (/^https?:\/\//i.test(value)) {
      try {
        const url = new URL(value);
        if (!["shanzesz.com", "www.shanzesz.com", "localhost", "127.0.0.1", "127.0.0.2", "192.168.0.208"].includes(url.hostname)) return value;
        key = url.pathname;
      } catch { return value; }
    }
    return sourceAliases.get(key) || key;
  };
  const isOriginalDocument = (value: string) => documentIsOriginal(originalSource(value));
  const [active, setActive] = useState<CertificateDocument | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const prepared = certificates.map((certificate) => ({
    ...certificate,
    image: safeCertificateUrl(certificate.image),
    fileUrl: safeCertificateUrl(certificate.fileUrl),
  }));
  const documents = prepared;
  const groups = [
    { key: "management", title: zh ? "管理体系认证资料" : "Management-System Documents", items: documents.filter((certificate) => resolveCertificateCategory(certificate.category, certificate.name) === "MANAGEMENT") },
    { key: "product", title: zh ? "产品报告与标识资料" : "Product Reports & Marking References", items: documents.filter((certificate) => resolveCertificateCategory(certificate.category, certificate.name) === "PRODUCT") },
  ].filter((group) => group.items.length > 0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!active || !dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    closeRef.current?.focus();
    const trigger = triggerRef.current;
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [active]);

  function preview(certificate: CertificateDocument, trigger: HTMLButtonElement) {
    triggerRef.current = trigger;
    setActive(certificate);
  }

  function details(certificate: CertificateDocument) {
    return <>
      {(certificate.issuer || certificate.certificateNo) && <dl className="certificate-document-fields">
        {certificate.issuer && <div><dt>{zh ? "出具机构 / 来源" : "Issuer / source"}</dt><dd>{certificate.issuer}</dd></div>}
        {certificate.certificateNo && <div><dt>{zh ? "证书 / 报告编号" : "Certificate / report no."}</dt><dd>{certificate.certificateNo}</dd></div>}
      </dl>}
      {originalSource(certificate.image).includes("barryt-i4-pse-report.jpg") && <p className="certificate-document-note">{zh ? "资料来源：PSE 检测报告第 1 / 2 页。" : "Source: PSE test report, page 1 of 2."}</p>}
      {originalSource(certificate.image).includes("barryt-i4-3c-mark-qr") && <p className="certificate-document-note">{zh ? "3C 标识与查询码参考图。" : "3C mark and verification QR reference."}</p>}
    </>;
  }

  const originalUrl = active ? safeCertificateUrl(active.fileUrl) || safeCertificateUrl(active.image) : "";
  return <div className="certificate-document-gallery">
    <p className="certificate-document-scope">{zh ? "按管理体系与产品型号分类展示，点击图片查看大图。" : "Browse management-system and model-specific documents. Select an image to view the original preview."}</p>
    {groups.map((group) => <section className="certificate-document-group" key={group.key} data-document-count={group.items.length}>
      <h3>{group.title}</h3>
      <AutoScrollCarousel label={group.title} previousLabel={zh ? "上一份资料" : "Previous document"} nextLabel={zh ? "下一份资料" : "Next document"} itemsPerView={4} forceLoop autoplayPaused={!!active}>
        {group.items.map((certificate) => <article className="card certificate-document-card" key={certificate.id}>
          {certificate.image && isOriginalDocument(certificate.image) ? <button type="button" className="certificate-document-preview" onClick={(event) => preview(certificate, event.currentTarget)} aria-label={`${zh ? "查看大图：" : "Preview document: "}${certificate.name}`}>
            <SeoImage src={certificate.image} alt={`${certificate.name} ${zh ? "资料原图预览" : "source document preview"}`} width="600" height="800" loading="lazy" sizes="(max-width: 640px) 86vw, (max-width: 960px) 50vw, 25vw" />
            <span><Maximize2 size={15} aria-hidden="true" />{zh ? "查看大图" : "Preview document"}</span>
          </button> : <div className="certificate-document-request"><span>{certificate.name.match(/\b(?:ISO\s*\d+|IATF\s*\d+|PSE|RoHS|FCC|CE|UN\s*38\.?3|3C)\b/i)?.[0] || certificate.name}</span><p>{zh ? "资料待补充" : "Document preview pending"}</p></div>}
          <div className="certificate-document-copy"><h4>{certificate.name}</h4>{details(certificate)}
            {(isOriginalDocument(certificate.fileUrl) || isOriginalDocument(certificate.image)) && <a href={isOriginalDocument(certificate.fileUrl) ? certificate.fileUrl : certificate.image} target="_blank" rel="noopener noreferrer" className="certificate-document-original">{zh ? "查看原始文件" : "View original"}<ExternalLink size={13} aria-hidden="true" /></a>}
          </div>
        </article>)}
      </AutoScrollCarousel>
    </section>)}
    {!groups.length && <p className="certificate-document-empty">{zh ? "请联系团队索取适用于您项目的资料。" : "Contact the team for documents relevant to your project."}</p>}

    <dialog ref={dialogRef} className="certificate-preview-dialog" aria-modal="true" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); setActive(null); }} onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setActive(null);
    }}>
      {active && <>
        <header className="certificate-preview-header"><h2 id={titleId}>{active.name}</h2><button ref={closeRef} type="button" onClick={() => setActive(null)} aria-label={zh ? "关闭资料预览" : "Close document preview"}><X size={22} /></button></header>
        <div className="certificate-preview-body"><SeoImage src={safeCertificateUrl(active.image)} alt={`${active.name} ${zh ? "资料原图" : "source document"}`} loading="eager" sizes="(max-width: 700px) 96vw, 80vw" />{details(active)}</div>
        <footer className="certificate-preview-footer"><p>{zh ? "完整技术资料请联系销售团队。" : "Contact our sales team for complete technical documentation."}</p>{originalUrl && <a href={originalUrl} target="_blank" rel="noopener noreferrer">{zh ? "查看原始文件" : "View original"}<ExternalLink size={15} aria-hidden="true" /></a>}</footer>
      </>}
    </dialog>
  </div>;
}
