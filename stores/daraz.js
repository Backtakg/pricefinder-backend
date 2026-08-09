const BASE_URL = "https://www.daraz.com.np";

async function searchDaraz(query) {
  const searchTerm = String(query || "").trim();

  if (!searchTerm) {
    return [];
  }

  console.log(`Daraz: searching for "${searchTerm}"`);

  const url =
    `${BASE_URL}/catalog/?q=${encodeURIComponent(searchTerm)}`;

  console.log(`Daraz URL: ${url}`);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
      },
      signal: AbortSignal.timeout(25000)
    });

    console.log(`Daraz status: ${response.status}`);

    if (!response.ok) {
      console.log(
        `Daraz search failed: HTTP ${response.status}`
      );
      return [];
    }

    const html = await response.text();

    console.log(
      `Daraz: received ${html.length} characters`
    );

    const results = [];

    extractJsonLd(html, searchTerm, results);
    extractEmbeddedData(html, searchTerm, results);
    extractHtmlProducts(html, searchTerm, results);

    const unique = removeDuplicates(results);

    console.log(
      `Daraz: returning ${unique.length} results for "${searchTerm}"`
    );

    return unique.slice(0, 30);

  } catch (error) {
    console.error(
      `Daraz search error: ${error.message}`
    );

    return [];
  }
}


/* =========================
   JSON-LD
========================= */

function extractJsonLd(html, query, results) {
  const regex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1].trim());

      const items = Array.isArray(data)
        ? data
        : [data];

      for (const item of items) {
        processJsonObject(item, query, results);
      }

    } catch (error) {
      // Ignore invalid JSON-LD blocks
    }
  }
}


function processJsonObject(object, query, results) {
  if (!object || typeof object !== "object") {
    return;
  }

  if (
    object["@type"] === "Product" ||
    object.name
  ) {
    const name =
      typeof object.name === "string"
        ? object.name
        : "";

    let price = null;

    if (object.offers) {
      const offers = Array.isArray(object.offers)
        ? object.offers
        : [object.offers];

      for (const offer of offers) {
        const p = parsePrice(
          offer && offer.price
        );

        if (isValidPrice(p)) {
          price = p;
          break;
        }
      }
    }

    const productUrl =
      typeof object.url === "string"
        ? object.url
        : "";

    let image = "";

    if (Array.isArray(object.image)) {
      image = object.image[0] || "";
    } else if (
      typeof object.image === "string"
    ) {
      image = object.image;
    }

    addProduct(
      results,
      {
        name,
        price,
        url: productUrl,
        image
      },
      query
    );
  }

  if (Array.isArray(object["@graph"])) {
    for (const item of object["@graph"]) {
      processJsonObject(
        item,
        query,
        results
      );
    }
  }
}


/* =========================
   EMBEDDED DATA
========================= */

function extractEmbeddedData(
  html,
  query,
  results
) {
  const patterns = [
    /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/g,
    /window\.__NEXT_DATA__\s*=\s*(\{[\s\S]*?\});/g
  ];

  for (const regex of patterns) {
    let match;

    while ((match = regex.exec(html)) !== null) {
      try {
        const data = JSON.parse(match[1]);

        walkObject(
          data,
          query,
          results
        );

      } catch (error) {
        // Ignore invalid embedded JSON
      }
    }
  }
}


function walkObject(
  object,
  query,
  results
) {
  if (!object) {
    return;
  }

  if (Array.isArray(object)) {
    for (const item of object) {
      walkObject(
        item,
        query,
        results
      );
    }

    return;
  }

  if (typeof object !== "object") {
    return;
  }

  const name =
    getString(
      object,
      [
        "name",
        "productName",
        "itemName",
        "title"
      ]
    );

  const url =
    getString(
      object,
      [
        "url",
        "productUrl",
        "itemUrl",
        "product_url"
      ]
    );

  const image =
    getString(
      object,
      [
        "image",
        "imageUrl",
        "image_url",
        "mainImage",
        "img"
      ]
    );

  const price =
    getNumber(
      object,
      [
        "price",
        "salePrice",
        "specialPrice",
        "currentPrice",
        "promotionPrice"
      ]
    );

  if (
    name &&
    (url || image)
  ) {
    addProduct(
      results,
      {
        name,
        price,
        url,
        image
      },
      query
    );
  }

  for (const key of Object.keys(object)) {
    if (
      key === "tracking" ||
      key === "analytics"
    ) {
      continue;
    }

    walkObject(
      object[key],
      query,
      results
    );
  }
}


/* =========================
   HTML FALLBACK
========================= */

function extractHtmlProducts(
  html,
  query,
  results
) {
  const regex =
    /<a[^>]+href=["']([^"']*\/products\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    const productUrl =
      normalizeUrl(match[1]);

    if (!productUrl) {
      continue;
    }

    const name =
      cleanText(match[2]);

    if (
      !name ||
      name.length < 3
    ) {
      continue;
    }

    const nearby =
      html.substring(
        Math.max(0, match.index - 1000),
        Math.min(
          html.length,
          match.index + 5000
        )
      );

    const price =
      extractPrice(nearby);

    const image =
      extractImage(nearby);

    addProduct(
      results,
      {
        name,
        price,
        url: productUrl,
        image
      },
      query
    );
  }
}


