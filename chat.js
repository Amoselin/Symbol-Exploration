/**
 * 符號陪伴 - Vercel Serverless Function
 * 路徑：/api/chat
 * 用途：接收前端請求，帶上存在環境變數裡的 API 金鑰，轉發給 Anthropic API。
 *
 * 部署後記得到 Vercel 專案的 Settings -> Environment Variables
 * 新增 ANTHROPIC_API_KEY，值填 console.anthropic.com 拿到的金鑰（sk-ant-開頭）。
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: { message: "只接受 POST 請求" } });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: {
        message:
          "尚未設定 ANTHROPIC_API_KEY 環境變數，請到 Vercel 專案 Settings -> Environment Variables 新增後重新部署。",
      },
    });
    return;
  }

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });

    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
}
