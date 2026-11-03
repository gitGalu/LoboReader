// Pure helpers for in-issue full-text search results and printed page numbers.

const MATCH_MARKER = /<IA_FTS_MATCH>|<\/IA_FTS_MATCH>/;
const MIN_PAGE_NUMBER_CONFIDENCE = 50;

// Turns a BookReader search paragraph into display segments, trimmed to a
// window around the first match: [{ text, match }]. The leading context is
// short so the match stays on the first line of a two-line snippet on phones.
export const buildSnippet = (text = '', { before = 28, total = 160 } = {}) => {
  const segments = String(text)
    .split(MATCH_MARKER)
    .map((part, index) => ({ text: part.replace(/\s+/g, ' '), match: index % 2 === 1 }))
    .filter((segment) => segment.text);

  const firstMatch = segments.findIndex((segment) => segment.match);
  if (firstMatch === -1) {
    const plain = segments.map((segment) => segment.text).join('').trim();
    return plain ? [{ text: plain.length > total ? `${plain.slice(0, total).replace(/\s\S*$/, '')}…` : plain, match: false }] : [];
  }

  const snippet = [];
  let leading = segments.slice(0, firstMatch).map((segment) => segment.text).join('').trimStart();
  if (leading.length > before) {
    leading = `…${leading.slice(leading.length - before).replace(/^\S*\s/, '')}`;
  }
  if (leading) {
    snippet.push({ text: leading, match: false });
  }

  let length = leading.length;
  for (const segment of segments.slice(firstMatch)) {
    const remaining = total - length;
    if (remaining <= 0) {
      snippet.push({ text: '…', match: false });
      break;
    }

    if (!segment.match && segment.text.length > remaining) {
      snippet.push({ text: `${segment.text.slice(0, remaining).replace(/\s\S*$/, '')}…`, match: false });
      break;
    }

    snippet.push(segment);
    length += segment.text.length;
  }

  const last = snippet[snippet.length - 1];
  if (last && !last.match) {
    last.text = last.text.trimEnd();
  }

  return snippet;
};

export const parseSearchResponse = (json, pageCount) => {
  const results = (json?.matches || []).flatMap((match, index) => {
    const pageIndex = Number(match?.par?.[0]?.page);
    if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= pageCount) {
      return [];
    }

    return [{ key: index, pageIndex, snippet: buildSnippet(match.text) }];
  });

  return { indexed: json?.indexed !== false, results };
};

// _page_numbers.json → array indexed like the reader's pages, holding the
// number printed on each page (or null for unnumbered pages). Returns null
// when the file is missing, unreliable or has no numbers at all.
export const parsePageNumbers = (json, pageCount) => {
  if (!Array.isArray(json?.pages)) {
    return null;
  }

  const confidence = Number(json.confidence);
  if (Number.isFinite(confidence) && confidence < MIN_PAGE_NUMBER_CONFIDENCE) {
    return null;
  }

  const numbers = Array(pageCount).fill(null);
  let found = false;

  json.pages.forEach((page) => {
    const leaf = Number(page?.leafNum);
    const printed = page?.pageNumber == null ? '' : String(page.pageNumber).trim();

    if (Number.isInteger(leaf) && leaf >= 0 && leaf < pageCount && printed) {
      numbers[leaf] = printed;
      found = true;
    }
  });

  return found ? numbers : null;
};

// One entry per page (in page order of first appearance), so a page whose
// many paragraphs mention the term doesn't flood the list.
export const groupResultsByPage = (results, snippetsPerPage = 2) => {
  const groups = new Map();

  results.forEach((result) => {
    if (!groups.has(result.pageIndex)) {
      groups.set(result.pageIndex, { pageIndex: result.pageIndex, count: 0, snippets: [] });
    }

    const group = groups.get(result.pageIndex);
    group.count += 1;
    if (group.snippets.length < snippetsPerPage) {
      group.snippets.push(result.snippet);
    }
  });

  return Array.from(groups.values());
};
