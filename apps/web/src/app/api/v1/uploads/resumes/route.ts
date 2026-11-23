import {MAX_RESUME_BYTES} from "@the-property-pillar/contracts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const responseHeaders = {"Cache-Control": "no-store"};
  if (Number(request.headers.get("content-length")) > MAX_RESUME_BYTES) {
    return Response.json({error: {code: "PAYLOAD_TOO_LARGE", message: "Choose a résumé file up to 10 MB."}}, {status: 413, headers: responseHeaders});
  }

  const backend = (process.env.API_PROXY_TARGET ?? "http://127.0.0.1:4000").replace(/\/+$/, "");
  const headers = new Headers();
  for (const key of ["content-type", "content-length", "content-encoding", "cookie", "origin", "referer"]) {
    const value = request.headers.get(key);
    if (value) headers.set(key, value);
  }

  // Stream the upload to Express. The general Next.js rewrite buffers and can truncate it.
  const options: RequestInit & {duplex: "half"} = {method: "POST", headers, body: request.body, duplex: "half", cache: "no-store", signal: request.signal};
  try {
    const result = await fetch(backend + "/api/v1/uploads/resumes", options);
    return new Response(result.body, {
      status: result.status,
      headers: {...responseHeaders, "Content-Type": result.headers.get("content-type") ?? "application/json"},
    });
  } catch {
    return Response.json({error: {code: "UPLOAD_UNAVAILABLE", message: "Résumé upload is temporarily unavailable. Try again."}}, {status: 502, headers: responseHeaders});
  }
}
