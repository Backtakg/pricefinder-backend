const axios = require("axios");
const cheerio = require("cheerio");

async function searchStarHifi(searchTerm) {
  console.log(`Star HiFi: searching for "${searchTerm}"`);

  const results = [];
  const seen = new Set();

  try {
    const searchUrl =
      `https://starhifi.com/search?q=${encodeURIComponent(searchTerm)}`;

    console.log(`Star HiFi URL: ${searchUrl}`);

    const response = await axios.get(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) " +
          "Chrome/151.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://starhifi.com/"
      },
      timeout: 20000,
      maxRedirects: 5
    });

    console.log(`Star HiFi status: ${response.status}`);

    const html = response.data;

    if (!html || typeof html !== "string") {
      console.log("Star HiFi: invalid response");
      return [];
    }

    console.log(`Star HiFi: received ${html.length} characters`);

    const $ = cheerio.load(html);

    function cleanText(value) {
      return String(value || "")
        .replace(/\s+/g, " ")
        .trim();
    }

    function parsePrice(value) {
      if (!value) return null;

      const cleaned = String(value)
        .replace(/NPR/gi, "")
        .replace(/Rs\.?/gi, "")
        .replace(/रु\.?/g, "")
        .replace(/,/g, "")
        .trim();

      const match = cleaned.match(/\d+(?:\.\d+)?/);

      if (!match) return null;

      const price = Number(match[0]);

      if (!Number.isFinite(price) || price <= 0) {
        return null;
      }

      return price;
    }

    function addResult(name, price, url, image) {
      name = cleanText(name);

      if (!name) return;

      if (!name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return;
      }

      price = parsePrice(price);

      if (!price) {
        return;
      }

      let finalUrl = url || "";

      if (finalUrl && !finalUrl.startsWith("http")) {
        finalUrl = `https://starhifi.com${finalUrl}`;
      }

      const key = `${name.toLowerCase()}|${price}|${finalUrl}`;

      if (seen.has(key)) {
        return;
      }

      seen.add(key);

      let finalImage = image || null;

      if (
        finalImage &&
        !finalImage.startsWith("http")
      ) {
        finalImage = `https://starhifi.com${finalImage}`;
      }

      results.push({
        name,
        store: "Star HiFi",
        price,
        shipping: 0,
        total: price,
        availability: "Check store",
        url: finalUrl,
        image: finalImage,
        source: "Star HiFi",
        lastUpdated: new Date().toISOString()
      });
    }

    /*
     * Look for product cards.
     */

    const productSelectors = [
      ".product",
      ".product-card",
      ".product-item",
      ".product-box",
      ".card",
      '[class*="product"]'
    ];

    for (const selector of productSelectors) {
      $(selector).each((index, element) => {
        const card = $(element);

        const link =
          card.find("a[href]").first().attr("href") ||
          card.attr("href");

        const name =
          card.find(
            ".product-title, .product-name, .title, h2, h3, h4"
          ).first().text() ||
          card.find("a").first().text();

        const priceText =
          card.find(
            ".price, .product-price, .current-price, [class*='price']"
          ).first().text();

        const image =
          card.find("img").first().attr("src") ||
          card.find("img").first().attr("data-src") ||
          card.find("img").first().attr("data-lazy-src");

        addResult(
          name,
          priceText,
          link,
          image
        );
      });
    }

    /*
     * Look through links as a fallback.
     */

    $("a[href]").each((index, element) => {
      const link = $(element);

      const href = link.attr("href");

      if (!href) return;

      const name = cleanText(link.text());

      if (!name) return;

      if (!name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return;
      }

      const parent = link.closest(
        ".product, .product-card, .product-item, .card"
      );

      const container = parent.length
        ? parent
        : link.parent();

      const text = cleanText(container.text());

      const priceMatch = text.match(
        /(?:NPR|Rs\.?|रु\.?)?\s*[\d,]+(?:\.\d+)?/i
      );

      if (!priceMatch) return;

      const image =
        container.find("img").first().attr("src") ||
        container.find("img").first().attr("data-src") ||
        null;

      addResult(
        name,
        priceMatch[0],
        href,
        image
      );
    });

    console.log(
      `Star HiFi: returning ${results.length} results for "${searchTerm}"`
    );

    return results.slice(0, 20);
  } catch (error) {
    console.error(
      `Star HiFi search error: ${error.message}`
    );

    return [];
  }
}

module.exports = searchStarHifi;
