import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight, BatteryCharging, CheckCircle2, Layers, Palette, PackageCheck, Sun, Usb } from "lucide-react";
import { SeoImage } from "@/components/public/SeoImage";
import { JsonLd } from "@/components/public/JsonLd";
import { getSeoMetadata } from "@/lib/seo";
import { getLocale } from "@/lib/i18n";
import { absoluteUrl } from "@/lib/utils";
import { product3dPath } from "@/lib/product-3d";
import "./portable-power.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return getSeoMetadata("/portable-power", {
    title: "BR Portable Power Station Series 30,000 / 80,000 mAh | Shanze OEM/ODM",
    description: "Explore the BR portable power series from Shanze: SZ68DBGB26 with a 4-cell pack, 100W DC output and DC input, and SZ68DBGB23 with a 2-cell pack and dual USB-C. Aluminium housings, LED work light and digital readout, with OEM/ODM customization.",
  });
}

type Finish = { id: string; zh: string; en: string; hex: string };

const finishes: Finish[] = [
  { id: "silver", zh: "镜面银", en: "Mirror Silver", hex: "#c8ced5" },
  { id: "emerald", zh: "祖母绿", en: "Emerald", hex: "#1c6b53" },
  { id: "copper", zh: "赤陶铜", en: "Terracotta Copper", hex: "#b9714f" },
  { id: "gold", zh: "沙漠金", en: "Desert Gold", hex: "#c8a26a" },
  { id: "olive", zh: "军橄榄绿", en: "Military Olive", hex: "#6c7046" },
  { id: "fjord", zh: "峡湾蓝", en: "Fjord Blue", hex: "#3d6c88" },
];

const models = [
  {
    sku: "SZ68DBGB26",
    capacity: "80,000 mAh",
    image: "/portable-power/hero-square.webp",
    width: 480,
    height: 262,
    copyZh: "立式方形机身，4 串磷酸铁锂电芯；正面双 USB-A、Type-C、DC5521 直流输出与 DC7909 直流输入，配圆形照明灯与数字电量屏。",
    copyEn: "Upright square housing with a four-cell series LiFePO₄ pack. Front panel: dual USB-A, Type-C, DC5521 DC output and DC7909 DC input, plus a round work light and digital readout.",
    finishes: ["silver", "emerald", "copper", "gold", "olive"],
  },
  {
    sku: "SZ68DBGB23",
    capacity: "30,000 mAh",
    image: "/portable-power/model-wide-copper.webp",
    width: 505,
    height: 242,
    copyZh: "宽扁机身降低重心，握持与摆放更稳；正面双 USB-A + 双 Type-C 接口、圆形照明灯与数字电量屏，配色选择更多。",
    copyEn: "Wide low-profile body for steadier handling. Front panel: dual USB-A and dual Type-C, round work light and digital readout, with a wider finish range.",
    finishes: ["silver", "copper", "fjord", "gold", "olive", "emerald"],
  },
] as const;

// Per-model comparison, taken from each datasheet. Every label and value carries
// both languages so the English page never shows Chinese (and vice versa).
type SpecText = string | [zh: string, en: string];
type SpecRow = { k: [zh: string, en: string]; a: SpecText; b: SpecText };

const specRows: SpecRow[] = [
  { k: ["型号", "Model"], a: "SZ68DBGB26", b: "SZ68DBGB23" },
  { k: ["产品名称", "Product name"], a: "40140-20A-4S-100W", b: "33140-15A-2S-22W" },
  { k: ["容量", "Capacity"], a: "80,000 mAh", b: "30,000 mAh" },
  { k: ["输出容量", "Rated output capacity"], a: "64,000 mAh · 5V/2A", b: "25,000 mAh · 5V/2A" },
  { k: ["电池类型", "Cell type"], a: ["磷酸铁锂 LiFePO₄ · 4S", "LiFePO₄ · 4S"], b: ["磷酸铁锂 LiFePO₄ · 2S", "LiFePO₄ · 2S"] },
  { k: ["输出 USB-A1", "USB-A1 output"], a: "5V/3A · 9V/2A · 12V/1.5A", b: "5V/3A · 9V/2A · 12V/1.5A" },
  { k: ["输出 USB-A2", "USB-A2 output"], a: "5V/2A", b: "5V/2A" },
  { k: ["输出 Type-C", "Type-C output"], a: ["PPS · 最高 65W", "PPS · max 65W"], b: ["双口 · 12V/1.67A", "Dual port · 12V/1.67A"] },
  { k: ["输出 DC5521", "DC5521 output"], a: ["12V/8A · 最高 100W", "12V/8A · max 100W"], b: "—" },
  { k: ["输入 DC7909", "DC7909 input"], a: ["20V/5A · 最高 100W", "20V/5A · max 100W"], b: "—" },
  { k: ["输入 Type-C", "Type-C input"], a: "5V/3A · 9V/2A · 12V/1.5A", b: "5V/3A · 9V/2A · 12V/1.5A" },
  { k: ["外壳", "Housing"], a: ["铝合金", "Aluminium alloy"], b: ["铝合金", "Aluminium alloy"] },
];

