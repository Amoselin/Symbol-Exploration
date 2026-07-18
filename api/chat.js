/**
 * 符號陪伴 - Vercel Serverless Function（Gemini 版）
 * 路徑：/api/chat
 *
 * 前端完全不用改，因為這支 function 會：
 * 1. 把前端送來的 Anthropic 風格請求（system + messages），轉成 Gemini 要的格式
 * 2. 呼叫 Gemini API
 * 3. 把 Gemini 的回覆，轉回前端原本認得的格式（{ content: [{ type:"text", text:"..." }] }）
 *
 * 部署後記得到 Vercel 專案的 Settings -> Environment Variables
 * 新增 GEMINI_API_KEY，值填 aistudio.google.com 拿到的金鑰。
 */

const MODEL = "gemini-2.5-flash"; // 有免費額度、速度快，適合這個用途

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: { message: "只接受 POST 請求" } });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: {
        message:
          "尚未設定 GEMINI_API_KEY 環境變數，請到 Vercel 專案 Settings -> Environment Variables 新增後重新部署。",
      },
    });
    return;
  }

  try {
    const { system, messages } = req.body || {};

    // 把前端的 messages（role: "user" / "assistant"）轉成 Gemini 的 contents（role: "user" / "model"）
    const contents = (messages || []).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content ?? "") }],
    }));

    const geminiBody = {
      contents,
      ...(system ? { system_instruction: { parts: [{ text: system }] } } : {}),
      generationConfig: {
        maxOutputTokens: (req.body && req.body.max_tokens) || 1000,
      },
    };

    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(geminiBody),
      }
    );

    const data = await upstream.json();

    if (!upstream.ok) {
      res.status(upstream.status).json({
        error: { message: (data && data.error && data.error.message) || `HTTP ${upstream.status}` },
      });
      return;
    }

    // 把 Gemini 的回覆格式，轉回前端認得的 Anthropic 風格格式
    const candidate = data.candidates && data.candidates[0];
    const parts = (candidate && candidate.content && candidate.content.parts) || [];
    const text = parts.map((p) => p.text || "").join("\n").trim();

    if (!text) {
      res.status(500).json({ error: { message: "Gemini 回應中沒有文字內容（可能被安全機制擋下）" } });
      return;
    }

    res.status(200).json({ content: [{ type: "text", text }] });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
}
