const genericSearch =
  require("./genericstore");

module.exports =
  function searchSthree(searchTerm) {

    return genericSearch(
      searchTerm,
      {

        storeName:
          "S3 Tech",

        logName:
          "S3 Tech",

        baseUrl:
          "https://sthree.tech",

        searchUrl:
          query =>
            `https://sthree.tech/?s=${encodeURIComponent(query)}&post_type=product`,

        cardSelectors: [

          ".product",

          ".product-card",

          "li.product",

          ".wc-block-grid__product",

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
