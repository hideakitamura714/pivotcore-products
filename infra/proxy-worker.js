/**
 * 本番リバースプロキシ Worker
 * --------------------------------------------------------------------------
 * 目的: www.pivotcore.jp/products* へのアクセスを Cloudflare Pages（製品ページ）へ
 *       透過的に転送する。これにより既存サイト（GitHub Pages）はそのまま残しつつ、
 *       /products/ 配下だけを Pages が提供する構成を実現する。
 *
 * 仕組み:
 *   - この Worker は wrangler.toml の routes で /products と /products/* のみに紐づく。
 *   - それ以外のパス（トップページや会社情報など）はこの Worker を経由せず、
 *     通常どおり既存オリジン（GitHub Pages）へ到達する。
 *   - build.js は出力を /products/ 配下にマウントしているため、パスは 1 対 1 で転送できる
 *     （リライト不要）。
 *
 * 設定（wrangler.toml の [vars]）:
 *   PAGES_HOST … 転送先 Pages 本番ホスト（例: pivotcore-products.pages.dev）
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 念のため /products 配下のみを受け付ける（ルート設定の保険）
    if (!(url.pathname === '/products' || url.pathname.startsWith('/products/'))) {
      return new Response('Not found', { status: 404 });
    }

    const pagesHost = env.PAGES_HOST;
    if (!pagesHost) {
      return new Response('Misconfigured: PAGES_HOST is not set', { status: 500 });
    }

    // パスはそのまま（/products/... を /products/... へ）転送
    const upstream = `https://${pagesHost}${url.pathname}${url.search}`;

    const method = request.method.toUpperCase();
    const init = {
      method,
      headers: request.headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : request.body,
      redirect: 'manual', // Pages 側の 3xx を書き換えずそのまま返す
    };

    let resp;
    try {
      resp = await fetch(upstream, init);
    } catch (e) {
      return new Response('Upstream fetch failed', { status: 502 });
    }

    // レスポンスは原則そのまま返す。
    // 必要に応じてヘッダを調整できるよう Headers を複製している。
    const headers = new Headers(resp.headers);
    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers,
    });
  },
};
