const axios = require("axios");

const expeditionApi = axios.create({
  baseURL: "https://use.api.co.id",
  headers: {
    "x-api-co-id": process.env.SHIPPING_API_KEY,
  },
  timeout: 10000,
});

module.exports = expeditionApi;
