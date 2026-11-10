import { NextResponse } from "next/server";
import { NotPersistentError } from "./store.ts";

/** Réponse d'erreur commune aux routes d'écriture. */
export function fail(e: unknown) {
  if (e instanceof NotPersistentError) return NextResponse.json({ error: "not_persistent" }, { status: 501 });
  return NextResponse.json({ error: (e as Error).message }, { status: 400 });
}
