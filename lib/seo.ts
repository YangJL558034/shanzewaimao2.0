import "server-only";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { absoluteUrl } from "@/lib/utils";

export async function getSeoMetadata(route:string,fallback:{title:string;description:string}):Promise<Metadata>{
  const seo=await db.seoMeta.findUnique({where:{route}}).catch(()=>null);
  const title=seo?.title||fallback.title;
  const description=seo?.description||fallback.description;
  const configuredCanonical=seo?.canonical&&!/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(seo.canonical)?seo.canonical:null;
  const canonical=configuredCanonical||absoluteUrl(route);
  const ogTitle=seo?.ogTitle||title;
  const ogDescription=seo?.ogDescription||description;
  const socialImage=seo?.ogImage?absoluteUrl(seo.ogImage):absoluteUrl("/references/home.png");
  return {title:{absolute:title},description,keywords:seo?.keywords||undefined,alternates:{canonical},robots:seo?.noIndex?{index:false,follow:false}:{index:true,follow:true},openGraph:{title:ogTitle,description:ogDescription,url:canonical,images:[socialImage]},twitter:{card:"summary_large_image",title:ogTitle,description:ogDescription,images:[socialImage]}};
}
