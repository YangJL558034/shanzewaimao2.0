import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { contentDisposition } from "@/lib/security";
export const runtime="nodejs";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){const auth=await requireApiUser("inquiries.read");if("error" in auth)return auth.error;const {id}=await params;const file=await db.inquiryAttachment.findUnique({where:{id}});if(!file)return NextResponse.json({error:"Not found"},{status:404});try{const body=await readFile(file.path);return new NextResponse(new Uint8Array(body),{headers:{"content-type":file.mimeType,"content-disposition":contentDisposition(file.fileName),"x-content-type-options":"nosniff"}})}catch{return NextResponse.json({error:"File missing"},{status:404})}}
