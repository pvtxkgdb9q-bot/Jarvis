import { fail } from "@/lib/http";
import { NextResponse } from "next/server";
import { importState } from "@/lib/store";

// Fusionne une sauvegarde (ou la mémoire d'un navigateur) dans le stockage.
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { state?: unknown };
    const state = await importState(body.state ?? body);
    return NextResponse.json({ ok: true, neurons: state.neurons.length });
  } catch (e) {
    return fail(e);
  }
}
