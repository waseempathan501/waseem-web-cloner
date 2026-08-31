const axios = require('axios');
const cheerio = require('cheerio');
const JSZip = require('jszip');

const REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

const FETCH_TIMEOUT = 6000;
const MAX_ASSETS_PER_TYPE = 12;
const MAX_ASSET_SIZE = 1_500_000; // ~1.5MB per asset guard

function normalizeUrl(input) {
  let u = input.trim();
  if (!/^https?:\/\//i.test(u)) {
    u = 'https://' + u;
  }
  return u;
}

function safeFileName(url, index, fallbackExt) {
  try {
    const parsed = new URL(url);
    let name = parsed.pathname.split('/').filter(Boolean).pop() || `asset-${index}`;
    if (!name.includes('.')) name += fallbackExt;
    // strip query-string style characters that sometimes leak into names
    name = name.split('?')[0].replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${index}-${name}`;
  } catch {
    return `${index}-asset${fallbackExt}`;
  }
}

async function fetchText(url) {
  const res = await axios.get(url, {
    headers: REQUEST_HEADERS,
    timeout: FETCH_TIMEOUT,
    maxContentLength: MAX_ASSET_SIZE,
    validateStatus: (s) => s < 500,
  });
  return typeof res.data === 'string' ? res.data : String(res.data);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Only POST requests are supported.' });
    return;
  }

  const { url } = req.body || {};

  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'Please provide a website URL.' });
    return;
  }

  const targetUrl = normalizeUrl(url);

  let html;
  try {
    html = await fetchText(targetUrl);
  } catch (err) {
    res.status(422).json({
      error:
        'Could not reach that website. Check the URL, or the site may be blocking automated requests.',
    });
    return;
  }

  const $ = cheerio.load(html);

  // Collect stylesheet and script asset URLs
  const cssLinks = [];
  $('link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) cssLinks.push(href);
  });

  const jsLinks = [];
  $('script[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (src) jsLinks.push(src);
  });

  const resolvedCss = cssLinks
    .slice(0, MAX_ASSETS_PER_TYPE)
    .map((href) => {
      try {
        return new URL(href, targetUrl).toString();
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const resolvedJs = jsLinks
    .slice(0, MAX_ASSETS_PER_TYPE)
    .map((src) => {
      try {
        return new URL(src, targetUrl).toString();
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const [cssResults, jsResults] = await Promise.all([
    Promise.allSettled(resolvedCss.map((u) => fetchText(u))),
    Promise.allSettled(resolvedJs.map((u) => fetchText(u))),
  ]);

  const zip = new JSZip();
  const cssFolder = zip.folder('css');
  const jsFolder = zip.folder('js');

  const cssFiles = [];
  cssResults.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      const fileName = safeFileName(resolvedCss[i], i, '.css');
      cssFolder.file(fileName, result.value);
      cssFiles.push({ name: fileName, sourceUrl: resolvedCss[i] });
    }
  });

  const jsFiles = [];
  jsResults.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      const fileName = safeFileName(resolvedJs[i], i, '.js');
      jsFolder.file(fileName, result.value);
      jsFiles.push({ name: fileName, sourceUrl: resolvedJs[i] });
    }
  });

  // Build a local copy of the HTML with fixed-up references to the downloaded files
  const $local = cheerio.load(html);
  $local('link[rel="stylesheet"]').each((i, el) => {
    if (cssFiles[i]) $local(el).attr('href', `css/${cssFiles[i].name}`);
  });
  $local('script[src]').each((i, el) => {
    if (jsFiles[i]) $local(el).attr('src', `js/${jsFiles[i].name}`);
  });

  const localHtml = $local.html();
  zip.file('index.html', localHtml);
  zip.file(
    'source-info.txt',
    `Source: ${targetUrl}\nCopied with Web Copier By Waseem\n`
  );

  let zipBase64;
  try {
    zipBase64 = await zip.generateAsync({ type: 'base64' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to package the cloned files into a ZIP.' });
    return;
  }

  res.status(200).json({
    sourceUrl: targetUrl,
    html,
    cssCount: cssFiles.length,
    jsCount: jsFiles.length,
    zipBase64,
  });
};
