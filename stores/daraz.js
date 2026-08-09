```javascript
const BASE_URL = "https://www.daraz.com.np";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache"
};


/* ============================================================
   DARAZ SEARCH
   ============================================================ */

async function searchDaraz(query) {

  const searchTerm = String(query || "").trim();

  if (!searchTerm) {
    return [];
  }

  console.log(`Daraz: searching for "${searchTerm}"`);

  try {

    /*
     * Daraz search pages use:
     *
     * https://www.daraz.com.np/catalog/?q=iphone
     *
     * This is preferable to crawling the entire Daraz website.
     */

    const searchUrl =
      `${BASE_URL}/catalog/?q=${encodeURIComponent(searchTerm)}`;

    console.log(`Daraz URL: ${searchUrl}`);

    const response =
      await fetchWithTimeout(searchUrl);

    console.log(
      `Daraz search status: ${response.status}`
    );

    if (!response.ok) {

      console.log(
        `Daraz search failed with status ${response.status}`
      );

      return [];

    }

    const html =
      await response.text();

    console.log(
      `Daraz: received ${html.length} characters`
    );


    /*
     * Daraz is a dynamic marketplace.
     * Product information may appear in:
     *
     * 1. JSON embedded in the page
     * 2. JSON-LD
     * 3. Normal HTML
     *
     * We try all three.
     */

    const products =
      extractProductsFromPage(
        html,
        searchTerm
      );


    console.log(
      `Daraz: extracted ${products.length} matching products`
    );


    /*
     * Remove duplicates.
     */

    const unique =
      removeDuplicates(products);


    /*
     * Limit results so one Daraz search does not
     * overwhelm the other stores.
     */

    const results =
      unique.slice(0, 30);


    console.log(
      `Daraz: returning ${results.length} results for "${searchTerm}"`
    );


    return results;

  } catch (error) {

    console.error(
      `Daraz search error: ${error.message}`
    );

    return [];

  }

}


/* ============================================================
   FETCH
   ============================================================ */

async function fetchWithTimeout(url) {

  return fetch(
    url,
    {
      method: "GET",
      headers: HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(25000)
    }
  );

}


/* ============================================================
   EXTRACT PRODUCTS
   ============================================================ */

function extractProductsFromPage(html, query) {

  const results = [];

  /*
   * First try Daraz's embedded JSON.
   */

  extractFromEmbeddedJson(
    html,
    query,
    results
  );


  /*
   * Then try JSON-LD.
   */

  extractFromJsonLd(
    html,
    query,
    results
  );


  /*
   * Finally try ordinary HTML anchors.
   */

  extractFromHtml(
    html,
    query,
    results
  );


  return results;

}


/* ============================================================
   EMBEDDED DARAZ JSON
   ============================================================ */

function extractFromEmbeddedJson(
  html,
  query,
  results
) {

  const patterns = [

    /window\.__[^=]+=\s*(\{[\s\S]*?\});/g,

    /window\._[A-Za-z0-9_]+\s*=\s*(\{[\s\S]*?\});/g,

    /<script[^>]*>\s*(\{[\s\S]{100,}\})\s*<\/script>/gi

  ];


  for (const pattern of patterns) {

    let match;

    while (
      (match = pattern.exec(html)) !== null
    ) {

      const jsonText =
        match[1];

      /*
       * Don't attempt extremely large arbitrary
       * strings as JSON.
       */

      if (
        !jsonText ||
        jsonText.length > 5000000
      ) {
        continue;
      }


      try {

        const data =
          JSON.parse(jsonText);


        walkObject(
          data,
          query,
          results
        );

      } catch {
        /*
         * Not valid JSON.
         * Continue with the other extraction methods.
         */
      }

    }

  }

}


/* ============================================================
   RECURSIVE OBJECT SEARCH
   ============================================================ */

function walkObject(
  object,
  query,
  results
) {

  if (
    object === null ||
    object === undefined
  ) {
    return;
  }


  if (
    Array.isArray(object)
  ) {

    for (const item of object) {

      walkObject(
        item,
        query,
        results
      );

    }

    return;

  }


  if (
    typeof object !== "object"
  ) {
    return;
  }


  /*
   * Look for objects that resemble Daraz products.
   */

  const name =
    firstString(
      object,
      [
        "name",
        "productName",
        "itemName",
        "title",
        "name_en"
      ]
    );


  const url =
    firstString(
      object,
      [
        "url",
        "productUrl",
        "itemUrl",
        "product_url"
      ]
    );


  const image =
    firstString(
      object,
      [
        "image",
        "imageUrl",
        "img",
        "image_url",
        "mainImage"
      ]
    );


  const price =
    firstNumber(
      object,
      [
        "price",
        "salePrice",
        "specialPrice",
        "currentPrice",
        "priceShow",
        "promotionPrice"
      ]
    );


  if (
    name &&
    (
      url ||
      image
    )
  ) {

    addProduct(
      results,
      {
        name,
        price,
        url,
        image,
        availability:
          "Check store"
      },
      query
    );

  }


  /*
   * Continue through nested objects.
   */

  for (
    const key of Object.keys(object)
  ) {

    /*
     * Avoid enormous irrelevant structures.
     */

    if (
      key === "tracking" ||
      key === "analytics" ||
      key === "recommendation"
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


/* ============================================================
   JSON-LD
   ============================================================ */

function extractFromJsonLd(
  html,
  query,
  results
) {

  const scripts =
    html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    );


  for (const match of scripts) {

    try {

      const data =
        JSON.parse(
          match[1].trim()
        );


      const objects =
        Array.isArray(data)
          ? data
          : [data];


      for (const object of objects) {

        extractJsonLdObject(
          object,
          query,
          results
        );

      }

    } catch {
      continue;
    }

  }

}


/* ============================================================
   JSON-LD OBJECT
   ============================================================ */

function extractJsonLdObject(
  object,
  query,
  results
) {

  if (
    !object ||
    typeof object !== "object"
  ) {
    return;
  }


  if (
    object["@type"] === "Product" ||
    object.name
  ) {

    const name =
      object.name;


    let price =
      null;


    if (
      object.offers
    ) {

      const offers =
        Array.isArray(object.offers)
          ? object.offers
          : [object.offers];


      for (const offer of offers) {

        const candidate =
          parsePrice(
            offer &&
            offer.price
          );


        if (
          validPrice(candidate)
        ) {

          price =
            candidate;

          break;

        }

      }

    }


    const url =
      object.url ||
      "";


    const image =
      Array.isArray(object.image)
        ? object.image[0]
        : object.image || "";


    if (
      name &&
      (
        url ||
        image
      )
    ) {

      addProduct(
        results,
        {
          name,
          price,
          url,
          image,
          availability:
            "Check store"
        },
        query
      );

    }

  }


  /*
   * Handle @graph.
   */

  if (
    Array.isArray(object["@graph"])
  ) {

    for (
      const item of object["@graph"]
    ) {

      extractJsonLdObject(
        item,
        query,
        results
      );

    }

  }

}


/* ============================================================
   HTML FALLBACK
   ============================================================ */

function extractFromHtml(
  html,
  query,
  results
) {

  /*
   * Daraz product links normally contain
   * /products/ in the URL.
   */

  const linkPattern =
    /<a[^>]+href=["']([^"']*\/products\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;


  let match;


  while (
    (match = linkPattern.exec(html)) !== null
  ) {

    const rawUrl =
      match[1];


    const anchorHtml =
      match[2];


    const url =
      normalizeUrl(
        rawUrl
      );


    if (!url) {
      continue;
    }


    const name =
      cleanText(
        anchorHtml
      );


    if (
      !name ||
      name.length < 3
    ) {
      continue;
    }


    /*
     * Search nearby HTML for a price.
     */

    const start =
      Math.max(
        0,
        match.index - 1500
      );


    const end =
      Math.min(
        html.length,
        match.index + 5000
      );


    const nearby =
      html.slice(
        start,
        end
      );


    const price =
      extractPriceFromText(
        nearby
      );


    const image =
      extractImageNear(
        nearby
      );


    addProduct(
      results,
      {
        name,
        price,
        url,
        image,
        availability:
          "Check store"
      },
      query
    );

  }

}


/* ============================================================
   ADD PRODUCT
   ============================================================ */

function addProduct(
  results,
  product,
  query
) {

  if (
    !product ||
    !product.name
  ) {
    return;
  }


  const name =
    cleanText(
      decodeHtml(
        product.name
      )
    );


  if (
    !name ||
    name.length < 3
  ) {
    return;
  }


  /*
   * Ignore navigation/category text.
   */

  if (
    isBadProductName(name)
  ) {
    return;
  }


  /*
   * Product must actually match the search.
   */

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


  /*
   * Daraz contains many unrelated results,
   * so don't return products without a reliable price.
   */

  if (
    !validPrice(price)
  ) {
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

    store:
      "Daraz Nepal",

    price,

    shipping:
      0,

    total:
      price,

    currency:
      "NPR",

    availability:
      product.availability ||
      "Check store",

    url,

    image,

    source:
      "Daraz Nepal",

    lastUpdated:
      new Date().toISOString()

  });

}


/* ============================================================
   PRICE EXTRACTION
   ============================================================ */

function extractPriceFromText(text) {

  if (!text) {
    return null;
  }


  const patterns = [

    /Rs\.?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi,

    /NPR\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi,

    /₨\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/g,

    /रू\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/g,

    /रु\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/g

  ];


  const prices = [];


  for (
    const pattern of patterns
  ) {

    for (
      const match of text.matchAll(pattern)
    ) {

      const price =
        parsePrice(
          match[1]
        );


      if (
        validPrice(price)
      ) {

        prices.push(price);

      }

    }

  }


  if (!prices.length) {
    return null;
  }


  /*
   * Return the smallest valid price in the
   * nearby product block.
   */

  return Math.min(
    ...new Set(prices)
  );

}


/* ============================================================
   IMAGE NEAR PRODUCT
   ============================================================ */

function extractImageNear(text) {

  if (!text) {
    return "";
  }


  const patterns = [

    /<img[^>]+src=["']([^"']+)["']/i,

    /<img[^>]+data-src=["']([^"']+)["']/i,

    /<img[^>]+data-original=["']([^"']+)["']/i

  ];


  for (
    const pattern of patterns
  ) {

    const match =
      text.match(pattern);


    if (
      match &&
      match[1]
    ) {

      return normalizeImage(
        decodeHtml(
          match[1]
        )
      );

    }

  }


  return "";

}


/* ============================================================
   SEARCH MATCH
   ============================================================ */

function matchesSearch(
  query,
  name
) {

  const search =
    normalizeSearch(
      query
    );


  const product =
    normalizeSearch(
      name
    );


  if (
    !search ||
    !product
  ) {
    return false;
  }


  /*
   * Exact phrase.
   */

  if (
    product.includes(search)
  ) {
    return true;
  }


  const words =
    search
      .split(/\s+/)
      .filter(
        word =>
          word.length >= 2
      );


  if (!words.length) {
    return false;
  }


  let matched =
    0;


  for (
    const word of words
  ) {

    if (
      product.includes(word)
    ) {

      matched++;
      continue;

    }


    /*
     * Singular/plural tolerance.
     */

    if (
      word.endsWith("s") &&
      product.includes(
        word.slice(0, -1)
      )
    ) {

      matched++;
      continue;

    }


    if (
      !word.endsWith("s") &&
      product.includes(
        word + "s"
      )
    ) {

      matched++;

    }

  }


  /*
   * For a one-word search, require that word.
   * For multiple words, at least half must match.
   */

  return (
    matched >=
    Math.ceil(
      words.length / 2
    )
  );

}


/* ============================================================
   REMOVE DUPLICATES
   ============================================================ */

function removeDuplicates(
  products
) {

  const seen =
    new Set();


  const output =
    [];


  for (
    const product of products
  ) {

    const key =
      (
        product.url ||
        `${product.name}|${product.price}`
      )
        .toLowerCase()
        .trim();


    if (
      seen.has(key)
    ) {
      continue;
    }


    seen.add(key);

    output.push(product);

  }


  return output;

}


/* ============================================================
   BAD PRODUCT NAME FILTER
   ============================================================ */

function isBadProductName(name) {

  const value =
    normalizeSearch(
      name
    );


  const bad = [

    "home",

    "login",

    "sign in",

    "register",

    "help center",

    "customer care",

    "terms and conditions",

    "privacy policy",

    "sell on daraz",

    "download app",

    "categories",

    "flash sale",

    "shop now"

  ];


  return bad.includes(value);

}


/* ============================================================
   OBJECT HELPERS
   ============================================================ */

function firstString(
  object,
  keys
) {

  for (
    const key of keys
  ) {

    const value =
      object[key];


    if (
      typeof value === "string" &&
      value.trim()
    ) {

      return value;

    }

  }


  return "";

}


function firstNumber(
  object,
  keys
) {

  for (
    const key of keys
  ) {

    const value =
      parsePrice(
        object[key]
      );


    if (
      validPrice(value)
    ) {

      return value;

    }

  }


  return null;

}


/* ============================================================
   NORMALIZATION
   ============================================================ */

function normalizeSearch(
  text
) {

  return String(
    text || ""
  )
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


function cleanText(
  text
) {

  return String(
    text || ""
  )
    .replace(
      /<script[\s\S]*?<\/script>/gi,
      " "
    )
    .replace(
      /<style[\s\S]*?<\/style>/gi,
      " "
    )
    .replace(
      /<[^>]*>/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();

}


function decodeHtml(
  text
) {

  return String(
    text || ""
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
      /&#x27;/gi,
      "'"
    )
    .replace(
      /&lt;/gi,
      "<"
    )
    .replace(
      /&gt;/gi,
      ">"
    )
    .replace(
      /&nbsp;/gi,
      " "
    );

}


/* ============================================================
   URL HELPERS
   ============================================================ */

function normalizeUrl(
  url
) {

  if (!url) {
    return "";
  }


  let value =
    String(url)
      .trim();


  value =
    decodeHtml(
      value
    );


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


function normalizeImage(
  url
) {

  const value =
    normalizeUrl(
      url
    );


  if (!value) {
    return "";
  }


  /*
   * Ignore tiny tracking images.
   */

  if (
    value.includes("pixel") ||
    value.includes("tracking")
  ) {

    return "";

  }


  return value;

}


/* ============================================================
   PRICE
   ============================================================ */

function parsePrice(
  value
) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {

    return null;

  }


  /*
   * Handle strings such as:
   *
   * Rs. 80,399
   * NPR 80,399
   * 80399
   */

  const cleaned =
    String(value)
      .replace(
        /Rs\.?/gi,
        ""
      )
      .replace(
        /NPR/gi,
        ""
      )
      .replace(
        /₨/g,
        ""
      )
      .replace(
        /रू/g,
        ""
      )
      .replace(
        /रु/g,
        ""
      )
      .replace(
        /,/g,
        ""
      )
      .trim();


  const number =
    Number(
      cleaned
    );


  if (
    !Number.isFinite(number)
  ) {

    return null;

  }


  return number;

}


function validPrice(
  price
) {

  return (
    Number.isFinite(price) &&
    price >= 100 &&
    price < 10000000
  );

}


/* ============================================================
   EXPORT
   ============================================================ */

module.exports =
  searchDaraz;
```
