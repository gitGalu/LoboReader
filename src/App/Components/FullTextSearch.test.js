import { buildSnippet, groupResultsByPage, parsePageNumbers, parseSearchResponse } from './FullTextSearch';
import { getBookTextSource } from './InternetArchive';

const join = (segments) => segments.map((segment) => (segment.match ? `[${segment.text}]` : segment.text)).join('');

describe('buildSnippet', () => {
  test('marks matches and collapses OCR whitespace', () => {
    expect(join(buildSnippet('for  the <IA_FTS_MATCH>Altair</IA_FTS_MATCH> Computer'))).toBe('for the [Altair] Computer');
  });

  test('keeps a short window of context before the first match', () => {
    const before = 'word '.repeat(40);
    const snippet = join(buildSnippet(`${before}<IA_FTS_MATCH>Altair</IA_FTS_MATCH> after`, { before: 20 }));

    expect(snippet.startsWith('…')).toBe(true);
    expect(snippet).toContain('[Altair] after');
    expect(snippet.indexOf('[Altair]')).toBeLessThanOrEqual(22);
  });

  test('cuts long trailing context at a word boundary', () => {
    const snippet = join(buildSnippet(`<IA_FTS_MATCH>BASIC</IA_FTS_MATCH> ${'language '.repeat(40)}`, { total: 40 }));

    expect(snippet.startsWith('[BASIC] language')).toBe(true);
    expect(snippet.endsWith('language…')).toBe(true);
    expect(snippet.length).toBeLessThanOrEqual(44);
  });

  test('handles multiple matches and text without markers', () => {
    expect(join(buildSnippet('<IA_FTS_MATCH>Altair</IA_FTS_MATCH> 8K and <IA_FTS_MATCH>Altair</IA_FTS_MATCH>')))
      .toBe('[Altair] 8K and [Altair]');
    expect(join(buildSnippet('plain text'))).toBe('plain text');
    expect(buildSnippet('')).toEqual([]);
  });
});

describe('parseSearchResponse', () => {
  test('maps matches to reader page indexes and drops out-of-range pages', () => {
    const json = {
      indexed: true,
      matches: [
        { text: 'a <IA_FTS_MATCH>x</IA_FTS_MATCH>', par: [{ page: 8 }] },
        { text: 'b <IA_FTS_MATCH>x</IA_FTS_MATCH>', par: [{ page: 120 }] },
        { text: 'c <IA_FTS_MATCH>x</IA_FTS_MATCH>', par: [] }
      ]
    };

    const { indexed, results } = parseSearchResponse(json, 100);
    expect(indexed).toBe(true);
    expect(results).toHaveLength(1);
    expect(results[0].pageIndex).toBe(8);
    expect(join(results[0].snippet)).toBe('a [x]');
  });

  test('reports issues without a text index', () => {
    expect(parseSearchResponse({ indexed: false, matches: [] }, 10)).toEqual({ indexed: false, results: [] });
  });
});

describe('parsePageNumbers', () => {
  const json = {
    confidence: 96,
    pages: [
      { leafNum: 0, pageNumber: '' },
      { leafNum: 1, pageNumber: null },
      { leafNum: 2, pageNumber: '1' },
      { leafNum: 3, pageNumber: 2 },
      { leafNum: 9, pageNumber: '8' }
    ]
  };

  test('indexes printed numbers by reader page', () => {
    expect(parsePageNumbers(json, 5)).toEqual([null, null, '1', '2', null]);
  });

  test('ignores missing, unreliable or empty data', () => {
    expect(parsePageNumbers(null, 5)).toBeNull();
    expect(parsePageNumbers({ ...json, confidence: 20 }, 5)).toBeNull();
    expect(parsePageNumbers({ pages: [{ leafNum: 0, pageNumber: '' }] }, 5)).toBeNull();
  });
});

describe('getBookTextSource', () => {
  const metadata = {
    server: 'ia600800.us.archive.org',
    d1: 'ia600800.us.archive.org',
    dir: '/8/items/byte-magazine-1975-09',
    files: [
      { name: 'Byte_09.pdf' },
      { name: 'Byte_09_page_numbers.json' },
      { name: 'Byte_09_hocr_searchtext.txt.gz' },
      { name: 'Byte_09_djvu.xml' }
    ]
  };

  test('finds the server, path and text document', () => {
    expect(getBookTextSource(metadata)).toEqual({
      server: 'ia600800.us.archive.org',
      path: '/8/items/byte-magazine-1975-09',
      doc: 'Byte_09',
      pageNumbersFile: 'Byte_09_page_numbers.json'
    });
  });

  test('returns null for items without OCR text', () => {
    expect(getBookTextSource({ ...metadata, files: [{ name: 'Byte_09.pdf' }] })).toBeNull();
    expect(getBookTextSource({ files: metadata.files })).toBeNull();
  });
});

test('groupResultsByPage keeps page order, counts matches and limits snippets', () => {
  const result = (pageIndex, text) => ({ pageIndex, snippet: [{ text, match: false }] });
  const groups = groupResultsByPage([result(8, 'a'), result(8, 'b'), result(8, 'c'), result(12, 'd')]);

  expect(groups.map((group) => [group.pageIndex, group.count, group.snippets.length])).toEqual([[8, 3, 2], [12, 1, 1]]);
});
