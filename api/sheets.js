// api/sheets.js
// Vercel Serverless Function
// Google Sheetsのタブ一覧とCSVをサーバー側で取得してフロントに返す
// CORSを迂回できるのでブラウザから直接fetchする必要がなくなる

export default async function handler(req, res) {
  // CORS設定（自分のドメインのみ許可する場合はoriginを変更）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { sheetId } = req.query;
  if (!sheetId) {
    return res.status(400).json({ error: 'sheetId is required' });
  }

  // スプレッドシートのHTML（シート一覧ページ）からgid一覧を取得
  let gids = [];
  try {
    const htmlRes = await fetch(
      `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (htmlRes.ok) {
      const html = await htmlRes.text();
      const matches = [...html.matchAll(/"sheetId":(\d+)/g)];
      gids = [...new Set(matches.map(m => m[1]))];
    }
  } catch (e) {
    console.error('HTML fetch error:', e);
  }

  // HTMLから取れなかった場合は 0〜9 を試す
  if (!gids.length) {
    gids = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  }

  // 各gidのCSVを取得
  const tabs = [];
  for (const gid of gids) {
    if (tabs.length >= 5) break;
    try {
      const csvRes = await fetch(
        `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
      );
      if (!csvRes.ok) continue;
      const csv = await csvRes.text();
      if (csv.trim().length > 10 && !csv.trim().startsWith('<!')) {
        tabs.push({ gid, csv });
      }
    } catch (e) {
      continue;
    }
  }

  if (!tabs.length) {
    return res.status(500).json({
      error: 'シートのデータを取得できませんでした。公開設定を確認してください。'
    });
  }

  return res.status(200).json({ sheetId, tabs });
}