/* =========================
   PRODUCT
========================= */

function addProduct(
  results,
  product,
  query
) {
  if (!product || !product.name) {
    return;
  }

  const name =
    cleanText(
      product.name
    );

  if (!name) {
    return;
  }

  if (
    !matchesSearch(
      query,
      name
    )
  ) {
    return;
  }

  const price =
    parsePrice(
      product.price
    );

  if (!isValidPrice(price)) {
    return;
  }

  const url =
    normalizeUrl(
      product.url
    );

  if (!url) {
    return;
  }

  const image =
    normalizeImage(
      product.image
    );

  results.push({
    name,
    store: "Daraz Nepal",
    price,
    shipping: 0,
    total: price,
    currency: "NPR",
    availability: "Check store",
    url,
    image,
    source: "Daraz Nepal",
    lastUpdated: new Date().toISOString()
  });
}


/* =========================
   SEARCH MATCH
========================= */

function matchesSearch(
  query,
  name
) {
  const search =
    normalizeSearch(query);

  const product =
    normalizeSearch(name);

  if (!search || !product) {
    return false;
  }

  if (product.includes(search)) {
    return true;
  }

  const words =
    search
      .split(/\s+/)
      .filter(
        word => word.length >= 2
      );

  if (!words.length) {
    return false;
  }

  let matched = 0;

  for (const word of words) {
    if (product.includes(word)) {
      matched++;
    }
  }

  return (
    matched >=
    Math.ceil(words.length / 2)
  );
}


/* =========================
   PRICE
========================= */

function extractPrice(text) {
  if (!text) {
    return null;
  }

  const patterns = [
    /Rs\.?\s*([0-9][0-9,]*)/gi,
    /NPR\s*([0-9][0-9,]*)/gi,
    /₨\s*([0-9][0-9,]*)/g,
    /रु\.?\s*([0-9][0-9,]*)/g
  ];

  const prices = [];

  for (const regex of patterns) {
    let match;

    while ((match = regex.exec(text)) !== null) {
      const price =
        parsePrice(match[1]);

      if (isValidPrice(price)) {
        prices.push(price);
      }
    }
  }

  if (!prices.length) {
    return null;
  }

  return Math.min(...prices);
}


function parsePrice(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const cleaned =
    String(value)
      .replace(/Rs\.?/gi, "")
      .replace(/NPR/gi, "")
      .replace(/₨/g, "")
      .replace(/रु/g, "")
      .replace(/रू/g, "")
      .replace(/,/g, "")
      .trim();

  const number =
    Number(cleaned);

  if (!Number.isFinite(number)) {
    return null;
  }

  return number;
}


function isValidPrice(price) {
  return (
    Number.isFinite(price) &&
    price >= 100 &&
    price < 10000000
  );
}


/* =========================
   IMAGE
========================= */

function extractImage(text) {
  if (!text) {
    return "";
  }

  const patterns = [
    /<img[^>]+src=["']([^"']+)["']/i,
    /<img[^>]+data-src=["']([^"']+)["']/i,
    /<img[^>]+data-original=["']([^"']+)["']/i
  ];

  for (const regex of patterns) {
    const match =
      text.match(regex);

    if (
      match &&
      match[1]
    ) {
      return normalizeImage(
        match[1]
      );
    }
  }

  return "";
}


/* =========================
   HELPERS
========================= */

function getString(
  object,
  keys
) {
  for (const key of keys) {
    if (
      typeof object[key] === "string" &&
      object[key].trim()
    ) {
      return object[key];
    }
  }

  return "";
}


function getNumber(
  object,
  keys
) {
  for (const key of keys) {
    const number =
      parsePrice(
        object[key]
      );

    if (isValidPrice(number)) {
      return number;
    }
  }

  return null;
}


function normalizeSearch(text) {
  return String(text || "")
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


function cleanText(text) {
  return String(text || "")
    .replace(
      /<script[\s\S]*?<\/script>/gi,
      " "
    )
    .replace(
      /<style[\s\S]*?<\/style>/gi,
      " "
    )
    .replace(
      /<[^>]+>/g,
      " "
    )
    .replace(
      /&amp;/gi,
      "&"
    )
    .replace(
      /&quot;/gi,
      '"'
    )
    .replace(
      /&#39;/gi,
      "'"
    )
    .replace(
      /&nbsp;/gi,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


function normalizeUrl(url) {
  if (!url) {
    return "";
  }

  let value =
    String(url).trim();

  if (
    value.startsWith("//")
  ) {
    return "https:" + value;
  }

  if (
    value.startsWith("/")
  ) {
    return BASE_URL + value;
  }

  if (
    value.startsWith("http://") ||
    value.startsWith("https://")
  ) {
    return value;
  }

  return "";
}


function normalizeImage(url) {
  return normalizeUrl(url);
}


function removeDuplicates(
  products
) {
  const seen =
    new Set();

  const output =
    [];

  for (const product of products) {
    const key =
      (
        product.url ||
        `${product.name}|${product.price}`
      )
        .toLowerCase()
        .trim();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(product);
  }

  return output;
}


/* =========================
   EXPORT
========================= */

module.exports = searchDaraz;
