import { NextResponse } from "next/server";
import { fail } from "@/lib/http";
import { isPersistent, readState, status, storeOps } from "@/lib/store";
import type { NeuronInput } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [neurons, projects, state] = await Promise.all([storeOps.neurons(), storeOps.projects(), readState()]);
    return NextResponse.json({ neurons, projects, status: status(), state });
  } catch (e) {
    return NextResponse.json({ error: `Lecture de la mémoire impossible : ${(e as Error).message}` }, { status: 500 });
  }
}

export async function POST(req: Request) {
  // Sans stockage serveur, le navigateur garde le neurone en local (voir useBrain).
  if (!isPersistent()) return NextResponse.json({ error: "not_persistent" }, { status: 501 });
  try {
    return NextResponse.json({ neuron: await storeOps.add((await req.json()) as NeuronInput, "user") }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
