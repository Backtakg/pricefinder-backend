const axios = require("axios");
const cheerio = require("cheerio");

async function searchDaraz(searchTerm) {
  console.log(`Daraz: searching for "${searchTerm}"`);

  const results = [];

  try {
    const url =
      "https://www.daraz.com.np/catalog/?q=" +
      encodeURIComponent(searchTerm);

    console.log(`Daraz URL: ${url}`);

    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.daraz.com.np/"
      },
      timeout: 20000,
      maxRedirects: 5
    });

    console.log(`Daraz status: ${response.status}`);

    const html = response.data;

    if (!html || typeof html !== "string") {
      console.log("Daraz: invalid response");
      return [];
    }

    console.log(`Daraz: received ${html.length} characters`);

    const $ = cheerio.load(html);

    /*
     * Daraz pages can contain product information inside
     * embedded JSON rather than normal HTML product cards.
     */

    const seen = new Set();

    function addProduct(product) {
      if (!product || typeof product !== "object") return;

      const name =
        product.name ||
        product.title ||
        product.productName ||
        product.itemTitle;

      if (!name) return;

      const lowerName = String(name).toLowerCase();
      const lowerSearch = String(searchTerm).toLowerCase();

      if (!lowerName.includes(lowerSearch)) {
        return;
      }

      let price =
        product.price ??
        product.salePrice ??
        product.currentPrice ??
        product.priceShow ??
        product.priceText;

      if (typeof price === "string") {
        price = price.replace(/[^\d.]/g, "");
      }

      price = Number(price);

      if (!Number.isFinite(price) || price <= 0) {
        return;
      }

      const productUrl =
        product.url ||
        product.productUrl ||
        product.itemUrl ||
        product.link;

      const image =
        product.image ||
        product.imageUrl ||
        product.pic ||
        product.mainImage ||
        product.imageUrlDefault;

      const finalUrl = productUrl
        ? productUrl.startsWith("http")
          ? productUrl
          : `https://www.daraz.com.np${productUrl}`
        : "";

      const key = `${name}|${price}|${finalUrl}`;

      if (seen.has(key)) return;

      seen.add(key);

      results.push({
        name: String(name).trim(),
        store: "Daraz",
        price,
        shipping: 0,
        total: price,
        availability: "Check store",
        url: finalUrl,
        image: image || null,
        source: "Daraz",
        lastUpdated: new Date().toISOString()
      });
    }

    /*
     * Method 1:
     * Look through script tags containing product JSON.
     */

    $("script").each((index, element) => {
      const text = $(element).html();

      if (!text) return;

      if (
        !text.includes("product") &&
        !text.includes("itemTitle") &&
        !text.includes("priceShow")
      ) {
        return;
      }

      /*
       * Extract common Daraz JSON structures.
       */

      const patterns = [
        /"itemTitle"\s*:\s*"([^"]+)"/g,
        /"name"\s*:\s*"([^"]+)"/g
      ];

      /*
       * Search JSON-like objects.
       */

      const objectMatches = text.match(
        /\{[^{}]{0,5000}(?:itemTitle|priceShow|productUrl|salePrice)[^{}]{0,5000}\}/g
      );

      if (objectMatches) {
        for (const objectText of objectMatches) {
          try {
            const normalized = objectText
              .replace(/\\"/g, '"')
              .replace(/\\'/g, "'");

            const nameMatch = normalized.match(
              /"(?:itemTitle|name|title|productName)"\s*:\s*"([^"]+)"/i
            );

            const priceMatch = normalized.match(
              /"(?:priceShow|salePrice|price|currentPrice)"\s*:\s*"?([\d,.]+)/i
            );

            const urlMatch = normalized.match(
              /"(?:productUrl|url|itemUrl|link)"\s*:\s*"([^"]+)"/i
            );

            const imageMatch = normalized.match(
              /"(?:image|imageUrl|pic|mainImage)"\s*:\s*"([^"]+)"/i
            );

            if (nameMatch) {
              addProduct({
                name: nameMatch[1],
                price: priceMatch ? priceMatch[1] : null,
                url: urlMatch ? urlMatch[1] : "",
                image: imageMatch ? imageMatch[1] : null
              });
            }
          } catch (error) {
            // Ignore malformed embedded objects
          }
        }
      }

      /*
       * Try parsing complete JSON scripts.
       */

      try {
        const trimmed = text.trim();

        if (
          trimmed.startsWith("{") ||
          trimmed.startsWith("[")
        ) {
          const json = JSON.parse(trimmed);

          function walk(value) {
            if (!value) return;

            if (Array.isArray(value)) {
              for (const item of value) {
                walk(item);
              }
              return;
            }

            if (typeof value !== "object") return;

            if (
              value.itemTitle ||
              value.productName ||
              value.priceShow ||
              value.salePrice ||
              value.productUrl
            ) {
              addProduct(value);
            }

            for (const key of Object.keys(value)) {
              const child = value[key];

              if (
                typeof child === "object" &&
                child !== null
              ) {
                walk(child);
              }
            }
          }

          walk(json);
        }
      } catch (error) {
        // Script is not standalone JSON; continue.
      }
    });

    /*
     * Method 2:
     * Search normal HTML links/cards.
     */

    $("a").each((index, element) => {
      const href = $(element).attr("href");

      if (!href) return;

      const text = $(element)
        .text()
        .replace(/\s+/g, " ")
        .trim();

      if (!text) return;

      const lowerText = text.toLowerCase();
      const lowerSearch = String(searchTerm).toLowerCase();

      if (!lowerText.includes(lowerSearch)) {
        return;
      }

      if (!href.includes("i")) {
        return;
      }

      const card = $(element).closest(
        '[class*="product"], [class*="item"], [data-qa-locator]'
      );

      const cardText = card.length
        ? card.text().replace(/\s+/g, " ")
        : text;

      const priceMatch = cardText.match(
        /(?:Rs\.?|NPR|रु\.?)?\s*([\d,]+(?:\.\d{1,2})?)/i
      );

      if (!priceMatch) return;

      const price = Number(
        priceMatch[1].replace(/,/g, "")
      );

      if (!Number.isFinite(price) || price <= 0) {
        return;
      }

      let image = null;

      if (card.length) {
        const img = card.find("img").first();

        image =
          img.attr("src") ||
          img.attr("data-src") ||
          img.attr("data-original") ||
          null;
      }

      addProduct({
        name: text,
        price,
        url: href,
        image
      });
    });

    console.log(
      `Daraz: returning ${results.length} results for "${searchTerm}"`
    );

    return results.slice(0, 20);
  } catch (error) {
    console.error(
      `Daraz search error: ${error.message}`
    );

    return [];
  }
}

module.exports = searchDaraz;
