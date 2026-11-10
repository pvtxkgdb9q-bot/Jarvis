import { fail } from "@/lib/http";
import { NextResponse } from "next/server";
import { storeOps } from "@/lib/store";
import type { NeuronInput } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const neuron = await storeOps.patch((await params).id, (await req.json()) as NeuronInput);
    return neuron ? NextResponse.json({ neuron }) : NextResponse.json({ error: "Neurone introuvable." }, { status: 404 });
  } catch (e) {
    return fail(e);
  }
}

// Supprime un neurone ajouté, ou retire l'annotation d'un neurone de la base fixe.
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    return (await storeOps.remove((await params).id))
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: "Neurone introuvable." }, { status: 404 });
  } catch (e) {
    return fail(e);
  }
}
