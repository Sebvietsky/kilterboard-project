// La ValidationPipe de NestJS renvoie `message: string[]` (une entrée par
// règle violée) ; les autres erreurs (401, 409…) renvoient une string.
// Ce helper normalise les deux formes en un message affichable.
export function extractApiErrorMessage(
  payload: unknown,
  fallback: string,
): string {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message: unknown }).message;
    if (Array.isArray(message)) return message.join("\n");
    if (typeof message === "string") return message;
  }
  return fallback;
}
