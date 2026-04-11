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

const InternetArchive = {
  SearchAPI: new SearchAPI(),
  BookManifestAPI: new BookManifestAPI()
};

export default InternetArchive;
