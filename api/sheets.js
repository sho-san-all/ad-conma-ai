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

  // 手順1: Sheets API v4 でシート一覧を取得（最も確実）
  try {
    const apiRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?key=${process.env.GEMINI_API_KEY}&fields=sheets.properties`
    );
    if (apiRes.ok) {
      const json = await apiRes.json();
      if (Array.isArray(json.sheets) && json.sheets.length) {
        gids = json.sheets.map(s => String(s.properties && s.properties.sheetId != null ? s.properties.sheetId : 0));
      }
    }
  } catch (e) {
    console.error('Sheets API error:', e);
  }

  // 手順2: HTMLパース（/editページからgidを抽出）
  if (!gids.length) {
    try {
      const htmlRes = await fetch(
        `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      );
      if (htmlRes.ok) {
        const html = await htmlRes.text();
        const matches = [...html.matchAll(/"sheetId":(\d+)/g)];
        const found = [...new Set(matches.map(m => m[1]))];
        if (found.length) gids = found;
      }
    } catch (e) {
      console.error('HTML fetch error:', e);
    }
  }

  // gidが判明した場合はCSVを取得
  const tabs = [];
  const gidList = gids.length ? gids : ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  for (const gid of gidList.slice(0, 10)) {
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

  // 手順3: タブが3件未満の場合、gvizエンドポイントで日本語シート名を試す
  // （デフォルト名「シート1」「シート2」「シート3」でアクセス可能）
  if (tabs.length < 3) {
    for (let i = 1; i <= 3; i++) {
      if (tabs.length >= 3) break;
      const name = 'シート' + i;
      try {
        const csvRes = await fetch(
          'https://docs.google.com/spreadsheets/d/' + sheetId +
          '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(name)
        );
        if (!csvRes.ok) continue;
        const csv = await csvRes.text();
        const trimmed = csv.trim();
        // gvizはシート名が無効だと "google.visualization..." を返す
        if (trimmed.length > 10 && !trimmed.startsWith('<!') && !trimmed.startsWith('google')) {
          const isDup = tabs.some(t => t.csv.slice(0, 100) === csv.slice(0, 100));
          if (!isDup) tabs.push({ gid: 'n' + i, csv });
        }
      } catch (e) {
        continue;
      }
    }
  }

  if (!tabs.length) {
    return res.status(500).json({
      error: 'シートのデータを取得できませんでした。公開設定を確認してください。'
    });
  }

  return res.status(200).json({ sheetId, tabs });
}
