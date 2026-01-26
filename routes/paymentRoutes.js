const express = require('express')
const axios = require('axios')
const crypto =require('crypto')
const verifyToken = require("../middleware/verifyToken");
const {PaymentSession,Order,Booking} = require("../models")
const router = express.Router();
const { Sequelize } = require("sequelize");








router.get('/', async (req, res) => {
  console.log("\n========== [TRIPAY PAYMENT CHANNEL] ==========");
  console.log("➡️ HIT ENDPOINT : GET /api/payment");
  console.log("⏰ TIME        :", new Date().toISOString());
  console.log("🌍 TRIPAY URL  :", process.env.TRIPAY_URL);
  console.log("🔑 API KEY OK? :", !!process.env.API_KEY_TRIPAY);

  try {
    console.log("➡️ REQUESTING TRIPAY...");

    const response = await axios.get(
      `${process.env.TRIPAY_URL}/merchant/payment-channel`,
      {
        headers: {
          Authorization: `Bearer ${process.env.API_KEY_TRIPAY}`,
          "Content-Type": "application/json"
        },
        timeout: 10000
      }
    );

    console.log("✅ TRIPAY RESPONSE RECEIVED");
    console.log("Status Code :", response.status);
    console.log("Response Data :", response.data);

    return res.status(200).json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error("❌ TRIPAY REQUEST FAILED");

    // ================= AXIOS ERROR DETAIL =================
    if (error.response) {
      console.error("📛 RESPONSE ERROR");
      console.error("Status :", error.response.status);
      console.error("Data   :", error.response.data);
    } else if (error.request) {
      console.error("📡 NO RESPONSE FROM TRIPAY");
      console.error(error.request);
    } else {
      console.error("⚠️ AXIOS ERROR");
      console.error("Message :", error.message);
    }

    console.error("🔍 FULL ERROR :", error);

    return res.status(error.response?.status || 500).json({
      success: false,
      message: "Failed to fetch payment channel",
      error: error.response?.data || error.message
    });
  }
});


