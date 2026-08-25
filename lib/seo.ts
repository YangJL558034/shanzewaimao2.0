import "server-only";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { absoluteUrl } from "@/lib/utils";

export async function getSeoMetadata(route:string,fallback:{title:string;description:string}):Promise<Metadata>{const seo=await db.seoMeta.findUnique({where:{route}}).catch(()=>null);const title=seo?.title||fallback.title;const description=seo?.description||fallback.description;return {title,description,keywords:seo?.keywords||undefined,alternates:{canonical:seo?.canonical||absoluteUrl(route)},robots:seo?.noIndex?{index:false,follow:false}:{index:true,follow:true},openGraph:{title,description,url:seo?.canonical||absoluteUrl(route),images:seo?.ogImage?[seo.ogImage]:[]},twitter:{card:"summary_large_image",title,description}}}
