const axios = require("axios");
const cheerio = require("cheerio");

async function searchDaraz(searchTerm) {
  console.log(`Daraz: searching for "${searchTerm}"`);

  const results = [];
  const seen = new Set();

  try {
    const url =
      `https://www.daraz.com.np/catalog/?q=${encodeURIComponent(searchTerm)}`;

    console.log(`Daraz URL: ${url}`);

    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.daraz.com.np/",
        Connection: "keep-alive"
      },
      timeout: 30000,
      maxRedirects: 10
    });

    console.log(`Daraz status: ${response.status}`);

    const html = response.data;

    if (!html || typeof html !== "string") {
      console.log("Daraz: empty/invalid response");
      return [];
    }

    console.log(`Daraz: received ${html.length} characters`);

    const $ = cheerio.load(html);

    const searchLower = String(searchTerm).toLowerCase().trim();

    function cleanText(value) {
      return String(value || "")
        .replace(/\\u002F/g, "/")
        .replace(/\\u0026/g, "&")
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\s+/g, " ")
        .trim();
    }

    function parsePrice(value) {
      if (value === null || value === undefined) return null;

      const text = String(value)
        .replace(/NPR/gi, "")
        .replace(/Rs\.?/gi, "")
        .replace(/रु\.?/gi, "")
        .replace(/,/g, "")
        .trim();

      const match = text.match(/\d+(?:\.\d+)?/);

      if (!match) return null;

      const price = Number(match[0]);

      if (!Number.isFinite(price) || price <= 0) {
        return null;
      }

      return price;
    }

    function absoluteUrl(value) {
      if (!value) return "";

      let result = cleanText(value);

      if (result.startsWith("//")) {
        return "https:" + result;
      }

      if (result.startsWith("/")) {
        return "https://www.daraz.com.np" + result;
      }

      return result;
    }

    function addResult(product) {
      if (!product) return;

      const name = cleanText(
        product.name ||
        product.title ||
        product.itemTitle ||
        product.productName
      );

      if (!name) return;

      /*
       * Only return products matching the user's search.
       */
      if (!name.toLowerCase().includes(searchLower)) {
        return;
      }

      const price = parsePrice(
        product.price ??
        product.salePrice ??
        product.currentPrice ??
        product.priceShow
      );

      if (!price) {
        return;
      }

      const productUrl = absoluteUrl(
        product.url ||
        product.productUrl ||
        product.itemUrl ||
        product.link
      );

      const image = absoluteUrl(
        product.image ||
        product.imageUrl ||
        product.pic ||
        product.mainImage
      );

      const key = `${name}|${price}|${productUrl}`;

      if (seen.has(key)) {
        return;
      }

      seen.add(key);

      results.push({
        name,
        store: "Daraz",
        price,
        shipping: 0,
        total: price,
        availability: "Check store",
        url: productUrl,
        image: image || null,
        source: "Daraz",
        lastUpdated: new Date().toISOString()
      });

      console.log(
        `Daraz product found: ${name} | NPR ${price}`
      );
    }

    /*
     * ---------------------------------------------------------
     * METHOD 1: Extract product objects from page source
     * ---------------------------------------------------------
     */

    const source = html;

    /*
     * Daraz frequently stores product information in escaped
     * JSON inside script tags.
     */

    const jsonPatterns = [
      /"itemTitle"\s*:\s*"([^"]+)"/g,
      /"productName"\s*:\s*"([^"]+)"/g,
      /"title"\s*:\s*"([^"]+)"/g
    ];

    /*
     * Search for product-like JSON objects.
     */

    const objectRegex =
      /\{(?:[^{}"]|"[^"]*"|\{[^{}]*\}){0,3000}(?:"itemTitle"|"productName"|"priceShow"|"salePrice"|"productUrl")(?:[^{}"]|"[^"]*"|\{[^{}]*\}){0,3000}\}/g;

    const objectMatches = source.match(objectRegex) || [];

    console.log(
      `Daraz: found ${objectMatches.length} possible embedded product objects`
    );

    for (const rawObject of objectMatches) {
      try {
        const text = rawObject
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, "\\");

        const nameMatch = text.match(
          /"(?:itemTitle|productName|name|title)"\s*:\s*"([^"]+)"/i
        );

        const priceMatch = text.match(
          /"(?:priceShow|salePrice|currentPrice|price)"\s*:\s*"?([\d,.]+)"?/i
        );

        const urlMatch = text.match(
          /"(?:productUrl|itemUrl|url|link)"\s*:\s*"([^"]+)"/i
        );

        const imageMatch = text.match(
          /"(?:imageUrl|image|pic|mainImage)"\s*:\s*"([^"]+)"/i
        );

        if (nameMatch) {
          addResult({
            name: nameMatch[1],
            price: priceMatch ? priceMatch[1] : null,
            url: urlMatch ? urlMatch[1] : "",
            image: imageMatch ? imageMatch[1] : ""
          });
        }
      } catch (error) {
        // Ignore malformed object
      }
    }

    /*
     * ---------------------------------------------------------
     * METHOD 2: Parse script tags containing JSON
     * ---------------------------------------------------------
     */

    $("script").each((index, element) => {
      const scriptText = $(element).html();

      if (!scriptText) return;

      if (
        !scriptText.includes("itemTitle") &&
        !scriptText.includes("priceShow") &&
        !scriptText.includes("productUrl") &&
        !scriptText.includes("salePrice")
      ) {
        return;
      }

      /*
       * Extract product names, prices, URLs and images using
       * nearby JSON fields.
       */

      const names = [
        ...scriptText.matchAll(
          /"(?:itemTitle|productName|productTitle)"\s*:\s*"([^"]+)"/gi
        )
      ];

      for (const match of names) {
        const name = cleanText(match[1]);

        if (!name.toLowerCase().includes(searchLower)) {
          continue;
        }

        /*
         * Look around the product name for a price.
         */

        const position = match.index || 0;

        const nearby = scriptText.slice(
          Math.max(0, position - 2500),
          Math.min(scriptText.length, position + 5000)
        );

        const priceMatch = nearby.match(
          /"(?:priceShow|salePrice|currentPrice|price)"\s*:\s*"?([\d,.]+)"?/i
        );

        const urlMatch = nearby.match(
          /"(?:productUrl|itemUrl|productUrlKey)"\s*:\s*"([^"]+)"/i
        );

        const imageMatch = nearby.match(
          /"(?:imageUrl|image|pic)"\s*:\s*"([^"]+)"/i
        );

        addResult({
          name,
          price: priceMatch ? priceMatch[1] : null,
          url: urlMatch ? urlMatch[1] : "",
          image: imageMatch ? imageMatch[1] : ""
        });
      }
    });

    /*
     * ---------------------------------------------------------
     * METHOD 3: Normal HTML product cards
     * ---------------------------------------------------------
     */

    const possibleCards = $(
      '[data-qa-locator="product-item"], ' +
      '[class*="Bm3ON"], ' +
      '[class*="product"], ' +
      '[class*="item"]'
    );

    console.log(
      `Daraz: found ${possibleCards.length} possible HTML product cards`
    );

    possibleCards.each((index, element) => {
      try {
        const card = $(element);

        const cardText = cleanText(card.text());

        if (!cardText.toLowerCase().includes(searchLower)) {
          return;
        }

        /*
         * Find product title.
         */

        let name = "";

        const titleElement = card.find(
          '[title], ' +
          '[class*="title"], ' +
          '[class*="name"], ' +
          'a'
        ).first();

        if (titleElement.length) {
          name =
            titleElement.attr("title") ||
            titleElement.text();
        }

        name = cleanText(name);

        if (!name || !name.toLowerCase().includes(searchLower)) {
          return;
        }

        /*
         * Find price.
         */

        const priceElement = card.find(
          '[class*="price"], ' +
          '[data-qa-locator*="price"]'
        ).first();

        let priceText = priceElement.text();

        if (!priceText) {
          priceText = cardText;
        }

        const price = parsePrice(priceText);

        if (!price) {
          return;
        }

        /*
         * Find product URL.
         */

        const link = card.find("a[href]").first();

        const productUrl = link.length
          ? link.attr("href")
          : "";

        /*
         * Find image.
         */

        const imageElement = card.find("img").first();

        const image =
          imageElement.attr("src") ||
          imageElement.attr("data-src") ||
          imageElement.attr("data-original") ||
          "";

        addResult({
          name,
          price,
          url: productUrl,
          image
        });
      } catch (error) {
        // Ignore individual card errors.
      }
    });

    /*
     * ---------------------------------------------------------
     * METHOD 4: Extract product URLs from HTML
     * ---------------------------------------------------------
     */

    const productLinks = new Set();

    $("a[href]").each((index, element) => {
      const href = $(element).attr("href");

      if (!href) return;

      const absolute = absoluteUrl(href);

      /*
       * Daraz product URLs commonly contain "-i".
       */

      if (
        absolute.includes("daraz.com.np/products/") ||
        /-i\d+\.html/i.test(absolute)
      ) {
        productLinks.add(absolute);
      }
    });

    console.log(
      `Daraz: found ${productLinks.size} possible product URLs`
    );

    /*
     * ---------------------------------------------------------
     * Final cleanup
     * ---------------------------------------------------------
     */

    const finalResults = results
      .filter((item) => {
        return (
          item &&
          item.name &&
          Number.isFinite(item.price) &&
          item.price > 0
        );
      })
      .slice(0, 20);

    console.log(
      `Daraz: returning ${finalResults.length} results for "${searchTerm}"`
    );

    return finalResults;
  } catch (error) {
    console.error(
      `Daraz search error: ${error.message}`
    );

    return [];
  }
}

module.exports = searchDaraz;
