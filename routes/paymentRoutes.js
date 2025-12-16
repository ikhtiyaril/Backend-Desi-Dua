const express = require('express')
const axios = require('axios')
const crypto =require('crypto')
const verifyToken = require("../middleware/verifyToken");
const {PaymentSession} = require("../models")
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const response = await axios.get(
      `${process.env.TRIPAY_URL}/merchant/payment-channel`,
      {
        headers: {
          Authorization: `Bearer ${process.env.API_KEY_TRIPAY}`
        },
        timeout: 10000 // biar ga ngadat kalau Tripay lambat
      }
    );

    return res.status(200).json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error("Tripay Error:", error.response?.data || error.message);

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
    const { name, email, phone } = req.user;

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

router.post("/callback", express.json({ verify: rawBodySaver }), (req, res) => {
  try {
    // 1. Verifikasi signature
    const signature = req.headers["x-callback-signature"];
    const expected = crypto
      .createHmac("sha256", process.env.PRIVATE_KEY_TRIPAY)
      .update(req.rawBody)
      .digest("hex");

    if (signature !== expected) {
      return res.status(403).json({
        success: false,
        message: "Invalid signature"
      });
    }

    // 2. Proses datanya
    const data = req.body;

    if (data.status === "PAID") {
      // update database: order -> PAID
    }

    // 3. BALAS sesuai permintaan Tripay
    return res.status(200).json({
      success: true,
      message: "Callback accepted"
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

function rawBodySaver(req, res, buf) {
  req.rawBody = buf.toString();
}

router.post("/checkout",verifyToken, async (req, res) => {
  try {
    const {
      amount,
      paymentMethod, // e.g. QRIS, BCAVA, dll
      orderItems, // optional
      reference,
      id // optional custom ref
    } = req.body;

    const {name, email, phone} = req.user
    
console.log(amount,
      paymentMethod, // e.g. QRIS, BCAVA, dll
      orderItems, // optional
      reference,name, email, phone)


    if (!name || !email || !phone || !amount || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    // TRIPAY CREDS
    const API_KEY = process.env.API_KEY_TRIPAY;
    const MERCHANT_CODE = process.env.MERCHANT_TRIPAY;
    const PRIVATE_KEY = process.env.PRIVATE_KEY_TRIPAY;

    // GENERATE SIGNATURE
    const crypto = await import("crypto");
    const signature = crypto.createHmac("sha256", PRIVATE_KEY)
      .update(MERCHANT_CODE + reference + amount)
      .digest("hex");

    // REQUEST BODY KE TRIPAY
    const payload = {
      method: paymentMethod,
      merchant_ref: reference || `REF-${Date.now()}`,
      amount: amount,
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      order_items: orderItems || [],
      expired_time: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
      signature: signature,
    };

    const tripayResponse = await axios.post(
      `${process.env.TRIPAY_URL}/transaction/create`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

await PaymentSession.create({
related_type : 'order',
related_id : id,
session_data : tripayResponse.data
})


    return res.status(200).json({
      success: true,
      message: "Checkout berhasil dibuat",
      data: tripayResponse.data
    });

  } catch (error) {
    console.error("Tripay Checkout Error:", error.response?.data || error);

    return res.status(500).json({
      success: false,
      message: "Gagal membuat transaksi",
      error: error.response?.data || error
    });
  }
});

router.get("/session", verifyToken, async (req, res) => {
  try {
    const { type, id } = req.query;

    if (!type || !id) {
      return res.status(400).json({ message: "type and id are required" });
    }

    const session = await PaymentSession.findOne({
      where: {
        related_type: type,
        related_id: id,
        status: "UNPAID",
      },
    });

    return res.json({ success: true, session });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to get payment session" });
  }
});

module.exports = router;