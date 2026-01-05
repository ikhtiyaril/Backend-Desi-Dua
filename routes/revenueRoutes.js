const express = require('express');
const router = express.Router();
const { Booking, Service, Doctor, User , BlockedTime,MedicalRecord ,WalletDoctor} = require('../models'); // pastikan path sesuai
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
    // 1️⃣ Wallet
    // ===============================
    const wallet = await WalletDoctor.findOne({
      where: { doctor_id: userId },
    });

    const balance = wallet?.balance || 0;

    // ===============================
    // 2️⃣ Wallet Transactions (INCOME)
    // ===============================
    const transactions = await WalletTransaction.findAll({
      where: {
        doctor_id: userId,
        type: "credit",
        source: "booking",
      },
      order: [["created_at", "DESC"]],
    });

    let totalDoctorIncome = 0;
    let totalAppIncome = 0;

    const detail = transactions.map((trx) => {
      const price = trx.service_price;
      const isLive = trx.is_live;

      // ===============================
      // 3️⃣ Revenue Rule
      // ===============================
      const doctorPercent = isLive ? 0.7 : 0.9;
      const appPercent = isLive ? 0.3 : 0.1;

      const doctorIncome = trx.doctor_income;
      const appIncome = trx.app_income;

      totalDoctorIncome += doctorIncome;
      totalAppIncome += appIncome;

      return {
        transaction_id: trx.id,
        service_name: trx.service_name,
        service_type: isLive ? "Live Consultation" : "Non-Live Service",
        price,

        revenue_split: {
          doctor_percent: doctorPercent * 100 + "%",
          app_percent: appPercent * 100 + "%",
        },

        revenue_amount: {
          doctor_income: doctorIncome,
          app_income: appIncome,
        },

        created_at: trx.created_at,
      };
    });

    // ===============================
    // 4️⃣ Response
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
    console.error(error);
    return res.status(500).json({
      message: "Failed to load finance data",
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
  const transaction = await sequelize.transaction();

  try {
    const { amount, bank_name, bank_account, account_name } = req.body;
    const userId = req.user?.id;
    const role = req.user?.role;

    if (role !== "doctor") {
      return res.status(403).json({ message: "Doctor only" });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid withdraw amount" });
    }

    const wallet = await WalletDoctor.findOne({
      where: { doctor_id: userId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!wallet || Number(wallet.balance) < amount) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Insufficient wallet balance",
      });
    }

    // HOLD SALDO
    wallet.balance = Number(wallet.balance) - amount;
    await wallet.save({ transaction });

    const withdraw = await WithdrawRequest.create(
      {
        doctor_id: userId,
        amount,
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
    console.error(error);
    res.status(500).json({
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
      const role = req.user?.role;

      if (role !== "admin") {
        return res.status(403).json({ message: "Admin only" });
      }

      const withdraw = await WithdrawRequest.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!withdraw) {
        await transaction.rollback();
        return res.status(404).json({ message: "Withdraw request not found" });
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

        wallet.balance =
          Number(wallet.balance) + Number(withdraw.amount);
        await wallet.save({ transaction });

        withdraw.status = "rejected";
        withdraw.processed_at = new Date();
      }

      // ===============================
      // APPROVE / PAID
      // ===============================
      if (status === "approved") {
        withdraw.status = "approved";
      }

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
      console.error(error);
      res.status(500).json({
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
          model: User,
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
