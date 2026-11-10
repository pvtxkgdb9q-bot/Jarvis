import { NextResponse } from "next/server";
import { PROJECTS } from "@/lib/seed";
import { addNeuron, allNeurons, isPersistent, status } from "@/lib/store";
import type { NeuronInput } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ neurons: await allNeurons(), projects: PROJECTS, status: status() });
  } catch (e) {
    return NextResponse.json({ error: `Lecture de la mémoire impossible : ${(e as Error).message}` }, { status: 500 });
  }
}

export async function POST(req: Request) {
  // Sans stockage serveur, le navigateur garde le neurone en local (voir useBrain).
  if (!isPersistent()) return NextResponse.json({ error: "not_persistent" }, { status: 501 });
  try {
    const input = (await req.json()) as NeuronInput;
    return NextResponse.json({ neuron: await addNeuron(input, "user") }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
