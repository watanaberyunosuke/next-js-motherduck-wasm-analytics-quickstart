export async function fetchMotherDuckToken(read_scaling: boolean = false): Promise<string> {
  const url = `/api/md-token?read_scaling=${read_scaling}`;
  const response = await fetch(url, { cache: "no-store" });

  const contentType = response.headers.get("content-type") || "";
  const raw = await response.text(); // read once, always

  if (!response.ok) {
    // This will show you the real server error (often 500 with JSON or HTML)
    throw new Error(`md-token failed: ${response.status} ${response.statusText} body=${raw.slice(0, 500)}`);
  }

  if (!contentType.includes("application/json")) {
    throw new Error(`md-token returned non-JSON: content-type=${contentType} body=${raw.slice(0, 500)}`);
  }

  if (!raw.trim()) {
    throw new Error(`md-token returned empty body with status ${response.status}`);
  }

  const parsed = JSON.parse(raw) as { mdToken?: string; error?: string };

  if (parsed.error) {
    throw new Error(`md-token error: ${parsed.error}`);
  }

  const mdToken = String(parsed.mdToken ?? "").trim();
  if (mdToken.split(".").length !== 3) {
    throw new Error(`Invalid mdToken format (not JWT): head=${mdToken.slice(0, 20)}`);
  }

  return mdToken;
}
