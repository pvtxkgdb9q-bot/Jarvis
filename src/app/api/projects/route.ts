import { fail } from "@/lib/http";
import { NextResponse } from "next/server";
import { storeOps } from "@/lib/store";
import type { ProjectInput } from "@/lib/types";

export async function POST(req: Request) {
  try {
    return NextResponse.json({ project: await storeOps.addProject((await req.json()) as ProjectInput) }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
