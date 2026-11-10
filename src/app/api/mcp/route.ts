import { serve } from "@/lib/mcp";

export const dynamic = "force-dynamic";

// Jeton dans l'en-tête « Authorization: Bearer … » : il n'apparaît pas dans l'adresse.
const handler = (req: Request) => serve(req, /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "")?.[1]?.trim());
export { handler as DELETE, handler as GET, handler as POST };
