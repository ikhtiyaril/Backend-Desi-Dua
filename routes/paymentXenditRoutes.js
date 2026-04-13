// ============================================================
// IMPORT DEPENDENCY
// ============================================================

// express digunakan untuk membuat router API
const express = require('express')

// axios dipakai untuk melakukan HTTP request ke API Xendit
const axios = require('axios')

// middleware untuk memastikan user sudah login / token valid
const verifyToken = require('../middleware/verifyToken')

// model database Sequelize
// PaymentSession = menyimpan sesi pembayaran
// Order = data order produk
// Booking = data booking layanan
const { PaymentSession, Order, Booking } = require('../models')

// router express
const router = express.Router()


// ============================================================
// HELPER: MEMBUAT HEADER AUTHORIZATION XENDIT
// ============================================================

/*
Xendit menggunakan Basic Auth.

Format header:
Authorization: Basic base64(API_KEY:)

Jadi API key harus di encode ke base64.
Contoh:
xnd_development_xxxxxx:
↓

Base64 → eG5kX2RldmVsb3BtZW50X3h4eHg6
*/
function xenditAuthHeader() {

  // ambil secret key dari environment
  const secret = process.env.XENDIT_SECRET_KEY || ''

  // encode ke base64
  const token = Buffer.from(`${secret}:`).toString('base64')

  // kembalikan format header authorization
  return `Basic ${token}`
}


// ============================================================
// ENDPOINT: GET /api/payment
// ============================================================

/*
Endpoint ini tidak benar-benar memanggil API Xendit.

Fungsinya hanya sebagai:
1. Health check API payment
2. Mengetahui apakah konfigurasi webhook sudah ada
*/

router.get('/', async (req, res) => {

  console.log('➡️ HIT ENDPOINT : GET /api/payment (Xendit health/check)')

  try {

    // hanya mengembalikan informasi konfigurasi
    return res.json({
      success: true,
      provider: 'xendit',
      docs: 'https://docs.xendit.co',

      // mengecek apakah webhook token sudah diset
      webhookConfigured: !!process.env.XENDIT_WEBHOOK_TOKEN
    })

  } catch (err) {

    console.error('GET /api/payment error', err)

    return res.status(500).json({
      success: false,
      message: 'Xendit check failed',
      error: err.message
    })

  }
})


// ============================================================
// ENDPOINT: POST /api/payment
// ============================================================

/*
Endpoint ini digunakan untuk membuat invoice pembayaran di Xendit.

Flow:

Frontend
↓
POST /api/payment
↓
Backend kirim request ke Xendit
↓
Xendit membuat invoice
↓
Backend menyimpan PaymentSession
↓
Frontend redirect ke invoice_url
*/

