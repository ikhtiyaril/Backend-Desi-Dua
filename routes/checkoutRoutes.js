const express = require("express");
const router = express.Router();
const { Product ,Cart, CartItem, Medicine, Order, OrderItem, PrescriptionAccess } = require("../models");
const verifyToken = require("../middleware/verifyToken");
const { Op } = require("sequelize");

/**
 * ===========================
 * 1. POST /checkout/validate
 * ===========================
 * Cek:
 * - stok
 * - harga terbaru
 * - akses resep (PrescriptionAccess)
 */
router.post("/validate", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("🟦 [DEBUG] Validate Checkout - User:", userId);

    const cart = await Cart.findOne({
      where: { user_id: userId },
      include: [
        {
          model: CartItem,
          as: "items",
          include: [
            {
              model: Medicine,
              as: "product"
            }
          ]
        }
      ]
    });

    console.log("🟩 [DEBUG] Cart Found:", !!cart);

    if (!cart) return res.status(404).json({ message: "Cart not found." });

    const errors = [];
    const items = cart.items;

    console.log("📦 [DEBUG] Total Items in Cart:", items.length);

    for (const item of items) {
      const product = item.product;

      console.log(`\n🔍 [DEBUG] Checking Medicine ID: ${product?.id}`);
      console.log("📝 Name:", product?.name);
      console.log("📦 Stock:", product?.stock);
      console.log("🛒 Quantity:", item.quantity);

      // 1. Cek stok
      if (product.stock < item.quantity) {
        errors.push({
          product_id: product.id,
          message: `Stok untuk ${product.name} tidak mencukupi`
        });
      }

      // 2. Cek akses resep
      if (product.is_prescription_required) {
        const access = await PrescriptionAccess.findOne({
          where: {
            user_id: userId,
            product_id: product.id,
            status: "approved"
          }
        });

        if (!access) {
          errors.push({
            product_id: product.id,
            message: `${product.name} membutuhkan akses resep`
          });
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    return res.json({ success: true, message: "Checkout valid." });

  } catch (err) {
    console.error("💥 [DEBUG] Server Error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});




/**
 * =====================
 * 2. POST /checkout
 * =====================
 * Proses:
 * - validate ulang
 * - create order
 * - create orderItem
 * - update stok
 * - clear cart
 */
router.post("/", verifyToken, async (req, res) => {
  console.log("\n==============================");
  console.log("🛒 CHECKOUT START");
  console.log("TIME:", new Date().toISOString());
  console.log("==============================\n");

  const t = await Cart.sequelize.transaction();

  try {
    const userId = req.user.id;

    console.log("👤 USER ID:", userId);

    // ===============================
    // GET CART
    // ===============================
    console.log("\n📦 FETCH CART");

    const cart = await Cart.findOne({
      where: { user_id: userId },
      include: [
        {
          model: CartItem,
          as: "items",
          include: [
            { model: Medicine, as: "product" }
          ]
        }
      ],
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    console.log("CART RESULT:");
    console.dir(cart?.toJSON() || cart, { depth: null });

    if (!cart) {
      console.log("❌ CART NOT FOUND");
      await t.rollback();
      return res.status(404).json({ message: "Cart not found." });
    }

    const items = cart.items;

    console.log("\n📦 CART ITEMS COUNT:", items.length);

    if (!items || items.length === 0) {
      console.log("❌ CART EMPTY");
      await t.rollback();
      return res.status(400).json({
        message: "Cart kosong"
      });
    }

    let totalPrice = 0;

    // ===============================
    // VALIDATION
    // ===============================
    console.log("\n🔎 VALIDATING ITEMS");

    for (const item of items) {
      const med = item.product;

      console.log("\nITEM:");
      console.log("name:", med.name);
      console.log("price:", med.price);
      console.log("stock:", med.stock);
      console.log("qty:", item.quantity);

      if (med.stock < item.quantity) {
        console.log("❌ STOCK NOT ENOUGH:", med.name);

        await t.rollback();
        return res.status(400).json({
          message: `Stok tidak cukup untuk ${med.name}`
        });
      }

      // ===============================
      // PRESCRIPTION CHECK
      // ===============================
      if (med.is_prescription_required) {

        console.log("💊 NEED PRESCRIPTION:", med.name);

        const access = await PrescriptionAccess.findOne({
          where: {
            user_id: userId,
            product_id: med.id,
            status: "approved"
          },
          transaction: t
        });

        console.log("PRESCRIPTION ACCESS:", access);

        if (!access) {
          console.log("❌ PRESCRIPTION NOT APPROVED");

          await t.rollback();
          return res.status(403).json({
            message: `${med.name} membutuhkan akses resep.`
          });
        }
      }

      const itemTotal = med.price * item.quantity;

      console.log("ITEM TOTAL:", itemTotal);

      totalPrice += itemTotal;
    }

    console.log("\n💰 TOTAL PRICE:", totalPrice);

    // ===============================
    // CREATE ORDER
    // ===============================
    console.log("\n🧾 CREATE ORDER");
const orderCode = `ORD-${Math.floor(Date.now()/1000)}-${userId}`;
    const order = await Order.create(
      {
        order_code: orderCode,
        user_id: userId,
        total_price: totalPrice,
        status: "pending",
        payment_method: req.body.payment_method || "manual"
      },
      { transaction: t }
    );

    console.log("ORDER CREATED:");
    console.dir(order.toJSON(), { depth: null });

    // ===============================
    // CREATE ORDER ITEMS
    // ===============================
    console.log("\n📦 CREATE ORDER ITEMS");

    for (const item of items) {
      const med = item.product;

      console.log("INSERT ORDER ITEM:", med.name);

      await OrderItem.create(
        {
          order_id: order.id,
          product_id: med.id,
          quantity: item.quantity,
          price: med.price
        },
        { transaction: t }
      );

      console.log("UPDATE STOCK:", med.name);

      await Medicine.update(
        { stock: med.stock - item.quantity },
        {
          where: { id: med.id },
          transaction: t
        }
      );
    }

    // ===============================
    // CLEAR CART
    // ===============================
    console.log("\n🧹 CLEAR CART");

    await CartItem.destroy({
      where: { cart_id: cart.id },
      transaction: t
    });

    console.log("CART CLEARED");

    await t.commit();

    console.log("\n✅ CHECKOUT SUCCESS");
    console.log("ORDER ID:", order.id);

    return res.json({
      success: true,
      message: "Order created",
      order
    });

  } catch (err) {

    console.log("\n❌ CHECKOUT ERROR");
    console.log("MESSAGE:", err.message);
    console.error(err.stack);

    await t.rollback();

    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
});
module.exports = router;
