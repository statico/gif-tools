// Content negotiation for agents: a request that explicitly prefers
// text/markdown gets the .md mirror of the page instead of the HTML.
// Everything else falls straight through to the static asset, and any failure
// here falls through too — this must never be able to take the site down.
export async function onRequest(context) {
  try {
    const accept = context.request.headers.get("accept") || "";
    const url = new URL(context.request.url);
    const wantsMarkdown = /text\/markdown/.test(accept) && !/text\/html/.test(accept);

    if (wantsMarkdown && !url.pathname.endsWith(".md")) {
      // /text-emoji/ -> /text-emoji.md, / -> /index.md
      const slug = url.pathname.replace(/^\/|\/$/g, "");
      const mirror = new URL(`/${slug || "index"}.md`, url);
      const res = await context.env.ASSETS.fetch(new Request(mirror, context.request));
      if (res.ok) {
        const headers = new Headers(res.headers);
        headers.set("Content-Type", "text/markdown; charset=utf-8");
        headers.set("Link", `<${url.href}>; rel="canonical"`);
        headers.set("Vary", "Accept");
        return new Response(res.body, { status: 200, headers });
      }
    }
  } catch {
    /* fall through to the static asset */
  }
  return context.next();
}
