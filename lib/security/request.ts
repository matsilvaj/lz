import "server-only";

type JsonResult<T> =
  | {
      data: T;
      response: null;
    }
  | {
      data: null;
      response: Response;
    };

function parseContentLength(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export async function readLimitedJson<T>(
  request: Request,
  {
    maxBytes,
  }: {
    maxBytes: number;
  },
): Promise<JsonResult<T>> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

  if (!contentType.includes("application/json")) {
    return {
      data: null,
      response: Response.json({ error: "unsupported_media_type" }, { status: 415 }),
    };
  }

  const contentLength = parseContentLength(request.headers.get("content-length"));

  if (contentLength !== null && contentLength > maxBytes) {
    return {
      data: null,
      response: Response.json({ error: "payload_too_large" }, { status: 413 }),
    };
  }

  const body = await request.text();
  const bodyBytes = new TextEncoder().encode(body).byteLength;

  if (bodyBytes > maxBytes) {
    return {
      data: null,
      response: Response.json({ error: "payload_too_large" }, { status: 413 }),
    };
  }

  try {
    return {
      data: JSON.parse(body) as T,
      response: null,
    };
  } catch {
    return {
      data: null,
      response: Response.json({ error: "invalid_json" }, { status: 400 }),
    };
  }
}
