const express = require("express");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());


// Test route
app.get("/", (req, res) => {

  res.json({
    success: true,
    message: "PriceFinder backend is running 🚀"
  });

});


// Product search route
app.get("/api/search", (req, res) => {

  const query = req.query.q || "";

  res.json({
    success: true,
    query: query,
    results: []
  });

});


app.listen(PORT, () => {

  console.log(
    `PriceFinder backend running on port ${PORT}`
  );

});
