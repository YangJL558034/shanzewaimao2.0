import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { getLocale, translateEntity } from "@/lib/i18n";

export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;const post=await db.news.findUnique({where:{slug}});return post?{title:post.title,description:post.excerpt}:{};}
export default async function NewsDetail({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const rawPost=await db.news.findFirst({where:{slug,status:"PUBLISHED"},include:{category:true}});if(!rawPost)notFound();const locale=await getLocale();const [post,category]=await Promise.all([translateEntity("News",rawPost,["title","excerpt","content"],locale),translateEntity("NewsCategory",rawPost.category,["name"],locale)]);return <article className="section"><div className="container-site max-w-4xl"><div className="eyebrow">{category.name} · {formatDate(post.publishedAt)}</div><h1 className="hero-title !text-5xl">{post.title}</h1><p className="hero-subtitle">{post.excerpt}</p><div className="image-window my-8" style={{"--crop-image":`url(${post.coverImage||"/references/news.png"})`,"--crop-position":"center -310px"} as React.CSSProperties}/><div className="prose prose-slate max-w-none whitespace-pre-line text-slate-700">{post.content}</div></div></article>;}
