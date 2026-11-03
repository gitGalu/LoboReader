const paramify = (obj) => new URLSearchParams(obj).toString();

const responseCache = new Map();
const pendingRequests = new Map();

const fetchJson = async function (url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const useCache = method === 'GET' && !options.noCache;

  if (useCache && responseCache.has(url)) {
    return responseCache.get(url);
  }

  if (useCache && pendingRequests.has(url)) {
    return pendingRequests.get(url);
  }

  const request = fetch(url, options)
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      return res.json();
    })
    .then((json) => {
      if (useCache) {
        responseCache.set(url, json);
      }

      return json;
    })
    .finally(() => {
      if (useCache) {
        pendingRequests.delete(url);
      }
    });

  if (useCache) {
    pendingRequests.set(url, request);
  }

  return request;
};

class BookManifestAPI {
  constructor() {
    this.API_BASE = "https://iiif.archive.org/iiif/3/";

  }
  async get({ identifier = null, force = false }) {
    if (!identifier) {
      throw new Error("Missing required arg 'identifier'");
    }
    const url = `${this.API_BASE}/${identifier}/manifest.json`;
    return fetchJson(url, { noCache: force });
  }
  async metadata(identifier) {
    return await this.get({ identifier });
  }
  async prefetch({ identifier = null }) {
    try {
      return await this.get({ identifier });
    } catch (err) {
      return undefined;
    }
  }
}

class SearchAPI {
  constructor() {
    this.API_BASE = "https://archive.org/advancedsearch.php";
  }
  async get({ q = null, page = 1, fields = ["identifier"], force = false, ...options } = {}) {
    if (!q) {
      throw new Error("Missing required arg 'q'");
    }
    if (typeof q === "object") {
      q = this.buildQueryFromObject(q);
    }
    const reqParams = {
      q,
      page,
      fl: fields,
      ...options,
      output: "json",
    };
    const encodedParams = paramify(reqParams);
    const url = `${this.API_BASE}?${encodedParams}`;
    return fetchJson(url, { noCache: force });
  }
  async search(q) {
    return await this.get({ q });
  }
  async prefetch(params) {
    try {
      return await this.get(params);
    } catch (err) {
      return undefined;
    }
  }
  buildQueryFromObject(qObject) {
    return Object.keys(qObject)
      .map((key) => {
        if (Array.isArray(qObject[key])) {
          return `${key}:( ${qObject[key].map((v) => `"${v}"`).join(" OR ")} )`;
        } else {
          return `${key}:"${qObject[key]}"`;
        }
      })
      .join(" AND ");
  }
}

class MetadataAPI {
  async get(identifier) {
    if (!identifier) {
      throw new Error("Missing required arg 'identifier'");
    }
    return fetchJson(`https://archive.org/metadata/${encodeURIComponent(identifier)}`);
  }
}

// OCR-derived files that identify the book's text "doc" (BookReader's subPrefix),
// in order of preference.
const BOOK_TEXT_SUFFIXES = ['_djvu.xml', '_hocr_searchtext.txt.gz', '_hocr.html', '_chocr.html.gz'];

export const getBookTextSource = (metadata) => {
  const server = metadata?.server || metadata?.d1;
  const path = metadata?.dir;
  const names = (metadata?.files || []).map((file) => file?.name).filter(Boolean);

  if (!server || !path) {
    return null;
  }

  for (const suffix of BOOK_TEXT_SUFFIXES) {
    const name = names.find((candidate) => candidate.endsWith(suffix));
    if (name) {
      const doc = name.slice(0, -suffix.length);
      return {
        server,
        path,
        doc,
        pageNumbersFile: names.includes(`${doc}_page_numbers.json`) ? `${doc}_page_numbers.json` : null
      };
    }
  }

  return null;
};

// Full-text search inside a single item, the same endpoint archive.org's own
// BookReader uses. Not formally documented, but CORS-enabled and long-lived.
class FullTextAPI {
  async source(identifier) {
    const metadata = await InternetArchive.MetadataAPI.get(identifier);
    return getBookTextSource(metadata);
  }
  async search({ identifier, source, q }) {
    if (!source || !q) {
      throw new Error("Missing required args 'source' and 'q'");
    }
    const params = paramify({ item_id: identifier, doc: source.doc, path: source.path, q });
    const json = await fetchJson(`https://${source.server}/fulltext/inside.php?${params}`);
    if (json?.error) {
      throw new Error(json.error);
    }
    return json;
  }
  async pageNumbers({ identifier, source }) {
    if (!source?.pageNumbersFile) {
      return null;
    }
    return fetchJson(`https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(source.pageNumbersFile)}`);
  }
}

const InternetArchive = {
  SearchAPI: new SearchAPI(),
  BookManifestAPI: new BookManifestAPI(),
  MetadataAPI: new MetadataAPI(),
  FullTextAPI: new FullTextAPI()
};

export default InternetArchive;