export default async function PortablePowerPage() {
  const locale = await getLocale();
  const zh = locale === "zh";
  const quoteHref = "/contact?product=br-portable-power#quote";

  const featurePoints = zh
    ? ["双 USB-A 输出，SZ68DBGB26 另有 Type-C、DC5521 与 DC7909", "SZ68DBGB26 的 DC5521 输出最高 100W，DC7909 输入最高 100W", "圆形 LED 照明灯，独立开关按键", "数字百分比电量屏，实时显示剩余电量"]
    : ["Dual USB-A output; SZ68DBGB26 adds Type-C, DC5521 and DC7909", "SZ68DBGB26 offers 100W DC output and 100W DC input", "Round LED work light on its own button", "Digital percentage readout for remaining charge"];

  // Each card embeds the offline 3D viewer in a stripped "rotation only" mode and
  // links to the full viewer for the details.
  const modelCards = models.map((model) => {
    const viewer = product3dPath(model.sku, locale);
    return { ...model, viewer, embed: viewer ? `${viewer}&embed=1` : "" };
  });

  const details = [
    {
      image: "/portable-power/detail-strap.webp",
      width: 356,
      height: 215,
      titleZh: "编织提带与金属圆扣",
      titleEn: "Woven strap & metal rings",
      copyZh: "高密度编织织带配合金属圆扣与铆钉，提拿时受力均匀，磨损点集中在可更换的五金件上。",
      copyEn: "A high-density woven strap with metal rings and rivets spreads the load evenly, keeping wear on the replaceable hardware.",
    },
    {
      image: "/portable-power/detail-aluminum.webp",
      width: 385,
      height: 215,
      titleZh: "铝合金机身细节",
      titleEn: "Aluminium body details",
      copyZh: "铝合金外壳配合喷砂与阳极氧化处理，边缘高光倒角，BR 标识激光雕刻在顶面。",
      copyEn: "Sandblasted, anodized aluminium shell with a polished chamfer along the edge; the BR mark is laser etched into the top face.",
    },
    {
      image: "/portable-power/model-wide-blue.webp",
      width: 245,
      height: 162,
      titleZh: "峡湾蓝配色",
      titleEn: "Fjord blue finish",
      copyZh: "SZ68DBGB23 的峡湾蓝为系列新增配色，阳极氧化层与铝合金基材结合，实机在不同角度下呈现深浅变化。",
      copyEn: "Fjord blue extends the SZ68DBGB23 palette; the anodized layer over the aluminium base shifts tone as the viewing angle changes.",
    },
  ] as const;

  return <>
    <JsonLd data={{
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: "Products", item: absoluteUrl("/products") },
        { "@type": "ListItem", position: 3, name: "BR Portable Power", item: absoluteUrl("/portable-power") },
      ],
    }} />
    <JsonLd data={{
      "@context": "https://schema.org",
      "@type": "ProductGroup",
      "@id": `${absoluteUrl("/portable-power")}#series`,
      name: "BR Portable Power Station Series",
      description: zh ? "山泽 BR 系列便携储能电源：SZ68DBGB26 为 80,000 mAh（4 电芯、100W 直流输出），SZ68DBGB23 为 30,000 mAh（2 电芯），铝合金机身，支持 OEM/ODM 定制。" : "Shanze BR portable power series: SZ68DBGB26 at 80,000 mAh (4 cells, 100W DC output) and SZ68DBGB23 at 30,000 mAh (2 cells). Aluminium housings, OEM/ODM customization.",
      brand: { "@type": "Brand", name: "Shanze" },
      url: absoluteUrl("/portable-power"),
      hasVariant: models.map((model) => ({
        "@type": "Product",
        name: `BR ${model.sku}`,
        sku: model.sku,
        url: absoluteUrl("/portable-power"),
      })),
    }} />

    <section className="pp-hero">
      <div className="container-site pp-hero-inner">
        <div>
          <p className="eyebrow">SHANZE · BR SERIES</p>
          <h1>
            {zh ? "便携储能电源" : "BR Portable Power"}
            <small>{zh ? "BR PORTABLE POWER" : "Portable energy storage"}</small>
          </h1>
          <p className="pp-hero-lead">
            {zh
              ? "山泽 BR 系列便携储能电源，铝合金机身搭配编织提带与金属圆扣。SZ68DBGB26 为 4 串电芯 80,000 mAh，带 DC5521 直流输出与 DC7909 直流输入；SZ68DBGB23 为 2 串电芯 30,000 mAh。两款正面均配双 USB-A、Type-C、圆形照明灯与数字电量屏。"
              : "The Shanze BR series pairs an aluminium body with a woven strap and metal rings. SZ68DBGB26 carries a four-cell 80,000 mAh pack with DC5521 output and DC7909 input; SZ68DBGB23 uses a two-cell 30,000 mAh pack. Both keep dual USB-A, Type-C, a round work light and a digital readout on the front panel."}
          </p>
          <p className="pp-capacity">
            {zh ? "系列容量" : "Series capacity"} <b>30,000 / 80,000 mAh</b>
          </p>
          <div className="pp-hero-actions">
            <Link href={quoteHref} className="btn btn-primary"><PackageCheck size={17} />{zh ? "获取报价" : "Request a Quote"}</Link>
            <Link href="#models" className="btn btn-outline">{zh ? "查看机型" : "Compare Models"}<ArrowRight size={16} /></Link>
          </div>
          <ul className="pp-hero-points">
            <li><Layers size={16} />{zh ? "铝合金机身" : "Aluminium housing"}</li>
            <li><Usb size={16} />{zh ? "双 USB-A + 双 USB-C" : "2 × USB-A + 2 × USB-C"}</li>
            <li><Sun size={16} />{zh ? "圆形 LED 照明" : "Round LED work light"}</li>
            <li><Palette size={16} />{zh ? "6 种配色" : "6 finishes"}</li>
          </ul>
        </div>
        <div className="pp-stage">
          <span className="pp-stage-tag">BR · SZ68DBGB24</span>
          <SeoImage
            src="/portable-power/hero-square.webp"
            width={480}
            height={262}
            sizes="(max-width: 980px) 92vw, 520px"
            priority
            alt={zh ? "山泽 BR 便携储能电源 SZ68DBGB26，祖母绿配色，正面排布 USB-A、USB-C、照明灯与电量屏" : "Shanze BR portable power station SZ68DBGB26 in emerald, front panel with USB-A, USB-C, work light and battery readout"}
          />
        </div>
      </div>
    </section>

    <section className="section" id="models">
      <div className="container-site">
        <div className="center-head">
          <p className="eyebrow">{zh ? "两款在售型号" : "Two Stock Models"}</p>
          <h2 className="section-title">{zh ? "两款在售型号，同一套接口逻辑" : "Two Stock Models, One Port Layout"}</h2>
          <p>{zh ? "按使用方式选择机身：SZ68DBGB26 立放稳固，4 电芯 80,000 mAh 并带直流输出；SZ68DBGB23 重心更低，2 电芯 30,000 mAh。两款共用双 USB-A、Type-C、照明灯与电量屏的正面布局。" : "Pick the body that matches how you carry and place it: SZ68DBGB26 stands tall with a four-cell 80,000 mAh pack and DC ports, SZ68DBGB23 sits lower with a two-cell 30,000 mAh pack. Both share the dual USB-A, Type-C, work light and readout layout."}</p>
        </div>
        <div className="pp-models">
          {modelCards.map((model) => (
            <article className="pp-model" key={model.sku}>
              <div className="pp-model-media pp-model-media-3d">
                {model.embed
                  ? <iframe
                      className="pp-model-3d"
                      src={model.embed}
                      title={zh ? `${model.sku} 三维模型` : `${model.sku} 3D model`}
                      loading="lazy"
                      scrolling="no"
                      tabIndex={-1}
                    />
                  : <SeoImage
                      src={model.image}
                      width={model.width}
                      height={model.height}
                      sizes="(max-width: 760px) 92vw, 520px"
                      alt={zh ? `山泽 BR 便携储能电源 ${model.sku}` : `Shanze BR portable power station ${model.sku}`}
                    />}
              </div>
              <div className="pp-model-body">
                <h3 className="pp-model-title">{model.sku}</h3>
                <p className="pp-model-capacity">{model.capacity}</p>
                <p>{zh ? model.copyZh : model.copyEn}</p>
                <div className="pp-finishes">
                  {model.finishes.map((id) => {
                    const finish = finishes.find((item) => item.id === id)!;
                    return <span className="pp-finish" key={`${model.sku}-${id}`}><i style={{ "--c": finish.hex } as CSSProperties} aria-hidden="true" />{zh ? finish.zh : finish.en}</span>;
                  })}
                </div>
                {model.viewer && <a className="btn btn-primary pp-model-cta" href={model.viewer}>{zh ? "查看详细" : "View details"}<ArrowRight size={16} /></a>}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>

    <section className="section section-soft">
      <div className="container-site pp-split">
        <div>
          <p className="eyebrow">{zh ? "接口与照明" : "Ports & Light"}</p>
          <h2 className="section-title">{zh ? "所有操作集中在正面一块面板" : "Everything Runs From One Front Panel"}</h2>
          <p className="muted">{zh ? "插电、看电量、开灯都在同一侧完成，装包或立放时不必翻动机身。" : "Charging, checking the battery and switching on the light all happen on the same face, so the unit never needs to be turned around."}</p>
          <ul className="pp-points">
            {featurePoints.map((point) => <li key={point}><CheckCircle2 size={16} />{point}</li>)}
          </ul>
        </div>
        <div className="pp-feature">
          <div className="pp-panel">
            <SeoImage
              src="/portable-power/panel-square.webp"
              width={356}
              height={231}
              sizes="(max-width: 760px) 92vw, 360px"
              alt={zh ? "SZ68DBGB26 正面接口面板：双 USB-A、Type-C、DC5521、DC7909、圆形照明灯与电量屏" : "SZ68DBGB26 front panel with dual USB-A, Type-C, DC5521, DC7909, round work light and readout"}
            />
            <h3>{zh ? "SZ68DBGB26 · 接口与照明" : "SZ68DBGB26 · ports & light"}</h3>
          </div>
          <div className="pp-panel">
            <SeoImage
              src="/portable-power/panel-wide.webp"
              width={385}
              height={231}
              sizes="(max-width: 760px) 92vw, 360px"
              alt={zh ? "SZ68DBGB23 正面接口面板：双 USB-A、双 USB-C、圆形照明灯与电量屏" : "SZ68DBGB23 front panel with dual USB-A, dual USB-C, round work light and battery readout"}
            />
            <h3>{zh ? "SZ68DBGB23 · 接口与照明" : "SZ68DBGB23 · ports & light"}</h3>
          </div>
        </div>
      </div>
    </section>

    <section className="section">
      <div className="container-site">
        <div className="center-head">
          <p className="eyebrow">{zh ? "工艺细节" : "Build Details"}</p>
          <h2 className="section-title">{zh ? "看得见的结构，也经得起摸" : "Details You Can See and Feel"}</h2>
        </div>
        <div className="pp-details">
          {details.map((detail) => (
            <article className="pp-detail" key={detail.image}>
              <SeoImage
                src={detail.image}
                width={detail.width}
                height={detail.height}
                sizes="(max-width: 760px) 92vw, 360px"
                alt={zh ? `山泽 BR 便携储能电源细节：${detail.titleZh}` : `Shanze BR portable power detail: ${detail.titleEn}`}
              />
              <div className="pp-detail-body">
                <h3>{zh ? detail.titleZh : detail.titleEn}</h3>
                <p>{zh ? detail.copyZh : detail.copyEn}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="pp-colors">
          <figure>
            <SeoImage
              src="/portable-power/colors-square.webp"
              width={766}
              height={124}
              sizes="(max-width: 760px) 92vw, 540px"
              alt={zh ? "SZ68DBGB26 五种配色：镜面银、祖母绿、赤陶铜、沙漠金、军橄榄绿" : "SZ68DBGB26 in five finishes: mirror silver, emerald, terracotta copper, desert gold, military olive"}
            />
            <figcaption>{zh ? "SZ68DBGB26 · 5 种配色" : "SZ68DBGB26 · 5 finishes"}</figcaption>
          </figure>
          <figure>
            <SeoImage
              src="/portable-power/colors-wide.webp"
              width={776}
              height={100}
              sizes="(max-width: 760px) 92vw, 540px"
              alt={zh ? "SZ68DBGB23 六种配色：镜面银、赤陶铜、峡湾蓝、沙漠金、军橄榄绿、祖母绿" : "SZ68DBGB23 in six finishes: mirror silver, terracotta copper, fjord blue, desert gold, military olive, emerald"}
            />
            <figcaption>{zh ? "SZ68DBGB23 · 6 种配色" : "SZ68DBGB23 · 6 finishes"}</figcaption>
          </figure>
        </div>
      </div>
    </section>

    <section className="section section-soft" id="specs">
      <div className="container-site">
        <div className="pp-split">
          <div>
            <p className="eyebrow">{zh ? "规格" : "Specifications"}</p>
            <h2 className="section-title">{zh ? "BR 系列规格一览" : "BR Series at a Glance"}</h2>
            <p className="muted">{zh ? "以下按型号逐项列出规格；认证文件与目标市场要求请与销售确认后提供。" : "Specifications are listed per model. Ask your sales contact for certification files and market-specific requirements."}</p>
            <p className="pp-note">{zh ? "需要样品、定制配色或包装方案？可直接提交询盘，我们会按目标市场整理规格与文件清单。" : "Need samples, custom finishes or packaging? Send an inquiry and we will prepare the specification and document list for your market."}</p>
          </div>
          <div className="pp-table-wrap">
          <table className="pp-specs pp-specs-compare">
            <thead>
              <tr><th scope="col">{zh ? "规格" : "Specification"}</th><th scope="col">SZ68DBGB26</th><th scope="col">SZ68DBGB23</th></tr>
            </thead>
            <tbody>
                {specRows.map((row) => (
                  <tr key={row.k[0]}>
                    <th scope="row">{zh ? row.k[0] : row.k[1]}</th>
                    <td>{Array.isArray(row.a) ? (zh ? row.a[0] : row.a[1]) : row.a}</td>
                    <td>{Array.isArray(row.b) ? (zh ? row.b[0] : row.b[1]) : row.b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="pp-inquiry">
          <div>
            <h3>{zh ? "支持定制您的移动电源" : "Custom power banks, built to your brief"}</h3>
            <p>{zh ? "多种型号欢迎您的咨询：容量、机身配色、丝印与包装均可按目标市场定制。" : "Multiple models are available. Capacity, finish, printing and packaging can all be tailored to your market."}</p>
          </div>
          <Link href={quoteHref} className="btn btn-primary">{zh ? "留言咨询" : "Send an inquiry"}<ArrowRight size={16} /></Link>
        </div>
      </div>
    </section>

    <section className="section">
      <div className="container-site">
        <div className="pp-cta">
          <div>
            <h2>{zh ? "把这个系列放进你的产品线" : "Add the BR Series to Your Line-up"}</h2>
            <p>{zh ? "支持容量、配色、丝印与包装定制，可按目标市场提供样品与认证资料。" : "Capacity, finish, print and packaging are customizable, with samples and compliance documents prepared for your market."}</p>
          </div>
          <Link href={quoteHref} className="btn"><BatteryCharging size={17} />{zh ? "获取报价" : "Request a Quote"}</Link>
        </div>
      </div>
    </section>
  </>;
}
