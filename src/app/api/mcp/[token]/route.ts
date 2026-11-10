import { serve } from "@/lib/mcp";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

// Jeton dans l'adresse : pour les clients qui ne permettent pas d'en-tête.
const handler = async (req: Request, { params }: Ctx) => serve(req, (await params).token);
export { handler as DELETE, handler as GET, handler as POST };
