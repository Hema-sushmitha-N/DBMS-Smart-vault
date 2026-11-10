import { NextResponse } from "next/server";
export function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function fail(error) {
  if (error.issues)
    return json(
      { error: error.issues[0]?.message || "Check the form values." },
      400,
    );
  const code = error.code;
  const message =
    code === "23503"
      ? "This record is referenced by other data. Update those references first."
      : code === "23505"
        ? "A record with these details already exists."
        : code === "23514"
          ? "The values violate a database validation rule."
          : code === "42501"
            ? "Your database role does not permit this action."
            : error.status
              ? error.message
              : code === "P0001"
                ? error.message
                : "The operation could not be completed. Please try again.";
  if (!error.status && !code) console.error(error);
  return json(
    { error: message },
    error.status || (code === "42501" ? 403 : code ? 400 : 500),
  );
}
export async function body(request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== process.env.APP_ORIGIN)
    throw Object.assign(Error("Request origin is not allowed."), {
      status: 403,
    });
  const raw = await request.text();
  if (raw.length > 32000)
    throw Object.assign(Error("Request is too large."), { status: 413 });
  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(Error("Invalid JSON body."), { status: 400 });
  }
}
