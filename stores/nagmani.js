const genericSearch =
  require("./genericstore");

module.exports =
  function searchNagmani(searchTerm) {

    return genericSearch(
      searchTerm,
      {

        storeName:
          "Nagmani",

        logName:
          "Nagmani",

        baseUrl:
          "https://nagmani.com.np",

        searchUrl:
          query =>
            `https://nagmani.com.np/?s=${encodeURIComponent(query)}&post_type=product`,

        cardSelectors: [

          ".product-item",

          ".product",

          ".product-card",

          "li.product",

          "[class*='product-item']",

          "[class*='product-card']"

        ],

        nameSelectors: [

          ".product-title",

          ".woocommerce-loop-product__title",

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
