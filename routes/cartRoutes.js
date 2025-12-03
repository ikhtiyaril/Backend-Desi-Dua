const express = require("express");
const router = express.Router();

const { Cart, CartItem, Medicine } = require("../models");
const verifyToken = require("../middleware/verifyToken");


// ============================
// 1. GET /cart → ambil keranjang user
// ============================
router.get("/", verifyToken, async (req, res) => {
  try {
    let cart = await Cart.findOne({
      where: { user_id: req.user.id },
      include: [
        {
          model: CartItem,
          as: "items",
          include: [{ model: Medicine, as: "product" }],
        },
      ],
    });

    // kalau cart belum ada → auto create
    if (!cart) {
      cart = await Cart.create({ user_id: req.user.id });
    }

    res.json({ success: true, data: cart });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// ============================
// 2. POST /cart/add → tambah item
// ============================
router.post("/add", verifyToken, async (req, res) => {
  try {
    const { product_id, quantity } = req.body;

    if(!quantity){
      quantity = 1
    }

    const product = await Medicine.findByPk(product_id);
    if (!product)
      return res.status(404).json({ success: false, message: "Produk tidak ditemukan." });

    // cari cart user
    let cart = await Cart.findOne({ where: { user_id: req.user.id } });

    // kalau belum ada → bikin baru
    if (!cart) {
      cart = await Cart.create({ user_id: req.user.id });
    }

    // cek apakah item sudah ada di cart
    const existingItem = await CartItem.findOne({
      where: { cart_id: cart.id, product_id },
    });

    if (existingItem) {
      // update qty
      existingItem.quantity += quantity || 1;
      await existingItem.save();
      return res.json({ success: true, data: existingItem, message: "Qty ditambah." });
    }

    // bikin item baru
    const item = await CartItem.create({
      cart_id: cart.id,
      product_id,
      quantity: quantity || 1,
    });

    res.json({ success: true, data: item, message: "Item ditambahkan ke keranjang." });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// ============================
// 3. PUT /cart/update/:cartItemId → update qty
// ============================
router.put("/update/:cartItemId", verifyToken, async (req, res) => {
  try {
    const { quantity } = req.body;

    const item = await CartItem.findByPk(req.params.cartItemId);

    if (!item)
      return res.status(404).json({ success: false, message: "Item tidak ditemukan." });

    // minimal qty 1
    item.quantity = Math.max(1, quantity);
    await item.save();

    res.json({ success: true, data: item, message: "Qty berhasil diupdate." });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// ============================
// 4. DELETE /cart/remove/:cartItemId → hapus item cart
// ============================
router.delete("/remove/:cartItemId", verifyToken, async (req, res) => {
  try {
    const item = await CartItem.findByPk(req.params.cartItemId);

    if (!item)
      return res.status(404).json({ success: false, message: "Item tidak ditemukan." });

    await item.destroy();

    res.json({ success: true, message: "Item dihapus dari keranjang." });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// ============================
// 5. DELETE /cart/clear → kosongkan keranjang
// ============================
router.delete("/clear", verifyToken, async (req, res) => {
  try {
    const cart = await Cart.findOne({ where: { user_id: req.user.id } });

    if (!cart)
      return res.json({ success: true, message: "Keranjang sudah kosong." });

    await CartItem.destroy({ where: { cart_id: cart.id } });

    res.json({ success: true, message: "Keranjang berhasil dikosongkan." });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


module.exports = router;
