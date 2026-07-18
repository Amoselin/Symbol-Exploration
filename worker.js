/**
 * 符號陪伴 - Cloudflare Worker 代理
 * 用途：把前端網頁的請求轉發給 Anthropic API，金鑰只存在這裡，不會暴露給瀏覽器。
 *
 * 部署步驟：
 * 1. 到 https://dash.cloudflare.com 註冊/登入（免費方案即可）
 * 2. 左側選單 Workers & Pages -> Create -> Create Worker
 * 3. 把這個檔案的內容整個貼進編輯器，取代預設程式碼，按 Deploy
 * 4. 到這個 Worker 的 Settings -> Variables and Secrets -> Add
 *    - 新增一個 Secret，名稱填 ANTHROPIC_API_KEY，值填你在 console.anthropic.com 拿到的金鑰（sk-ant-開頭）
 *    - 存好後記得重新 Deploy 一次
 * 5. 把下面 ALLOWED_ORIGIN 改成你 GitHub Pages 網站的網址
 *    （例如 https://你的帳號.github.io，注意不要有結尾斜線）
 * 6. Deploy 完成後，Worker 會給你一個網址，例如：
 *    https://symbol-companion.你的帳號.workers.dev
 *    把這個網址填到前端 HTML 裡的 WORKER_URL 常數。
 */

const ALLOWED_ORIGIN = "https://你的帳號.github.io"; // 換成你自己的 GitHub Pages 網址

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export default {
  async fetch(request, env) {
    // 瀏覽器送出正式請求前的預檢請求
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(ALLOWED_ORIGIN) });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: { message: "只接受 POST 請求" } }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders(ALLOWED_ORIGIN) },
      });
    }

    if (!env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: { message: "Worker 尚未設定 ANTHROPIC_API_KEY，請到 Settings -> Variables and Secrets 新增。" } }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders(ALLOWED_ORIGIN) } }
      );
    }

    try {
      const incomingBody = await request.text();

      const upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: incomingBody,
      });

      const upstreamText = await upstream.text();

      return new Response(upstreamText, {
        status: upstream.status,
        headers: { "Content-Type": "application/json", ...corsHeaders(ALLOWED_ORIGIN) },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: { message: err.message } }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders(ALLOWED_ORIGIN) },
      });
    }
  },
};
