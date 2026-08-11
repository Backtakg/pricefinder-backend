const genericSearch =
  require("./genericstore");

module.exports =
  function searchMaxInternational(searchTerm) {

    return genericSearch(
      searchTerm,
      {

        storeName:
          "Max International",

        logName:
          "Max International",

        baseUrl:
          "https://maxnepal.com.np",

        searchUrl:
          query =>
            `https://maxnepal.com.np/?s=${encodeURIComponent(query)}&post_type=product`,

        cardSelectors: [

          "li.product",

          ".product",

          ".product-item",

          ".product-card",

          "[class*='product-item']",

          "[class*='product-card']"

        ],

        nameSelectors: [

          ".woocommerce-loop-product__title",

          ".product-title",

          "h2",

          "h3",

          "h4",

          "[class*='product-name']",

          "[class*='product-title']"

        ],

        priceSelectors: [

          ".price",

          ".woocommerce-Price-amount",

          "[class*='price']"

        ]

      }
    );

  };
