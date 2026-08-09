const fetch = require("node-fetch");
const cheerio = require("cheerio");

const BASE_URL = "https://neptronics.com.np";

async function searchNeptronics(query) {
  try {
    console.log(`Neptronics: searching for "${query}"`);

    const searchUrl =
      `${BASE_URL}/?s=${encodeURIComponent(query)}&post_type=product`;

    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });

    console.log(
      `Neptronics search status: ${response.status}`
    );

    if (!response.ok) {
      console.log(
        `Neptronics search failed with status ${response.status}`
      );
      return [];
    }

    const html = await response.text();

    console.log(
      `Neptronics: received ${html.length} characters`
    );

    const $ = cheerio.load(html);

    const productLinks = [];
    const seen = new Set();

    $("a[href]").each((index, element) => {
      const href = $(element).attr("href");

      if (!href) {
        return;
      }

      let url;

      try {
        url = new URL(href, BASE_URL).href;
      } catch (error) {
        return;
      }

      if (
        url.includes("/product/") &&
        !seen.has(url)
      ) {
        seen.add(url);
        productLinks.push(url);
      }
    });

    console.log(
      `Neptronics: found ${productLinks.length} product links`
    );

    const results = [];

    for (
      const url of productLinks.slice(0, 10)
    ) {
      try {
        const productResponse = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
            "Accept":
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
          }
        });

        console.log(
          `Neptronics product status: ${productResponse.status}`
        );

        if (!productResponse.ok) {
          continue;
        }

        const productHtml =
          await productResponse.text();

        const page =
          cheerio.load(productHtml);

        /*
         * Product name
         */

        let name =
          page("h1.product_title").first().text().trim();

        if (!name) {
          name =
            page("h1.entry-title").first().text().trim();
        }

        if (!name) {
          name =
            page("h1").first().text().trim();
        }

        /*
         * Product price
         */

        let priceText =
          page(".summary .price").first().text().trim();

        if (!priceText) {
          priceText =
            page(".woocommerce-Price-amount")
              .first()
              .text()
              .trim();
        }

        if (!priceText) {
          priceText =
            page(".price").first().text().trim();
        }

        const price =
          parsePrice(priceText);

        /*
         * Product image
         */

        let image =
          page(".woocommerce-product-gallery img")
            .first()
            .attr("src");

        if (!image) {
          image =
            page("meta[property='og:image']")
              .attr("content");
        }

        if (
          name &&
          price > 0
        ) {
          results.push({
            name: name,
            price: price,
            shipping: 0,
            total: price,
            store: "Neptronics",
            availability: "Check store",
            url: url,
            image: image || ""
          });

          console.log(
            `Neptronics: found "${name}" - Rs. ${price}`
          );
        }

      } catch (error) {
        console.log(
          `Neptronics product error: ${error.message}`
        );
      }
    }

    console.log(
      `Neptronics: returning ${results.length} results for "${query}"`
    );

    return results;

  } catch (error) {
    console.error(
      `Neptronics search error: ${error.message}`
    );

    return [];
  }
}


/*
 * Convert price text into a number.
 *
 * Examples:
 * Rs. 45,000
 * NPR 45,000
 * Rs 45,000.00
 */

function parsePrice(text) {
  if (!text) {
    return 0;
  }

  const cleaned =
    String(text)
      .replace(/,/g, "")
      .replace(/[^\d.]/g, " ");

  const matches =
    cleaned.match(/\d+(?:\.\d+)?/g);

  if (!matches) {
    return 0;
  }

  for (const value of matches) {
    const number = Number(value);

    if (
      Number.isFinite(number) &&
      number > 0
    ) {
      return number;
    }
  }

  return 0;
}


module.exports = searchNeptronics;
