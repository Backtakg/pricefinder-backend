```js
// ============================================================
// PRICEFINDER NEPAL — DARAZ SCRAPER
// ============================================================

const BASE_URL = "https://www.daraz.com.np";

// ------------------------------------------------------------
// MAIN SEARCH
// ------------------------------------------------------------

async function searchDaraz(query) {
  const searchTerm = String(query || "").trim();

  if (!searchTerm) {
    return [];
  }

  console.log(`Daraz: searching for "${searchTerm}"`);

  const searchUrl =
    `${BASE_URL}/catalog/?q=${encodeURIComponent(searchTerm)}`;

  console.log(`Daraz URL: ${searchUrl}`);

  try {
    const response = await fetch(searchUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language":
          "en-US,en;q=0.9",
        "Cache-Control":
          "no-cache",
        "Pragma":
          "no-cache"
      },
      signal: AbortSignal.timeout(30000)
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

    // --------------------------------------------------------
    // 1. JSON-LD
    // --------------------------------------------------------

    extractJsonLd(html, searchTerm, results);

    // --------------------------------------------------------
    // 2. SCRIPT / EMBEDDED JSON
    // --------------------------------------------------------

    extractAllScriptJson(html, searchTerm, results);

    // --------------------------------------------------------
    // 3. PRODUCT LINKS + HTML CONTEXT
    // --------------------------------------------------------

    extractProductLinks(html, searchTerm, results);

    // --------------------------------------------------------
    // 4. GENERAL DARAZ PRODUCT PATTERNS
    // --------------------------------------------------------

    extractGeneralProductBlocks(
      html,
      searchTerm,
      results
    );

    // --------------------------------------------------------
    // REMOVE DUPLICATES
    // --------------------------------------------------------

    let unique = removeDuplicates(results);

    console.log(
      `Daraz: extracted ${unique.length} products from search page`
    );

    // --------------------------------------------------------
    // 5. FETCH PRODUCT PAGES FOR MISSING/UNRELIABLE PRICES
    // --------------------------------------------------------

    if (unique.length > 0) {
      unique = await enrichProducts(unique, searchTerm);
    }

    unique = removeDuplicates(unique);

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


// ============================================================
// JSON-LD
// ============================================================

function extractJsonLd(html, query, results) {
  const regex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    const raw = match[1].trim();

    try {
      const data = JSON.parse(raw);

      walkJson(
        data,
        query,
        results
      );

    } catch (error) {
      // Some sites contain JSON-LD with invalid trailing data.
      // Try extracting individual Product objects.
      extractProductObjectsFromText(
        raw,
        query,
        results
      );
    }
  }
}


// ============================================================
// GENERIC JSON WALKER
// ============================================================

function walkJson(object, query, results) {
  if (!object) {
    return;
  }

  if (Array.isArray(object)) {
    for (const item of object) {
      walkJson(
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

  const name = getString(
    object,
    [
      "name",
      "productName",
      "itemName",
      "title",
      "displayName"
    ]
  );

  const url = getString(
    object,
    [
      "url",
      "productUrl",
      "product_url",
      "itemUrl",
      "item_url",
      "href"
    ]
  );

  const image = getString(
    object,
    [
      "image",
      "imageUrl",
      "image_url",
      "mainImage",
      "img",
      "thumbnail"
    ]
  );

  let price = getNumber(
    object,
    [
      "price",
      "salePrice",
      "sale_price",
      "specialPrice",
      "special_price",
      "currentPrice",
      "current_price",
      "promotionPrice",
      "promotion_price",
      "finalPrice",
      "final_price",
      "discountPrice",
      "discount_price"
    ]
  );

  // Search nested price objects.
  if (!isValidPrice(price)) {
    const priceObject =
      object.priceInfo ||
      object.price_info ||
      object.priceData ||
      object.price_data ||
      object.pricing ||
      object.offer ||
      object.offers;

    if (priceObject) {
      price = findPriceInObject(
        priceObject
      );
    }
  }

  if (
    name &&
    (url || image) &&
    looksLikeProductName(name)
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

  // Continue recursively.
  for (const key of Object.keys(object)) {
    if (
      key === "tracking" ||
      key === "analytics" ||
      key === "recommendations"
    ) {
      continue;
    }

    const value = object[key];

    if (
      value &&
      typeof value === "object"
    ) {
      walkJson(
        value,
        query,
        results
      );
    }
  }
}


// ============================================================
// SCRIPT JSON EXTRACTION
// ============================================================

function extractAllScriptJson(
  html,
  query,
  results
) {
  const regex =
    /<script\b[^>]*>([\s\S]*?)<\/script>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    const script = match[1].trim();

    if (!script) {
      continue;
    }

    // Ignore obvious JavaScript libraries.
    if (
      script.length < 100 ||
      script.length > 5000000
    ) {
      continue;
    }

    // Try complete JSON.
    try {
      if (
        script.startsWith("{") ||
        script.startsWith("[")
      ) {
        const data =
          JSON.parse(script);

        walkJson(
          data,
          query,
          results
        );
      }
    } catch (_) {
      // Continue with embedded-object extraction.
    }

    // Common embedded JSON assignments.
    extractAssignedJson(
      script,
      query,
      results
    );

    // Look for product-like JSON fragments.
    extractProductObjectsFromText(
      script,
      query,
      results
    );
  }
}


// ============================================================
// ASSIGNED JSON
// ============================================================

function extractAssignedJson(
  script,
  query,
  results
) {
  const patterns = [
    /(?:window\.)?__INITIAL_STATE__\s*=\s*/i,
    /(?:window\.)?__NEXT_DATA__\s*=\s*/i,
    /(?:window\.)?pageData\s*=\s*/i,
    /(?:window\.)?page_data\s*=\s*/i,
    /(?:window\.)?__DATA__\s*=\s*/i,
    /(?:window\.)?data\s*=\s*/i,
    /(?:window\.)?appData\s*=\s*/i,
    /(?:window\.)?APP_DATA\s*=\s*/i
  ];

  for (const pattern of patterns) {
    const match =
      script.match(pattern);

    if (!match) {
      continue;
    }

    const start =
      match.index + match[0].length;

    const jsonText =
      extractBalancedJson(
        script,
        start
      );

    if (!jsonText) {
      continue;
    }

    try {
      const data =
        JSON.parse(jsonText);

      walkJson(
        data,
        query,
        results
      );

    } catch (_) {
      // Ignore malformed data.
    }
  }
}


// ============================================================
// PRODUCT OBJECT EXTRACTION FROM TEXT
// ============================================================

function extractProductObjectsFromText(
  text,
  query,
  results
) {
  if (!text) {
    return;
  }

  // Find objects containing product-like fields.
  const regex =
    /\{[^{}]{0,10000}(?:"(?:productName|itemName|name)"\s*:)[^{}]{0,10000}\}/gi;

  let match;

  while ((match = regex.exec(text)) !== null) {
    const block =
      match[0];

    const name =
      extractJsonStringValue(
        block,
        [
          "productName",
          "itemName",
          "name",
          "title"
        ]
      );

    if (!name) {
      continue;
    }

    const url =
      extractJsonStringValue(
        block,
        [
          "productUrl",
          "product_url",
          "itemUrl",
          "item_url",
          "url",
          "href"
        ]
      );

    const image =
      extractJsonStringValue(
        block,
        [
          "image",
          "imageUrl",
          "image_url",
          "thumbnail"
        ]
      );

    const price =
      extractPriceFromText(
        block
      );

    if (
      name &&
      looksLikeProductName(name)
    ) {
      addProduct(
        results,
        {
          name,
          url,
          image,
          price
        },
        query
      );
    }
  }
}


// ============================================================
// PRODUCT LINKS
// ============================================================

function extractProductLinks(
  html,
  query,
  results
) {
  const patterns = [
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    /href=["']([^"']+)["']/gi
  ];

  const seenUrls =
    new Set();

  for (const regex of patterns) {
    let match;

    while ((match = regex.exec(html)) !== null) {
      const href =
        match[1];

      const url =
        normalizeUrl(href);

      if (!isDarazProductUrl(url)) {
        continue;
      }

      if (seenUrls.has(url)) {
        continue;
      }

      seenUrls.add(url);

      let block = "";

      if (match[2]) {
        block = match[2];
      } else {
        block =
          html.substring(
            Math.max(
              0,
              match.index - 2500
            ),
            Math.min(
              html.length,
              match.index + 5000
            )
          );
      }

      const cleanBlock =
        cleanText(block);

      const name =
        extractProductName(
          cleanBlock,
          query
        );

      const price =
        extractPriceFromText(
          block
        );

      const image =
        extractImage(
          block
        );

      if (
        name &&
        looksLikeProductName(name)
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
    }
  }
}


// ============================================================
// GENERAL PRODUCT BLOCKS
// ============================================================

function extractGeneralProductBlocks(
  html,
  query,
  results
) {
  // Daraz product cards often contain product
  // information in containers rather than JSON-LD.

  const patterns = [
    /<div[^>]+class=["'][^"']*(?:product|item|card)[^"']*["'][^>]*>[\s\S]{0,15000}?<\/div>/gi,
    /<li[^>]+class=["'][^"']*(?:product|item|card)[^"']*["'][^>]*>[\s\S]{0,15000}?<\/li>/gi
  ];

  for (const regex of patterns) {
    let match;

    while ((match = regex.exec(html)) !== null) {
      const block =
        match[0];

      const name =
        extractProductName(
          cleanText(block),
          query
        );

      const price =
        extractPriceFromText(
          block
        );

      const url =
        extractFirstProductUrl(
          block
        );

      const image =
        extractImage(
          block
        );

      if (
        name &&
        url
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
    }
  }
}


// ============================================================
// ENRICH PRODUCT DETAILS
// ============================================================

async function enrichProducts(
  products,
  query
) {
  const output = [];

  // Limit requests so one Daraz search does not
  // create too many requests.
  const candidates =
    products.slice(0, 20);

  for (const product of candidates) {
    if (
      isValidPrice(product.price)
    ) {
      output.push(product);
      continue;
    }

    try {
      console.log(
        `Daraz: checking product "${product.name}"`
      );

      const detail =
        await fetchProductPage(
          product.url
        );

      if (detail) {
        product.name =
          detail.name ||
          product.name;

        if (
          isValidPrice(
            detail.price
          )
        ) {
          product.price =
            detail.price;
        }

        if (
          detail.image
        ) {
          product.image =
            detail.image;
        }
      }

    } catch (error) {
      console.log(
        `Daraz product check failed: ${error.message}`
      );
    }

    // Only keep products with a reliable price.
    if (
      isValidPrice(product.price)
    ) {
      output.push(product);
    }
  }

  return output;
}


// ============================================================
// PRODUCT PAGE FETCH
// ============================================================

async function fetchProductPage(
  url
) {
  if (!url) {
    return null;
  }

  const response =
    await fetch(
      url,
      {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language":
            "en-US,en;q=0.9"
        },
        signal:
          AbortSignal.timeout(20000)
      }
    );

  if (!response.ok) {
    return null;
  }

  const html =
    await response.text();

  let name = "";
  let image = "";
  let price = null;

  // JSON-LD first.
  const ldRegex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match;

  while (
    (match = ldRegex.exec(html)) !== null
  ) {
    try {
      const data =
        JSON.parse(
          match[1].trim()
        );

      const products =
        flattenObjects(
          data
        );

      for (const item of products) {
        if (
          item["@type"] === "Product" ||
          item.name
        ) {
          if (
            !name &&
            typeof item.name === "string"
          ) {
            name =
              item.name;
          }

          if (
            !image
          ) {
            image =
              Array.isArray(
                item.image
              )
                ? item.image[0]
                : item.image || "";
          }

          const offer =
            item.offers;

          const foundPrice =
            findPriceInObject(
              offer
            );

          if (
            isValidPrice(
              foundPrice
            )
          ) {
            price =
              foundPrice;
          }
        }
      }

    } catch (_) {}
  }

  // Search the entire product page for price patterns.
  if (
    !isValidPrice(price)
  ) {
    price =
      extractPriceFromText(
        html
      );
  }

  // Search visible page title.
  if (!name) {
    const titleMatch =
      html.match(
        /<title[^>]*>([\s\S]*?)<\/title>/i
      );

    if (titleMatch) {
      name =
        cleanText(
          titleMatch[1]
        )
          .replace(
            /\s*\|\s*Daraz.*$/i,
            ""
          )
          .trim();
    }
  }

  return {
    name,
    price,
    image:
      normalizeImage(image)
  };
}


// ============================================================
// PRODUCT NAME
// ============================================================

function extractProductName(
  text,
  query
) {
  if (!text) {
    return "";
  }

  const lines =
    text
      .split(/\n|\r/)
      .map(
        line =>
          cleanText(line)
      )
      .filter(
        line =>
          line.length >= 5 &&
          line.length <= 300
      );

  const search =
    normalizeSearch(query);

  // Prefer lines containing the search term.
  for (const line of lines) {
    const normalized =
      normalizeSearch(line);

    if (
      search &&
      normalized.includes(search)
    ) {
      if (
        !looksLikeNoise(line)
      ) {
        return line;
      }
    }
  }

  // Otherwise find a likely product title.
  for (const line of lines) {
    if (
      !looksLikeNoise(line) &&
      !/^(Rs|NPR|₨|\$)\s*[\d,]+$/i.test(line)
    ) {
      return line;
    }
  }

  return "";
}


// ============================================================
// PRICE EXTRACTION
// ============================================================

function extractPriceFromText(
  text
) {
  if (!text) {
    return null;
  }

  const decoded =
    decodeHtml(
      String(text)
    );

  const patterns = [
    /(?:Rs\.?|NPR|₨|रु\.?|रू\.?)\s*([0-9][0-9,]*(?:\.[0-9]+)?)/gi,

    /"price"\s*:\s*"?(?:NPR)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/gi,

    /"salePrice"\s*:\s*"?(?:NPR)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/gi,

    /"currentPrice"\s*:\s*"?(?:NPR)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/gi,

    /"promotionPrice"\s*:\s*"?(?:NPR)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/gi,

    /"specialPrice"\s*:\s*"?(?:NPR)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/gi
  ];

  const prices = [];

  for (
    const regex of patterns
  ) {
    let match;

    while (
      (match = regex.exec(decoded)) !== null
    ) {
      const price =
        parsePrice(
          match[1]
        );

      if (
        isValidPrice(price)
      ) {
        prices.push(price);
      }
    }
  }

  if (
    !prices.length
  ) {
    return null;
  }

  // Use the lowest nearby price.
  return Math.min(
    ...prices
  );
}


// ============================================================
// PRICE HELPERS
// ============================================================

function findPriceInObject(
  object
) {
  if (!object) {
    return null;
  }

  if (
    typeof object === "string" ||
    typeof object === "number"
  ) {
    const price =
      parsePrice(object);

    return isValidPrice(price)
      ? price
      : null;
  }

  if (
    Array.isArray(object)
  ) {
    for (
      const item of object
    ) {
      const price =
        findPriceInObject(item);

      if (
        isValidPrice(price)
      ) {
        return price;
      }
    }

    return null;
  }

  if (
    typeof object !== "object"
  ) {
    return null;
  }

  const priceKeys = [
    "price",
    "salePrice",
    "sale_price",
    "currentPrice",
    "current_price",
    "specialPrice",
    "special_price",
    "promotionPrice",
    "promotion_price",
    "finalPrice",
    "final_price",
    "discountPrice",
    "discount_price"
  ];

  for (
    const key of priceKeys
  ) {
    const price =
      parsePrice(
        object[key]
      );

    if (
      isValidPrice(price)
    ) {
      return price;
    }
  }

  for (
    const key of Object.keys(object)
  ) {
    if (
      key === "tracking" ||
      key === "analytics"
    ) {
      continue;
    }

    const price =
      findPriceInObject(
        object[key]
      );

    if (
      isValidPrice(price)
    ) {
      return price;
    }
  }

  return null;
}


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

  let cleaned =
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
        /रु/g,
        ""
      )
      .replace(
        /रू/g,
        ""
      )
      .replace(
        /,/g,
        ""
      )
      .trim();

  const number =
    Number(cleaned);

  if (
    !Number.isFinite(number)
  ) {
    return null;
  }

  return number;
}


function isValidPrice(
  price
) {
  return (
    Number.isFinite(price) &&
    price >= 10 &&
    price < 10000000
  );
}


// ============================================================
// ADD PRODUCT
// ============================================================

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
      product.name
    );

  if (
    !name ||
    !looksLikeProductName(name)
  ) {
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

  if (
    !isValidPrice(price)
  ) {
    return;
  }

  const url =
    normalizeUrl(
      product.url
    );

  if (
    !url ||
    !isDarazProductUrl(url)
  ) {
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
    lastUpdated:
      new Date().toISOString()
  });
}


// ============================================================
// SEARCH MATCH
// ============================================================

function matchesSearch(
  query,
  name
) {
  const search =
    normalizeSearch(query);

  const product =
    normalizeSearch(name);

  if (
    !search ||
    !product
  ) {
    return false;
  }

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

  if (
    !words.length
  ) {
    return false;
  }

  let matched = 0;

  for (
    const word of words
  ) {
    if (
      product.includes(word)
    ) {
      matched++;
    }
  }

  // For multi-word searches, require at least
  // half the words to match.
  return (
    matched >=
    Math.ceil(
      words.length / 2
    )
  );
}


// ============================================================
// PRODUCT URL
// ============================================================

function isDarazProductUrl(
  url
) {
  if (!url) {
    return false;
  }

  const value =
    String(url)
      .toLowerCase();

  if (
    !value.includes(
      "daraz.com.np"
    )
  ) {
    return false;
  }

  return (
    value.includes("/products/") ||
    value.includes("-i") ||
    value.includes("/p/")
  );
}


function extractFirstProductUrl(
  text
) {
  if (!text) {
    return "";
  }

  const regex =
    /https?:\/\/[^"'<>\\\s]+|\/[^"'<>\\\s]+/gi;

  let match;

  while (
    (match = regex.exec(text)) !== null
  ) {
    const url =
      normalizeUrl(
        match[0]
      );

    if (
      isDarazProductUrl(url)
    ) {
      return url;
    }
  }

  return "";
}


// ============================================================
// IMAGE
// ============================================================

function extractImage(
  text
) {
  if (!text) {
    return "";
  }

  const patterns = [
    /<img[^>]+src=["']([^"']+)["']/i,
    /<img[^>]+data-src=["']([^"']+)["']/i,
    /<img[^>]+data-original=["']([^"']+)["']/i,
    /"imageUrl"\s*:\s*"([^"]+)"/i,
    /"image"\s*:\s*"([^"]+)"/i
  ];

  for (
    const regex of patterns
  ) {
    const match =
      text.match(regex);

    if (
      match &&
      match[1]
    ) {
      return normalizeImage(
        decodeEscapedUrl(
          match[1]
        )
      );
    }
  }

  return "";
}


// ============================================================
// URL HELPERS
// ============================================================

function normalizeUrl(
  url
) {
  if (!url) {
    return "";
  }

  let value =
    decodeEscapedUrl(
      String(url)
    )
      .trim()
      .replace(
        /&amp;/gi,
        "&"
      );

  // Remove surrounding quotes.
  value =
    value.replace(
      /^["']|["']$/g,
      ""
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
    value.startsWith(
      "http://"
    ) ||
    value.startsWith(
      "https://"
    )
  ) {
    return value;
  }

  return "";
}


function normalizeImage(
  url
) {
  return normalizeUrl(url);
}


// ============================================================
// JSON STRING HELPERS
// ============================================================

function extractJsonStringValue(
  text,
  keys
) {
  for (
    const key of keys
  ) {
    const regex =
      new RegExp(
        `"${escapeRegex(key)}"\\s*:\\s*"([^"]*)"`,
        "i"
      );

    const match =
      text.match(regex);

    if (
      match &&
      match[1]
    ) {
      return decodeEscapedText(
        match[1]
      );
    }
  }

  return "";
}


