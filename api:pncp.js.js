// api/pncp.js — Proxy do SONNAR IA para o PNCP (Elite Ar Soluções)
// Roda no servidor da Vercel, onde não existe bloqueio de CORS.
// Segurança: só aceita URLs do pncp.gov.br (não vira proxy aberto).
// JSON é repassado direto; PDF (edital) volta em base64 no campo _pdfBase64.

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.query.url;
  if (!url || !/^https:\/\/pncp\.gov\.br\//i.test(url)) {
    return res.status(400).json({ error: 'Apenas URLs do pncp.gov.br são permitidas' });
  }

  try {
    const r = await fetch(url, { headers: { accept: '*/*' }, redirect: 'follow' });

    // 204 = consulta vazia no PNCP → devolve página vazia padronizada
    if (r.status === 204) {
      return res.status(200).json({ data: [], totalRegistros: 0, totalPaginas: 0 });
    }

    const contentType = r.headers.get('content-type') || '';
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');

    // JSON e texto: repassa como veio
    if (contentType.includes('json') || contentType.includes('text/')) {
      const txt = await r.text();
      res.setHeader('Content-Type', contentType || 'application/json');
      return res.status(r.status).send(txt);
    }

    // Binário (PDF do edital): devolve em base64 para o app ler com a IA
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 3 * 1024 * 1024) {
      return res.status(413).json({ error: 'Arquivo maior que 3MB — abrir direto no PNCP' });
    }
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      _pdfBase64: buf.toString('base64'),
      _contentType: contentType,
      _tamanho: buf.length
    });
  } catch (e) {
    return res.status(502).json({ error: 'Falha ao acessar o PNCP: ' + String((e && e.message) || e) });
  }
};
