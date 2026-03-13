const INDEX_URLS = [
  "https://www.mizuhobank.co.jp/takarakuji/check/numbers/index.html",
  "https://www.mizuhobank.co.jp/takarakuji/check/numbers/backnumber/index.html"
];

const PAGE_URL_PATTERN =
  /https:\/\/www\.mizuhobank\.co\.jp\/takarakuji\/check\/numbers\/backnumber\/num\d{4}\.html|\/takarakuji\/check\/numbers\/backnumber\/num\d{4}\.html/g;

const FALLBACK_PAGE_URLS = [
  6921,
  6901,
  6881,
  6861,
  6841,
  6821,
  6801
].map(
  (drawNo) =>
    `https://www.mizuhobank.co.jp/takarakuji/check/numbers/backnumber/num${drawNo}.html`
);

const stripHtml = (value) =>
  value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const normalizePageUrl = (value) => {
  if (value.startsWith("http")) return value;
  return `https://www.mizuhobank.co.jp${value}`;
};

const extractPageUrls = (html) => {
  const matches = html.match(PAGE_URL_PATTERN) ?? [];
  return Array.from(
    new Set(
      matches
        .map(normalizePageUrl)
        .filter((value) => value.endsWith(".html"))
    )
  ).sort((a, b) => b.localeCompare(a, "en"));
};

const parseNumbersPage = (html) => {
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  const parsed = [];

  for (const row of rows) {
    const cells = Array.from(row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)).map(
      (match) => stripHtml(match[1])
    );
    if (cells.length < 4) continue;

    const drawMatch = cells[0].match(/第\s*(\d+)\s*回/);
    const numbers3Match = cells.find((cell) => /^\d{3}$/.test(cell));
    const numbers4Match = cells.find((cell) => /^\d{4}$/.test(cell));

    if (!drawMatch || !numbers3Match || !numbers4Match) continue;

    parsed.push({
      drawNo: Number.parseInt(drawMatch[1], 10),
      drawDate: cells[1] ?? "",
      numbers3: numbers3Match.split("").map((digit) => Number.parseInt(digit, 10)),
      numbers4: numbers4Match.split("").map((digit) => Number.parseInt(digit, 10))
    });
  }

  return parsed;
};

exports.handler = async (event) => {
  try {
    const requestedLimit = Number.parseInt(
      event.queryStringParameters?.limit ?? "120",
      10
    );
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 20), 200)
      : 120;

    const discoveredUrls = new Set();
    for (const indexUrl of INDEX_URLS) {
      const response = await fetch(indexUrl, {
        headers: {
          "user-agent": "tensaikun"
        }
      });
      if (!response.ok) continue;
      const html = await response.text();
      extractPageUrls(html).forEach((url) => discoveredUrls.add(url));
    }

    const pageUrls = Array.from(
      new Set([...Array.from(discoveredUrls), ...FALLBACK_PAGE_URLS])
    ).sort((a, b) => b.localeCompare(a, "en"));

    if (pageUrls.length === 0) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "No backnumber pages found." })
      };
    }

    const allRows = [];
    const seenDrawNos = new Set();

    for (const pageUrl of pageUrls.slice(0, 8)) {
      const response = await fetch(pageUrl, {
        headers: {
          "user-agent": "tensaikun"
        }
      });
      if (!response.ok) continue;

      const html = await response.text();
      const rows = parseNumbersPage(html);
      for (const row of rows) {
        if (seenDrawNos.has(row.drawNo)) continue;
        seenDrawNos.add(row.drawNo);
        allRows.push(row);
      }
      if (allRows.length >= limit) break;
    }

    allRows.sort((a, b) => b.drawNo - a.drawNo);

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=300"
      },
      body: JSON.stringify(allRows.slice(0, limit))
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Unexpected error." })
    };
  }
};