function getString(
  object,
  keys
) {
  if (
    !object ||
    typeof object !== "object"
  ) {
    return "";
  }

  for (
    const key of keys
  ) {
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
  if (
    !object ||
    typeof object !== "object"
  ) {
    return null;
  }

  for (
    const key of keys
  ) {
    const number =
      parsePrice(
        object[key]
      );

    if (
      isValidPrice(number)
    ) {
      return number;
    }
  }

  return null;
}


// ============================================================
// BALANCED JSON EXTRACTION
// ============================================================

function extractBalancedJson(
  text,
  start
) {
  if (
    start < 0 ||
    start >= text.length
  ) {
    return null;
  }

  let opening = "";

  for (
    let i = start;
    i < text.length;
    i++
  ) {
    if (
      text[i] === "{" ||
      text[i] === "["
    ) {
      opening =
        text[i];

      break;
    }

    if (
      !/\s/.test(text[i])
    ) {
      break;
    }
  }

  if (!opening) {
    return null;
  }

  const closing =
    opening === "{"
      ? "}"
      : "]";

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (
    let i = start;
    i < text.length;
    i++
  ) {
    const char =
      text[i];

    if (
      inString
    ) {
      if (
        escaped
      ) {
        escaped = false;
      } else if (
        char === "\\"
      ) {
        escaped = true;
      } else if (
        char === '"'
      ) {
        inString = false;
      }

      continue;
    }

    if (
      char === '"'
    ) {
      inString = true;
      continue;
    }

    if (
      char === opening
    ) {
      depth++;
    } else if (
      char === closing
    ) {
      depth--;

      if (
        depth === 0
      ) {
        return text.slice(
          start,
          i + 1
        );
      }
    }
  }

  return null;
}


// ============================================================
// FLATTEN OBJECTS
// ============================================================

function flattenObjects(
  object
) {
  const output = [];

  function walk(value) {
    if (!value) {
      return;
    }

    if (
      Array.isArray(value)
    ) {
      for (
        const item of value
      ) {
        walk(item);
      }

      return;
    }

    if (
      typeof value !== "object"
    ) {
      return;
    }

    output.push(value);

    for (
      const key of Object.keys(value)
    ) {
      walk(value[key]);
    }
  }

  walk(object);

  return output;
}


// ============================================================
// TEXT HELPERS
// ============================================================

function normalizeSearch(
  text
) {
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


function cleanText(
  text
) {
  return decodeHtml(
    String(text || "")
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
        /\s+/g,
        " "
      )
      .trim()
  );
}


function decodeHtml(
  text
) {
  return String(text || "")
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
      /&apos;/gi,
      "'"
    )
    .replace(
      /&nbsp;/gi,
      " "
    )
    .replace(
      /&lt;/gi,
      "<"
    )
    .replace(
      /&gt;/gi,
      ">"
    );
}


