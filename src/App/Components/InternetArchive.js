import fetch from "node-fetch";

const paramify = (obj) => new URLSearchParams(obj).toString();

const fetchJson = async function (url, options) {
  const res = await fetch(url, options);
  return await res.json();
};

class BookManifestAPI {
  constructor() {
    this.API_BASE = "https://iiif.archive.org/iiif/3/";

  }
  async get({ identifier = null }) {
    if (!identifier) {
      throw new Error("Missing required arg 'identifier'");
    }
    const url = `${this.API_BASE}/${identifier}/manifest.json`;
    return fetchJson(url);
  }
  async metadata(identifier) {
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