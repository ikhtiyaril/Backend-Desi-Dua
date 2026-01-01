const axios = require("axios");

const shippingApi = axios.create({
  baseURL: process.env.SHIPPING_BASE_URL,
  headers: {
    "x-api-co-id": process.env.SHIPPING_API_KEY, // 🔥 WAJIB INI
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

module.exports = shippingApi;