function decodeEscapedText(
  text
) {
  return String(text || "")
    .replace(
      /\\"/g,
      '"'
    )
    .replace(
      /\\\//g,
      "/"
    )
    .replace(
      /\\\\/g,
      "\\"
    );
}


function decodeEscapedUrl(
  text
) {
  return decodeEscapedText(
    String(text || "")
  );
}


// ============================================================
// PRODUCT NAME VALIDATION
// ============================================================

function looksLikeProductName(
  name
) {
  if (!name) {
    return false;
  }

  const value =
    cleanText(name);

  if (
    value.length < 5 ||
    value.length > 500
  ) {
    return false;
  }

  if (
    /^daraz$/i.test(value)
  ) {
    return false;
  }

  if (
    /^(home|login|sign up|register|help|cart|categories)$/i.test(value)
  ) {
    return false;
  }

  return true;
}


function looksLikeNoise(
  text
) {
  const value =
    normalizeSearch(text);

  const noise = [
    "add to cart",
    "buy now",
    "free shipping",
    "flash sale",
    "shop now",
    "login",
    "sign up",
    "help support",
    "customer care",
    "daraz"
  ];

  return noise.some(
    item =>
      value === item ||
      value.startsWith(
        item + " "
      )
  );
}


// ============================================================
// DUPLICATES
// ============================================================

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


// ============================================================
// REGEX ESCAPE
// ============================================================

function escapeRegex(
  text
) {
  return String(text)
    .replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );
}


// ============================================================
// EXPORT
// ============================================================

module.exports = searchDaraz;
```