router.post('/', verifyToken, async (req, res) => {

  console.log("\n========================================");
  console.log("🔥 [PAYMENT] CREATE INVOICE START");
  console.log("TIME:", new Date().toISOString());
  console.log("ENDPOINT: POST /api/payment");
  console.log("========================================\n");

  try {

    // ======================================================
    // REQUEST INFO
    // ======================================================

    console.log("📦 REQUEST BODY:");
    console.dir(req.body, { depth: null });

    const { merchant_ref, amount, order_items = [], id } = req.body;

    console.log("\n📊 RAW PAYMENT DATA:");
    console.log("merchant_ref:", merchant_ref);
    console.log("amount:", amount);
    console.log("order_id:", id);
    console.log("order_items_count:", order_items.length);


    // ======================================================
    // USER FROM TOKEN
    // ======================================================

    const user = req.user?.data?.dataValues || {};

    console.log("\n👤 USER FROM TOKEN:");
    console.dir(user, { depth: null });

    const { name, email, phone } = user;

    console.log("\n👤 USER INFO:");
    console.log("name:", name);
    console.log("email:", email);
    console.log("phone:", phone);


    // ======================================================
    // VALIDATION
    // ======================================================

    console.log("\n🧪 VALIDATION CHECK:");

    if (!merchant_ref || !amount || !id || !name || !email) {

      console.log("❌ VALIDATION FAILED");
      console.log({
        merchant_ref,
        amount,
        id,
        name,
        email
      });

      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    console.log("✅ VALIDATION PASSED");


    // ======================================================
    // FORMAT ITEMS
    // ======================================================

    console.log("\n📦 MAPPING ORDER ITEMS:");

    const items = (order_items || []).map(it => {

      const item = {
        name: it.name,
        price: Math.floor(Number(it.price) || 0),
        quantity: Number(it.quantity || 1)
      };

      console.log("ITEM:", item);

      return item;
    });


    // ======================================================
    // BUILD PAYLOAD
    // ======================================================

    const externalId = merchant_ref;

    const payload = {
      external_id: externalId,
      amount: Math.floor(Number(amount)),
      payer_email: email,
      description: `Payment for ${externalId}`,
      items,
      success_redirect_url: process.env.XENDIT_SUCCESS_REDIRECT || undefined,
      failure_redirect_url: process.env.XENDIT_FAILURE_REDIRECT || undefined,
      should_send_email: false
    };

    console.log("\n🚀 XENDIT PAYLOAD:");
    console.dir(payload, { depth: null });


    // ======================================================
    // CALL XENDIT
    // ======================================================

    console.log("\n📡 CALLING XENDIT API...");

    const startTime = Date.now();

    const xenditRes = await axios.post(
      'https://api.xendit.co/v2/invoices',
      payload,
      {
        headers: {
          Authorization: xenditAuthHeader(),
          'Content-Type': 'application/json'
        },
        timeout: 10000,
        validateStatus: () => true
      }
    );

    const duration = Date.now() - startTime;

    console.log("\n✅ XENDIT RESPONSE RECEIVED");
    console.log("Status:", xenditRes.status);
    console.log("Duration:", duration, "ms");

    console.log("\n📥 XENDIT RESPONSE BODY:");
    console.dir(xenditRes.data, { depth: null });


    // ======================================================
    // SAVE PAYMENT SESSION
    // ======================================================

    console.log("\n💾 SAVING PAYMENT SESSION...");

    const session = await PaymentSession.create({
      related_type: 'booking',
      related_id: id,
      merchant_ref: externalId,
      status: xenditRes.data.status || 'PENDING',
      session_data: xenditRes.data,
      url_payment : xenditRes.data.invoice_url
    });

    console.log("✅ PAYMENT SESSION SAVED:");
    console.dir(session?.dataValues || session, { depth: null });


    // ======================================================
    // UPDATE ORDER
    // ======================================================

    console.log("\n📝 UPDATING ORDER PAYMENT STATUS...");

    await Order.update(
      {
        payment_status: xenditRes.data.status || 'PENDING',
        payment_method: 'XENDIT_INVOICE'
      },
      { where: { id } }
    );

    console.log("✅ ORDER UPDATED:", id);


    // ======================================================
    // SUCCESS RESPONSE
    // ======================================================

    console.log("\n🎉 PAYMENT INVOICE CREATED SUCCESSFULLY");

    return res.json({
      success: true,
      message: 'Invoice created',
      data: xenditRes.data,
      url_payment : xenditRes.data.invoice_url
    });

  } catch (err) {

    console.log("\n========================================");
    console.log("❌ PAYMENT ERROR OCCURRED");
    console.log("========================================");

    console.log("ERROR MESSAGE:", err.message);

    if (err.response) {
      console.log("\n📡 XENDIT ERROR RESPONSE:");
      console.log("Status:", err.response.status);

      console.log("Body:");
      console.dir(err.response.data, { depth: null });
    }

    console.log("\nSTACK TRACE:");
    console.error(err.stack);

    return res.status(500).json({
      success: false,
      message: 'Gagal membuat invoice Xendit',
      error: err.response?.data || err.message
    });

  }

});


// ============================================================
// ENDPOINT: POST /api/payment/checkout
// ============================================================

/*
Endpoint ini lebih kompleks.

Flow:

Frontend klik bayar
↓
Backend cek order
↓
Backend cek apakah sudah ada payment session
↓
Jika belum → buat invoice
↓
Simpan payment session
*/

router.post('/checkout', verifyToken, async (req, res) => {

  console.log("\n==============================")
  console.log("🔥 PAYMENT CHECKOUT START")
  console.log("TIME:", new Date().toISOString())
  console.log("ENDPOINT: POST /api/payment/checkout")
  console.log("==============================\n")

  try {

    console.log("📦 REQUEST BODY:")
    console.dir(req.body, { depth: null })

    const { amount, orderItems = [], reference, id , shipping_cost  } = req.body

    console.log("\n💰 RAW PAYMENT DATA")
    console.log("amount:", amount)
    console.log("shipping_cost:", shipping_cost)
    console.log("reference:", reference)
    console.log("order_id:", id)


    const user = req.user?.data?.dataValues || {}

    console.log("\n👤 USER FROM TOKEN")
    console.dir(user, { depth: null })

const { id: userId, name, email, phone } = user

    if (!userId || !name || !email || !phone || !amount) {

      console.log("❌ VALIDATION FAILED")
      console.log({ name, email, phone, amount, userId })

      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      })

    }


    // ======================================================
    // CEK ORDER
    // ======================================================

    console.log("\n🔎 FIND ORDER BY ID:", id)

    const order = await Order.findByPk(id)

    console.log("ORDER RESULT:")
    console.dir(order?.dataValues || order, { depth: null })


    if (!order) {

      console.log("❌ ORDER NOT FOUND")

      return res.status(404).json({
        success: false,
        message: 'Order not found'
      })
    }


    if (order.user_id !== userId) {

      console.log("❌ ORDER USER MISMATCH")
      console.log("order.user_id:", order.user_id)
      console.log("token.user_id:", userId)

      return res.status(403).json({
        success: false,
        message: 'Unauthorized order access'
      })
    }


    // ======================================================
    // CEK PAYMENT SESSION
    // ======================================================

    console.log("\n🔎 CHECK EXISTING PAYMENT SESSION")

    const existing = await PaymentSession.findOne({
      where: {
        related_type: 'order',
        related_id: id,
        status: 'UNPAID'
      }
    })

    console.log("EXISTING SESSION:")
    console.dir(existing?.dataValues || existing, { depth: null })


    if (existing) {

      console.log("♻️ USING EXISTING PAYMENT SESSION")

      return res.json({
        success: true,
        message: 'Using existing payment session',
        data: existing.session_data
      })

    }


    // ======================================================
    // HITUNG TOTAL
    // ======================================================

    const total = Math.floor(Number(amount) + Number(shipping_cost || 0))

    console.log("\n🧮 PAYMENT CALCULATION")
    console.log("amount:", amount)
    console.log("shipping_cost:", shipping_cost)
    console.log("TOTAL:", total)


    if (!total || total <= 0) {

      console.log("❌ INVALID TOTAL PAYMENT")

      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      })

    }


    const merchantRef = reference || `ORDER-${id}`

    console.log("\n🏷 MERCHANT REF:", merchantRef)


    // ======================================================
    // MAPPING ITEMS
    // ======================================================

    console.log("\n📦 MAPPING ORDER ITEMS")

    const items = (orderItems || []).map(i => {

      const item = {
        name: i.name,
        price: Math.floor(Number(i.price || 0)),
        quantity: Number(i.quantity || 1)
      }

      console.log("ITEM:", item)

      return item
    })


    if (shipping_cost > 0) {

      const shippingItem = {
        name: 'Biaya Pengiriman',
        price: Math.floor(Number(shipping_cost)),
        quantity: 1
      }

      console.log("ADD SHIPPING ITEM:", shippingItem)

      items.push(shippingItem)
    }


    // ======================================================
    // PAYLOAD XENDIT
    // ======================================================

    const payload = {
      external_id: merchantRef,
      amount: total,
      payer_email: email,
      description: `Order #${id}`,
      items,
      success_redirect_url: process.env.XENDIT_SUCCESS_REDIRECT,
      failure_redirect_url: process.env.XENDIT_FAILURE_REDIRECT,
      should_send_email: false
    }

    console.log("\n🚀 SEND PAYLOAD TO XENDIT")
    console.dir(payload, { depth: null })


    // ======================================================
    // REQUEST KE XENDIT
    // ======================================================

    console.log("\n📡 CALL XENDIT API...")

    const tripayRes = await axios.post(
      'https://api.xendit.co/v2/invoices',
      payload,
      {
        headers: {
          Authorization: xenditAuthHeader(),
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    )

    console.log("\n✅ XENDIT RESPONSE STATUS:", tripayRes.status)

    console.log("XENDIT RESPONSE BODY:")
    console.dir(tripayRes.data, { depth: null })


    const paymentData = tripayRes.data


    // ======================================================
    // SIMPAN PAYMENT SESSION
    // ======================================================

    console.log("\n💾 SAVING PAYMENT SESSION")

    
const invoiceUrl = paymentData.invoice_url

const session = await PaymentSession.create({
  related_type: 'order',
  related_id: id,
  merchant_ref: merchantRef,
  status: paymentData.status || 'PENDING',
  url_payment: invoiceUrl,
  session_data: paymentData
})

    console.log("PAYMENT SESSION SAVED:")
    console.dir(session?.dataValues || session, { depth: null })


    // ======================================================
    // UPDATE ORDER
    // ======================================================

    console.log("\n📝 UPDATE ORDER PAYMENT STATUS")

    await Order.update(
      {
        payment_status: paymentData.status || 'PENDING',
        
        payment_method: 'XENDIT_INVOICE'
      },
      { where: { id } }
    )

    console.log("ORDER UPDATED:", id)


    console.log("\n🎉 CHECKOUT SUCCESS")

    return res.json({
      success: true,
      message: 'Checkout berhasil dibuat',
      data: paymentData
    })

  } catch (error) {

    console.log("\n❌ CHECKOUT ERROR OCCURRED")

    console.log("ERROR MESSAGE:", error.message)

    if (error.response) {

      console.log("XENDIT ERROR STATUS:", error.response.status)

      console.log("XENDIT ERROR DATA:")
      console.dir(error.response.data, { depth: null })

    }

    console.log("STACK TRACE:")
    console.error(error.stack)

    return res.status(500).json({
      success: false,
      message: 'Gagal membuat transaksi',
      error: error.response?.data || error.message
    })

  }

})

module.exports = router;
