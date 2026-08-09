const cheerio = require("cheerio");

const BASE_URL = "https://neptronics.com.np";

async function searchNeptronics(query) {
  try {
    console.log(`Neptronics: searching for "${query}"`);

    const searchUrl =
      `${BASE_URL}/?s=${encodeURIComponent(query)}&post_type=product`;

    console.log(`Neptronics URL: ${searchUrl}`);

    const response = await fetch(searchUrl, {
      method: "GET",

      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",

        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",

        "Accept-Language":
          "en-US,en;q=0.9",

        "Cache-Control":
          "no-cache",

        "Pragma":
          "no-cache"
      },

      redirect: "follow",

      signal: AbortSignal.timeout(20000)
    });

    console.log(
      `Neptronics search status: ${response.status}`
    );

    if (!response.ok) {
      console.log(
        `Neptronics search returned HTTP ${response.status}`
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

    /*
     * Find product links
     */

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
        url.startsWith(BASE_URL) &&
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

    /*
     * Visit product pages
     */

    for (
      const url of productLinks.slice(0, 10)
    ) {
      try {
        console.log(
          `Neptronics: checking ${url}`
        );

        const productResponse = await fetch(url, {
          method: "GET",

          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",

            "Accept":
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

            "Accept-Language":
              "en-US,en;q=0.9"
          },

          redirect: "follow",

          signal: AbortSignal.timeout(20000)
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
         * PRODUCT NAME
         */

        let name =
          page("h1.product_title")
            .first()
            .text()
            .trim();

        if (!name) {
          name =
            page("h1.entry-title")
              .first()
              .text()
              .trim();
        }

        if (!name) {
          name =
            page("h1")
              .first()
              .text()
              .trim();
        }

        /*
         * PRICE
         */

        let priceText =
          page(".summary .price")
            .first()
            .text()
            .trim();

        if (!priceText) {
          priceText =
            page(".price")
              .first()
              .text()
              .trim();
        }

        if (!priceText) {
          priceText =
            page(".woocommerce-Price-amount")
              .first()
              .text()
              .trim();
        }

        const price =
          parsePrice(priceText);

        /*
         * IMAGE
         */

        let image =
          page(
            ".woocommerce-product-gallery img"
          )
            .first()
            .attr("src");

        if (!image) {
          image =
            page(
              "meta[property='og:image']"
            )
              .attr("content");
        }

        /*
         * RESULT
         */

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

            availability:
              "Check store",

            url: url,

            image:
              image || ""
          });

          console.log(
            `Neptronics: FOUND "${name}" - Rs. ${price}`
          );
        } else {
          console.log(
            `Neptronics: could not extract name/price from ${url}`
          );
        }

      } catch (error) {

        console.error(
          `Neptronics product error: ${error.message}`
        );

        if (error.cause) {
          console.error(
            "Neptronics product error cause:",
            error.cause
          );
        }
      }
    }

    console.log(
      `Neptronics: returning ${results.length} results for "${query}"`
    );

    return results;

  } catch (error) {

    /*
     * IMPORTANT:
     * Print the complete error so Render tells us
     * whether this is DNS, TLS, timeout, connection
     * reset, etc.
     */

    console.error(
      "=========================================="
    );

    console.error(
      "NEPTRONICS SEARCH ERROR"
    );

    console.error(
      "Message:",
      error.message
    );

    console.error(
      "Name:",
      error.name
    );

    console.error(
      "Code:",
      error.code
    );

    console.error(
      "Cause:",
      error.cause
    );

    console.error(
      "Full error:",
      error
    );

    console.error(
      "=========================================="
    );

    return [];
  }
}


/*
 * Convert price text to number
 *
 * Examples:
 *
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
    cleaned.match(
      /\d+(?:\.\d+)?/g
    );

  if (!matches) {
    return 0;
  }

  for (
    const value of matches
  ) {

    const number =
      Number(value);

    if (
      Number.isFinite(number) &&
      number > 0
    ) {
      return number;
    }
  }

  return 0;
}


module.exports =
  searchNeptronics;
