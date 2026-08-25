import { NextResponse } from "next/server";
import { statfs } from "fs/promises";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

export const runtime="nodejs";
export async function GET(){const auth=await requireApiUser("settings.read");if("error" in auth)return auth.error;const started=Date.now();await db.$queryRaw`SELECT 1`;const disk=await statfs(process.cwd()).catch(()=>null);return NextResponse.json({status:"healthy",database:"connected",databaseLatencyMs:Date.now()-started,node:process.version,environment:process.env.NODE_ENV,uptimeSeconds:Math.round(process.uptime()),memory:process.memoryUsage(),disk:disk?{free:disk.bavail*disk.bsize,total:disk.blocks*disk.bsize}:null,timestamp:new Date().toISOString()});}
