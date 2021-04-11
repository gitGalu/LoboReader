import fetch from "node-fetch";

const paramify = (obj) => new URLSearchParams(obj).toString();

const fetchJson = async function (url, options) {
  const res = await fetch(url, options);
  return await res.json();
};

class BookMetaAPI {
  constructor() {
    this.API_BASE = "https://api.archivelab.org/v1/books/";

  }
  async get({ identifier = null }) {
    if (!identifier) {
      throw new Error("Missing required arg 'identifier'");
    }
    const url = `${this.API_BASE}/${identifier}`;
    return fetchJson(url);
  }
  async metadata(identifier) {
    return await this.get({ identifier });
  }
}

class BookManifestAPI {
  constructor() {
    this.API_BASE = "https://api.archivelab.org/v1/books/";
  }
  async get({ identifier = null }) {
    if (!identifier) {
      throw new Error("Missing required arg 'identifier'");
    }
    const url = `${this.API_BASE}/${identifier}/ia_manifest`;
    return fetchJson(url);
  }
  async metadata(identifier) {
    return await this.get({ identifier });
  }
}

class ExpBookAPI {
  constructor() {
    this.API_BASE = "https://api.archivelab.org/v1/books/";
  }
  async get({ identifier = null }) {
    if (!identifier) {
      throw new Error("Missing required arg 'identifier'");
    }
    const url = `${this.API_BASE}/${identifier}/pages`;
    return fetchJson(url);
  }
  async pages(identifier) {
    return await this.get({ identifier });
  }
}

class SearchAPI {
  constructor() {
    this.API_BASE = "https://archive.org/advancedsearch.php";
  }
  async get({ q = null, page = 1, fields = ["identifier"], ...options } = {}) {
    if (!q) {
      throw new Error("Missing required arg 'q'");
    }
    if (typeof q == "object") {
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
    return fetchJson(url);
  }
  async search(q) {
    return await this.get({ q });
  }
  buildQueryFromObject(qObject) {
    // Map dictionary to a key=val search query
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
  ExpBookAPI: new ExpBookAPI(),
  BookMetaAPI: new BookMetaAPI(),
  BookManifestAPI: new BookManifestAPI()
};

export default InternetArchive;