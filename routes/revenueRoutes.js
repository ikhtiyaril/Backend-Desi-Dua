const express = require('express');
const router = express.Router();
const { Booking, Service, Doctor, User , BlockedTime,MedicalRecord ,WalletDoctor , WithdrawRequest, sequelize} = require('../models'); // pastikan path sesuai
const { Op } = require('sequelize');
const verifyToken = require("../middleware/verifyToken");
const upload = require("../middleware/cbUploads");


router.get("/doctor/wallet", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (role !== "doctor") {
      return res.status(403).json({ message: "Doctor only" });
    }

    // ===============================
    // 1️⃣ WALLET (SALDO REAL)
    // ===============================
    const wallet = await WalletDoctor.findOne({
      where: { doctor_id: userId },
    });

    const balance = Number(wallet?.balance || 0);

    // ===============================
    // 2️⃣ AMBIL BOOKING SELESAI & PAID
    // ===============================
    const bookings = await Booking.findAll({
      where: {
        doctor_id: userId,
        status: "completed",
        payment_status: "paid",
      },
      include: [
        {
          model: Service,
          attributes: ["name", "price", "is_live"],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    let totalDoctorIncome = 0;
    let totalAppIncome = 0;

    const detail = bookings.map((booking) => {
      if (!booking.Service) return null;

      const price = Number(booking.Service.price);
      const isLive = booking.Service.is_live;

      // ===============================
      // 3️⃣ RULE PEMBAGIAN
      // ===============================
      const doctorPercent = isLive ? 0.7 : 0.9;
      const appPercent = isLive ? 0.3 : 0.1;

      const doctorIncome = price * doctorPercent;
      const appIncome = price * appPercent;

      totalDoctorIncome += doctorIncome;
      totalAppIncome += appIncome;

      return {
        booking_id: booking.id,
        booking_code: booking.booking_code,

        service_name: booking.Service.name,
        service_type: isLive ? "LIVE" : "OFFLINE",

        price,

        revenue_split: {
          doctor_percent: `${doctorPercent * 100}%`,
          app_percent: `${appPercent * 100}%`,
        },

        revenue_amount: {
          doctor_income: doctorIncome,
          app_income: appIncome,
        },

        completed_at: booking.updated_at,
      };
    }).filter(Boolean);

    // ===============================
    // 4️⃣ RESPONSE
    // ===============================
    return res.json({
      doctor_id: userId,

      wallet_balance: balance,

      summary: {
        total_doctor_income: totalDoctorIncome,
        total_app_income: totalAppIncome,
        total_transaction: detail.length,
      },

      transactions: detail,
    });

  } catch (error) {
    console.error("❌ Wallet Error:", error);
    return res.status(500).json({
      message: "Failed to load wallet data",
      error: error.message,
    });
  }
});


router.get("/doctor/withdraw", verifyToken, async (req, res) => {
    console.log("Kepegang dikit dc wd")
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (role !== "doctor") {
      return res.status(403).json({ message: "Doctor only" });
    }

    const withdraws = await WithdrawRequest.findAll({
      where: { doctor_id: userId },
      order: [["requested_at", "DESC"]],
    });

    return res.json({
      total: withdraws.length,
      data: withdraws,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to fetch withdraw history",
      error: error.message,
    });
  }
});

router.post("/doctor/withdraw", verifyToken, async (req, res) => {
  const transaction = await sequelize.transaction(); // ✅ FIXED

  try {
    const { amount, bank_name, bank_account, account_name } = req.body;
    const userId = req.user.id;

    if (req.user.role !== "doctor") {
      await transaction.rollback();
      return res.status(403).json({ message: "Doctor only" });
    }

    const withdrawAmount = Number(amount);
    if (!withdrawAmount || withdrawAmount <= 0) {
      await transaction.rollback();
      return res.status(400).json({ message: "Invalid withdraw amount" });
    }

    const wallet = await WalletDoctor.findOne({
      where: { doctor_id: userId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!wallet || Number(wallet.balance) < withdrawAmount) {
      await transaction.rollback();
      return res.status(400).json({ message: "Insufficient balance" });
    }

    wallet.balance -= withdrawAmount;
    await wallet.save({ transaction });

    const withdraw = await WithdrawRequest.create(
      {
        doctor_id: userId,
        amount: withdrawAmount,
        bank_name,
        bank_account,
        account_name,
        status: "pending",
        requested_at: new Date(),
      },
      { transaction }
    );

    await transaction.commit();

    return res.json({
      message: "Withdraw request sent",
      withdraw,
      remaining_balance: wallet.balance,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("❌ WITHDRAW ERROR:", error);
    return res.status(500).json({
      message: "Failed to request withdraw",
      error: error.message,
    });
  }
});


router.put(
  "/admin/withdraw/:id",
  verifyToken,
  upload.single("proof_image"),
  async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
      const { id } = req.params;
      const { status } = req.body;

      if (req.user?.role !== "admin") {
        await transaction.rollback();
        return res.status(403).json({ message: "Admin only" });
      }

      const withdraw = await WithdrawRequest.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!withdraw) {
        await transaction.rollback();
        return res.status(404).json({
          message: "Withdraw request not found",
        });
      }

      if (withdraw.status === "paid") {
        await transaction.rollback();
        return res.status(400).json({
          message: "Withdraw already completed",
        });
      }

      // ===============================
      // REJECT → BALIKIN SALDO
      // ===============================
      if (status === "rejected") {
        const wallet = await WalletDoctor.findOne({
          where: { doctor_id: withdraw.doctor_id },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!wallet) {
          await transaction.rollback();
          return res.status(404).json({
            message: "Doctor wallet not found",
          });
        }

        wallet.balance =
          Number(wallet.balance) + Number(withdraw.amount);
        await wallet.save({ transaction });

        withdraw.status = "rejected";
        withdraw.processed_at = new Date();
      }

      // ===============================
      // APPROVE
      // ===============================
      if (status === "approved") {
        withdraw.status = "approved";
      }

      // ===============================
      // PAID
      // ===============================
      if (status === "paid") {
        if (!req.file) {
          await transaction.rollback();
          return res.status(400).json({
            message: "Proof image required",
          });
        }

        withdraw.status = "paid";
        withdraw.proof_image = req.file.filename;
        withdraw.processed_at = new Date();
      }

      await withdraw.save({ transaction });
      await transaction.commit();

      return res.json({
        message: "Withdraw processed successfully",
        withdraw,
      });

    } catch (error) {
      await transaction.rollback();
      console.error("ADMIN WITHDRAW ERROR:", error);

      return res.status(500).json({
        message: "Failed to process withdraw",
        error: error.message,
      });
    }
  }
);


router.get("/admin/withdraw", verifyToken, async (req, res) => {
  try {
    const role = req.user?.role;

    if (role !== "admin") {
      return res.status(403).json({ message: "Admin only" });
    }

    const { status } = req.query;

    const whereClause = {};
    if (status) {
      const allowedStatus = ["pending", "approved", "rejected", "paid"];
      if (!allowedStatus.includes(status)) {
        return res.status(400).json({
          message: "Invalid status filter",
        });
      }
      whereClause.status = status;
    }

    const withdrawRequests = await WithdrawRequest.findAll({
      where: whereClause,
      include: [
        {
          model: Doctor,
          as: "doctor",
          attributes: ["id", "name", "email"],
        },
      ],
      order: [["requested_at", "DESC"]],
    });

    return res.json({
      total: withdrawRequests.length,
      data: withdrawRequests,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to fetch withdraw requests",
      error: error.message,
    });
  }
});

module.exports = router;
