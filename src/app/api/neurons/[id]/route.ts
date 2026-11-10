import { NextResponse } from "next/server";
import { isPersistent, patchNeuron, removeNeuron } from "@/lib/store";
import type { NeuronInput } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  if (!isPersistent()) return NextResponse.json({ error: "not_persistent" }, { status: 501 });
  const { id } = await params;
  const neuron = await patchNeuron(id, (await req.json()) as NeuronInput);
  return neuron ? NextResponse.json({ neuron }) : NextResponse.json({ error: "Neurone introuvable." }, { status: 404 });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  if (!isPersistent()) return NextResponse.json({ error: "not_persistent" }, { status: 501 });
  const { id } = await params;
  return (await removeNeuron(id))
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Neurone introuvable." }, { status: 404 });
}