router.post('/', verifyToken, async (req, res) => {
  try {
    console.log("\n===== [PAYMENT DEBUG] Incoming Request =====");
    console.log("Body:", req.body);
    console.log("User:", req.user);

    const { method, merchant_ref, amount, order_items,id } = req.body;
    console.log("YANG INI ADAKAH?")
    console.log(req.user.data.dataValues)
const { name, phone, email } = req.user.data.dataValues;
console.log("INI CONSOLE LOG BUAT REQ USER")
    console.log(name,email,phone)
    let signature = crypto
      .createHmac("sha256", process.env.PRIVATE_KEY_TRIPAY)
      .update(process.env.MERCHANT_TRIPAY + merchant_ref + amount)
      .digest("hex");

    const payload = {
      method,
      merchant_ref,
      amount,
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      order_items,
      signature,
    };

    console.log("\n===== [PAYMENT DEBUG] Payload to Tripay =====");
    console.log(payload);

    const response = await axios.post(
      `${process.env.TRIPAY_URL}/transaction/create`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.API_KEY_TRIPAY}`,
        },
        validateStatus: () => true, // biar error tetap kebaca
      }
    );

    
await PaymentSession.create({
related_type : 'booking',
related_id : id,
session_data : response.data
})

    // Jangan kirim axios response object ke frontend (berantakan)
    res.json(response.data);

  } catch (e) {
    console.log("\n===== [PAYMENT ERROR] =====");
    console.log("Message:", e.message);
    console.log("Stack:", e.stack);

    if (e.response) {
      console.log("\n===== [PAYMENT ERROR RESPONSE from Tripay] =====");
      console.log({
        status: e.response.status,
        data: e.response.data,
      });
    }

    res.status(500).json({
      success: false,
      message: "Gagal membuat transaksi Tripay",
      error: e.message,
    });
  }
});


router.post('/fee', async (req, res) => {
  try {
    const { code, amount } = req.body;

    const response = await axios.get(
      `${process.env.TRIPAY_URL}/merchant/fee-calculator?code=${code}&amount=${amount}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.API_KEY_TRIPAY}`
        }
      }
    );

    res.json(response.data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Fee error" });
  }
});


/* ================= RAW BODY SAVER ================= */



router.post("/checkout", verifyToken, async (req, res) => {
  try {
    console.log("\n========== PAYMENT CHECKOUT ==========");
console.log("INI BODY",req.body)
console.log("INI USER",req.user)
    const { amount, paymentMethod, orderItems = [], reference, id } = req.body;
    const { name, email, phone, id: userId } = req.user;

    if (!name || !email || !phone || !amount || !paymentMethod || !id) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // ===============================
    // CHECK ORDER
    // ===============================
    const order = await Order.findByPk(id);
    if (!order || order.user_id !== userId) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // ===============================
    // CHECK EXISTING PAYMENT
    // ===============================
    const existing = await PaymentSession.findOne({
      where: {
        related_type: "order",
        related_id: id,
        status: "UNPAID"
      }
    });

    if (existing) {
      return res.json({
        success: true,
        message: "Using existing payment session",
        data: existing.session_data
      });
    }

    // ===============================
    // TRIPAY CREDS
    // ===============================
    const API_KEY = process.env.API_KEY_TRIPAY;
    const MERCHANT_CODE = process.env.MERCHANT_TRIPAY;
    const PRIVATE_KEY = process.env.PRIVATE_KEY_TRIPAY;

    const merchantRef = reference || `ORDER-${id}`;

    // ===============================
    // AMOUNT NORMALIZATION
    // ===============================
    const tripayAmount = Math.floor(Number(amount));
    if (!tripayAmount || tripayAmount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }

    // ===============================
    // SIGNATURE
    // ===============================
    const signString = MERCHANT_CODE + merchantRef + tripayAmount;
    const signature = crypto
      .createHmac("sha256", PRIVATE_KEY)
      .update(signString)
      .digest("hex");

    // ===============================
    // FIX ORDER ITEMS
    // ===============================
    const fixedOrderItems = orderItems.map(item => ({
      name: item.name,
      quantity: item.quantity,
      price: Math.floor(Number(item.price))
    }));

    // ===============================
    // PAYLOAD
    // ===============================
    const payload = {
      method: paymentMethod,
      merchant_ref: merchantRef,
      amount: tripayAmount,
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      order_items: fixedOrderItems,
      expired_time: Math.floor(Date.now() / 1000) + 86400,
      signature
    };

    // ===============================
    // SEND TO TRIPAY
    // ===============================
    const tripayRes = await axios.post(
      `${process.env.TRIPAY_URL}/transaction/create`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

   const paymentData = tripayRes.data.data;

await PaymentSession.create({
  related_type: "order",
  related_id: id,
  merchant_ref: merchantRef,
  status: paymentData.status,      // ✅ BENAR
  session_data: tripayRes.data        // ✅ BENAR
});

    // ===============================
    // UPDATE ORDER
    // ===============================
    await Order.update(
      {
        payment_status: paymentData.status,
        payment_method: paymentMethod
      },
      { where: { id } }
    );

    return res.json({
      success: true,
      message: "Checkout berhasil dibuat",
      data: paymentData
    });

  } catch (error) {
    console.error("TRIPAY ERROR:", error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: "Gagal membuat transaksi",
      error: error.response?.data || error.message
    });
  }
});

router.get("/session", verifyToken, async (req, res) => {
   console.log("SESSION ENDPOINT HIT");
  try {
    const { id, type } = req.query;

    if (!id) {
      return res.status(400).json({ message: "order id is required" });
    }

    // 🔐 whitelist type
    const ALLOWED_TYPES = ["booking", "order"];
    const related_type = ALLOWED_TYPES.includes(type) ? type : "order";

    const session = await PaymentSession.findOne({
      where: {
        related_type,
        related_id: id,
        status: "UNPAID",
      },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Payment session tidak ditemukan",
      });
    }

    return res.json({
      success: true,
      session,
    });
  } catch (err) {
    console.error("GET PAYMENT SESSION ERROR:", err);
    return res.status(500).json({ message: "Failed to get payment session" });
  }
});


module.exports = router;