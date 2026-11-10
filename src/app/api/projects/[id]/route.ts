import { fail } from "@/lib/http";
import { NextResponse } from "next/server";
import { storeOps } from "@/lib/store";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return (await storeOps.removeProject((await params).id))
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: "Projet introuvable ou non supprimable." }, { status: 404 });
  } catch (e) {
    return fail(e);
  }
}
