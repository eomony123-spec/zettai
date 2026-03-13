const CSV_URLS = {
  numbers3: process.env.PAYPAY_NUMBERS3_CSV_URL,
  numbers4: process.env.PAYPAY_NUMBERS4_CSV_URL
};

const parseCsvRow = (line) => {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
};

const normalizeHeader = (value) => value.replace(/\s+/g, "").toLowerCase();

const findColumnIndex = (header, predicates) => {
  for (let index = 0; index < header.length; index += 1) {
    if (predicates.some((predicate) => predicate(header[index]))) {
      return index;
    }
  }
  return -1;
};

const parseDrawNo = (value) => {
  const match = String(value).match(/(\d+)/);
  return match ? Number.parseInt(match[1], 10) : null;
};

const parseDigits = (value, length) => {
  const normalized = String(value).replace(/\D/g, "");
  if (normalized.length !== length) return null;
  return normalized.split("").map((digit) => Number.parseInt(digit, 10));
};

const parsePayPayCsv = (text, digitsLength, keyName) => {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const header = parseCsvRow(lines[0]).map(normalizeHeader);
  const drawNoIndex = findColumnIndex(header, [
    (value) => value.includes("回") || value.includes("draw")
  ]);
  const dateIndex = findColumnIndex(header, [
    (value) => value.includes("日") || value.includes("date")
  ]);
  const numberIndex = findColumnIndex(header, [
    (value) => value.includes("当せん番号"),
    (value) => value.includes("当選番号"),
    (value) => value.includes("抽せん番号"),
    (value) => value.includes("抽選番号"),
    (value) => value.includes("番号")
  ]);

  const rows = [];
  for (const line of lines.slice(1)) {
    const cells = parseCsvRow(line);
    const drawNo = drawNoIndex >= 0 ? parseDrawNo(cells[drawNoIndex]) : parseDrawNo(cells[0]);
    const digits = numberIndex >= 0
      ? parseDigits(cells[numberIndex], digitsLength)
      : cells.map((cell) => parseDigits(cell, digitsLength)).find(Boolean) ?? null;

    if (!drawNo || !digits) continue;

    rows.push({
      drawNo,
      drawDate: dateIndex >= 0 ? cells[dateIndex] ?? "" : "",
      [keyName]: digits
    });
  }

  return rows;
};

exports.handler = async (event) => {
  try {
    const requestedLimit = Number.parseInt(event.queryStringParameters?.limit ?? "120", 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 20), 200)
      : 120;

    if (!CSV_URLS.numbers3 || !CSV_URLS.numbers4) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing PayPay CSV URLs." })
      };
    }

    const [numbers3Response, numbers4Response] = await Promise.all([
      fetch(CSV_URLS.numbers3, { headers: { "user-agent": "tensaikun" } }),
      fetch(CSV_URLS.numbers4, { headers: { "user-agent": "tensaikun" } })
    ]);

    if (!numbers3Response.ok || !numbers4Response.ok) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "Failed to fetch PayPay CSV." })
      };
    }

    const [numbers3Text, numbers4Text] = await Promise.all([
      numbers3Response.text(),
      numbers4Response.text()
    ]);

    const numbers3Rows = parsePayPayCsv(numbers3Text, 3, "numbers3");
    const numbers4Rows = parsePayPayCsv(numbers4Text, 4, "numbers4");
    const merged = new Map();

    for (const row of numbers3Rows) {
      merged.set(row.drawNo, {
        drawNo: row.drawNo,
        drawDate: row.drawDate,
        numbers3: row.numbers3,
        numbers4: []
      });
    }

    for (const row of numbers4Rows) {
      const current = merged.get(row.drawNo) ?? {
        drawNo: row.drawNo,
        drawDate: row.drawDate,
        numbers3: [],
        numbers4: []
      };
      merged.set(row.drawNo, {
        ...current,
        drawDate: current.drawDate || row.drawDate,
        numbers4: row.numbers4
      });
    }

    const rows = Array.from(merged.values())
      .filter((row) => row.numbers3.length === 3 && row.numbers4.length === 4)
      .sort((a, b) => b.drawNo - a.drawNo)
      .slice(0, limit);

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=300"
      },
      body: JSON.stringify(rows)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Unexpected error." })
    };
  }
};
