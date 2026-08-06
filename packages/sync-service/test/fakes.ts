export type RecordedCall = { url: string; method: string; body: string };

export type FakeRoute = {
  match: (url: string, method: string, body: string) => boolean;
  respond: (url: string, method: string, body: string) => Response;
};

export function makeFakeFetch(routes: FakeRoute[]): {
  fetchImpl: typeof fetch;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const req = new Request(input, init);
    const body = await req.clone().text();
    const call = { url: req.url, method: req.method, body };
    calls.push(call);
    for (const r of routes) {
      if (r.match(req.url, req.method, body)) return r.respond(req.url, req.method, body);
    }
    throw new Error(`fake fetch: unmatched ${req.method} ${req.url}`);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
