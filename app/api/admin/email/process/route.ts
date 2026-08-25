import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { processEmailQueue } from "@/lib/email";
import { verifyCsrf } from "@/lib/security";

export async function POST(request: Request) {
  const cron=request.headers.get("x-cron-secret");
  if(!cron||cron!==process.env.EMAIL_CRON_SECRET){const auth=await requireApiUser("email.write");if("error" in auth)return auth.error;if(!(await verifyCsrf(request)))return NextResponse.json({error:"Invalid CSRF token"},{status:403});}
  return NextResponse.json(await processEmailQueue(25));
}
