const genericSearch =
  require("./genericstore");

module.exports =
  function searchInfoTechs(searchTerm) {

    return genericSearch(
      searchTerm,
      {

        storeName:
          "InfoTechs Nepal",

        logName:
          "InfoTechs Nepal",

        baseUrl:
          "https://infotechsnepal.com.np",

        searchUrl:
          query =>
            `https://infotechsnepal.com.np/?s=${encodeURIComponent(query)}&post_type=product`,

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
