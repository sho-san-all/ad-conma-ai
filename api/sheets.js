// api/sheets.js
// Vercel Serverless Function
// Google Sheetsのタブ一覧とCSVをサーバー側で取得してフロントに返す

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { sheetId } = req.query;
  if (!sheetId) {
    return res.status(400).json({ error: 'sheetId is required' });
  }

  let gids = [];

  // Step 1: /edit HTMLから複数パターンでgidを探す
  try {
    const htmlRes = await fetch(
      `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (htmlRes.ok) {
      const html = await htmlRes.text();
      const found = new Set();
      for (const m of html.matchAll(/"sheetId":(\d+)/g)) found.add(m[1]);
      for (const m of html.matchAll(/data-id="(\d+)"/g)) found.add(m[1]);
      for (const m of html.matchAll(/"gid":(\d+)/g)) found.add(m[1]);
      gids = [...found];
    }
  } catch {}

  // Step 2: /pubhtml からgid=XXXXXパターンで探す（公開済みシート向け）
  if (!gids.length) {
    try {
      const htmlRes = await fetch(
        `https://docs.google.com/spreadsheets/d/${sheetId}/pubhtml`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      );
      if (htmlRes.ok) {
        const html = await htmlRes.text();
        const found = new Set();
        for (const m of html.matchAll(/[?#&]gid=(\d+)/g)) found.add(m[1]);
        gids = [...found];
      }
    } catch {}
  }

  // Step 3: gid=0〜9 で試す（フォールバック）
  if (!gids.length) {
    gids = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  }

  // 各gidのCSVを取得（最大5タブ・失敗でも止まらない）
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
    } catch {}
  }

  // Step 1/2でgidが見つかったが3タブ未満の場合、0〜4で補完
  if (tabs.length > 0 && tabs.length < 3) {
    for (const gid of ['0', '1', '2', '3', '4']) {
      if (tabs.length >= 5) break;
      if (tabs.find(t => t.gid === String(gid))) continue;
      try {
        const csvRes = await fetch(
          `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
        );
        if (!csvRes.ok) continue;
        const csv = await csvRes.text();
        if (csv.trim().length > 10 && !csv.trim().startsWith('<!')) {
          tabs.push({ gid, csv });
        }
      } catch {}
    }
  }

  if (!tabs.length) {
    return res.status(500).json({
      error: 'シートのデータを取得できませんでした。スプレッドシートの共有設定（リンクを知っている全員が閲覧可）を確認してください。'
    });
  }

  return res.status(200).json({ sheetId, tabs });
}
