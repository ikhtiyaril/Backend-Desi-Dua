const express = require('express');
const router = express.Router();
const { Booking, Service, Doctor, User , BlockedTime,MedicalRecord,DoctorSchedule,WalletDoctor,sequelize,PushToken,Notification } = require('../models'); // pastikan path sesuai
const { Transaction, Op } = require('sequelize');
const verifyToken = require("../middleware/verifyToken");


function addMinutes(timeStr, minutesToAdd) {
  const [h, m] = timeStr.split(":").map(Number);
  const total = h * 60 + m + minutesToAdd;
  const newH = Math.floor(total / 60) % 24;
  const newM = total % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

async function runWithRetry(fn, retries = 3) {
  try {
    return await fn();
  } catch (err) {
    if (
      err.original?.code === 'ER_LOCK_DEADLOCK' &&
      retries > 0
    ) {
      console.warn('Deadlock detected, retrying...', retries);
      return runWithRetry(fn, retries - 1);
    }
    throw err;
  }
}

router.post('/', verifyToken, async (req, res) => {
  const DEBUG_ID = `BOOK-${Date.now()}`;
  console.log(`\n🚀 [${DEBUG_ID}] CREATE BOOKING START`);

  try {
    const booking = await runWithRetry(async () => {
      return await sequelize.transaction(
        { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
        async (t) => {

          let { service_id, doctor_id, date, time_start, notes } = req.body;
          const { id: patient_id } = req.user;

          console.log(`[${DEBUG_ID}] Payload:`, {
            service_id,
            doctor_id,
            date,
            time_start,
            patient_id,
          });

          // =========================
          // VALIDATION
          // =========================
          if (!service_id || !date || !time_start) {
            console.warn(`[${DEBUG_ID}] ❌ Missing required fields`);
            throw { status: 400, message: "Data tidak lengkap" };
          }

          // =========================
          // SERVICE
          // =========================
          const service = await Service.findByPk(service_id, { transaction: t });
          if (!service) {
            console.warn(`[${DEBUG_ID}] ❌ Service not found: ${service_id}`);
            throw { status: 404, message: "Service tidak ditemukan" };
          }

          console.log(`[${DEBUG_ID}] Service found`, {
            id: service.id,
            price: service.price,
            is_doctor_service: service.is_doctor_service,
            require_doctor: service.require_doctor,
            exclusive_doctor_id: service.exclusive_doctor_id,
          });

          // =========================
          // DOCTOR RESOLUTION
          // =========================
          if (service.is_doctor_service && service.exclusive_doctor_id) {
            doctor_id = service.exclusive_doctor_id;
            console.log(
              `[${DEBUG_ID}] 🔒 Exclusive doctor enforced: ${doctor_id}`
            );
          }

          if (service.require_doctor && !doctor_id) {
            console.warn(`[${DEBUG_ID}] ❌ Doctor required but not provided`);
            throw { status: 400, message: "Service memerlukan dokter" };
          }

          if (doctor_id) {
            const doctor = await Doctor.findByPk(doctor_id, { transaction: t });
            if (!doctor) {
              console.warn(`[${DEBUG_ID}] ❌ Doctor not found: ${doctor_id}`);
              throw { status: 404, message: "Doctor tidak ditemukan" };
            }
            console.log(`[${DEBUG_ID}] Doctor OK: ${doctor_id}`);
          }

          // =========================
          // TIME CALCULATION
          // =========================
          const time_end = addMinutes(time_start, service.duration_minutes);
          console.log(`[${DEBUG_ID}] Time calculated`, {
            start: time_start,
            end: time_end,
            duration: service.duration_minutes,
          });

          // =========================
          // 🔒 CRITICAL SECTION (LOCK)
          // =========================
          if (doctor_id) {
            console.log(`[${DEBUG_ID}] 🔐 Locking blocked_times`);

            await BlockedTime.findAll({
              where: { doctor_id, date },
              transaction: t,
              lock: t.LOCK.UPDATE,
            });

            const overlap = await BlockedTime.findOne({
              where: {
                doctor_id,
                date,
                [Op.not]: {
                  [Op.or]: [
                    { time_end: { [Op.lte]: time_start } },
                    { time_start: { [Op.gte]: time_end } },
                  ],
                },
              },
              transaction: t,
            });

            if (overlap) {
              console.warn(`[${DEBUG_ID}] ❌ Time overlap detected`, {
                existing: {
                  start: overlap.time_start,
                  end: overlap.time_end,
                },
              });
              throw { status: 409, message: "Waktu sudah terisi" };
            }

            console.log(`[${DEBUG_ID}] ✅ No overlap detected`);
          }

          // =========================
          // PAYMENT STATUS
          // =========================
          const payment_status =
            Number(service.price) === 0 ? "paid" : "unpaid";

          console.log(`[${DEBUG_ID}] Payment status resolved: ${payment_status}`);

          // =========================
          // BOOKING CREATE
          // =========================
          const booking = await Booking.create(
            {
              booking_code: `BKG-${Date.now()}`,
              patient_id,
              service_id,
              doctor_id: doctor_id || null,
              date,
              time_start,
              time_end,
              notes: notes || "",
              status: "pending",
              payment_status,
            },
            { transaction: t }
          );

          console.log(`[${DEBUG_ID}] ✅ Booking created`, {
            id: booking.id,
            code: booking.booking_code,
          });

          // =========================
          // BLOCKED TIME INSERT
          // =========================
          if (doctor_id) {
            await BlockedTime.create(
              {
                doctor_id,
                service_id,
                date,
                time_start,
                time_end,
                booked_by: booking.id,
              },
              { transaction: t }
            );

            console.log(`[${DEBUG_ID}] ⛔ BlockedTime created`);
          }

          return booking;
        }
      );
    });

    console.log(`[${DEBUG_ID}] 🎉 TRANSACTION COMMIT SUCCESS`);

    return res.status(201).json({
      message: "Booking berhasil dibuat",
      booking,
    });

  } catch (err) {
    console.error(`[${DEBUG_ID}] 💥 BOOKING ERROR`, err);

    return res.status(err.status || 500).json({
      message: err.message || "Gagal membuat booking",
    });
  }
});



// ========================
// Get all Bookings (user optional filter)
// ========================
router.get('/', async (req, res) => {
  try {
    const { patient_id, status } = req.query;
    let where = {};

    if (patient_id) where.patient_id = patient_id;
    if (status) where.status = status;

    const bookings = await Booking.findAll({
      where,
      include: [
        { model: Service },
        { model: Doctor },
        { model: User, attributes: ['id', 'name', 'email'] }
      ],
      order: [['date', 'ASC'], ['time_start', 'ASC']]
    });

    res.json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil booking', error: err.message });
  }
});


// routes/bookingRoutes.js
router.get('/upcoming/today', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const now = new Date().toTimeString().slice(0, 8);   // HH:mm:ss

    const booking = await Booking.findOne({
      where: {
        patient_id: userId,
        date: today,
        status: 'confirmed',
        payment_status: 'paid',
        time_start: {
          [Op.gte]: now
        }
      },
      include: [
        {
          model: Service,
          attributes: ['name', 'is_live']
        },
        {
          model: Doctor,
          attributes: ['name']
        }
      ],
      order: [['time_start', 'ASC']]
    });

    res.json({
      success: true,
      data: booking
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Gagal ambil booking hari ini'
    });
  }
});

// routes/bookingRoutes.js

router.get("/me", verifyToken, async (req, res) => {


  try {
    const userId = req.user.id;

    const bookings = await Booking.findAll({
      where: { patient_id: userId },
      include: [
        {
          model: Service,
          attributes: ["id", "name", "duration_minutes", "price","is_live"],
        },
        {
          model: Doctor,
          attributes: ["id", "name"],
        }
        
      ],
      order: [["id", "DESC"]],
    });

    

    return res.json({
      success: true,
      data: bookings,
    });

  } catch (err) {
    console.log("----- ERROR WHILE GETTING BOOKINGS -----");
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil booking user",
      error: err.message,
    });
  }
});


router.get("/doctor/revenue", verifyToken, async (req, res) => {
  console.log("===== [GET] /doctor/revenue =====");

  try {
    // ===============================
    // 1️⃣ Debug user dari token
    // ===============================
    console.log("[DEBUG] req.user:", req.user);

    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId || !role) {
      console.log("[ERROR] Token decoded but missing userId / role");
      return res.status(401).json({
        message: "Invalid token payload",
      });
    }

    if (role !== "doctor") {
      console.log(`[DENIED] User ${userId} role=${role}`);
      return res.status(403).json({
        message: "Access denied. Doctor only.",
      });
    }

    // ===============================
    // 2️⃣ Query Booking
    // ===============================
    console.log("[DEBUG] Fetching bookings for doctor_id:", userId);

    const bookings = await Booking.findAll({
      where: {
        doctor_id: userId,
        status: ["confirmed", "completed"],
        payment_status: "paid",
      },
      include: [
        {
          model: Service,
          attributes: ["price", "is_live", "name"],
        },
      ],
    });

    console.log("[DEBUG] bookings.length:", bookings.length);

    if (bookings.length === 0) {
      console.log("[INFO] No paid bookings found");
    }

    // ===============================
    // 3️⃣ Revenue Calculation
    // ===============================
    let totalDoctorIncome = 0;
    let totalAppIncome = 0;

    const detail = bookings.map((booking, index) => {
      if (!booking.Service) {
        console.log(
          `[WARN] Booking ${booking.id} has NO service relation`
        );
        return null;
      }

      const price = booking.Service.price;
      const isLive = booking.Service.is_live;

      const doctorPercent = isLive ? 0.7 : 0.9;
      const appPercent = isLive ? 0.3 : 0.1;

      const doctorIncome = price * doctorPercent;
      const appIncome = price * appPercent;

      totalDoctorIncome += doctorIncome;
      totalAppIncome += appIncome;

      console.log(`[DEBUG][${index}]`, {
        booking_code: booking.booking_code,
        service: booking.Service.name,
        price,
        isLive,
        doctorIncome,
        appIncome,
      });

      return {
        booking_code: booking.booking_code,
        service_name: booking.Service.name,
        is_live: isLive,
        price,
        doctor_income: doctorIncome,
        app_income: appIncome,
      };
    }).filter(Boolean); // buang null kalau service missing

    // ===============================
    // 4️⃣ Final Response
    // ===============================
    console.log("[DEBUG] totalDoctorIncome:", totalDoctorIncome);
    console.log("[DEBUG] totalAppIncome:", totalAppIncome);

    return res.json({
      doctor_id: userId,
      total_doctor_income: totalDoctorIncome,
      total_app_income: totalAppIncome,
      total_booking: detail.length,
      detail,
    });

  } catch (error) {
    console.error("🔥 [ERROR] Revenue Calculation Failed");
    console.error(error);

    return res.status(500).json({
      message: "Failed to calculate revenue",
      error: error.message, // ⬅️ penting waktu debug
    });
  }
});


router.get("/doctor", verifyToken, async (req, res) => {
  console.log("===== /doctor route hit =====");

  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID tidak ditemukan"
      });
    }

    const bookings = await Booking.findAll({
      where: { doctor_id: userId },
      include: [
        {
          model: User,
          as: "User", // optional (sesuai associate)
          attributes: ["id", "name", "email", "phone", "avatar"]
        },
        {
          model: Service,
          attributes: ["id", "name", "duration_minutes", "price", "is_live"]
        },
        {
          model: Doctor,
          attributes: ["id", "name"]
        }
      ],
      order: [["id", "DESC"]]
    });

    return res.json({
      success: true,
      data: bookings
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Gagal mengambil booking doctor",
      error: err.message
    });
  }
});



// ========================
// Get Booking by ID
// ========================
router.get('/:id', async (req, res) => {
  try {
    const booking = await Booking.findByPk(req.params.id, {
      include: [
        { model: Service },
        { model: Doctor },
        { model: User, attributes: ['id', 'name', 'email'] }
      ]
    });

    if (!booking) return res.status(404).json({ message: 'Booking tidak ditemukan' });

    res.json(booking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil booking', error: err.message });
  }
});

// ========================
// Update Booking (misal status, notes, payment_method)
// ========================
router.put('/:id', async (req, res) => {
  try {
    const booking = await Booking.findByPk(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking tidak ditemukan' });

    const { status, notes, payment_method, doctor_id, date, time_start, time_end } = req.body;

    await booking.update({
      status: status || booking.status,
      notes: notes !== undefined ? notes : booking.notes,
      payment_method: payment_method || booking.payment_method,
      doctor_id: doctor_id !== undefined ? doctor_id : booking.doctor_id,
      date: date || booking.date,
      time_start: time_start || booking.time_start,
      time_end: time_end || booking.time_end
    });

    res.json(booking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal update booking', error: err.message });
  }
});

// ========================
// Delete Booking
// ========================
router.delete('/:id', async (req, res) => {
  try {
    const booking = await Booking.findByPk(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking tidak ditemukan' });

    await booking.destroy();
    res.json({ message: 'Booking berhasil dihapus' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal hapus booking', error: err.message });
  }
});

// Ubah status booking

router.patch("/:id/status", async (req, res) => {
  const transaction = await Booking.sequelize.transaction();

  const debug = (step, data = "") => {
    console.log(`[BOOKING_STATUS_DEBUG] ${step}`, data);
  };

  try {
    debug("REQUEST_RECEIVED", {
      params: req.params,
      body: req.body
    });

    const { id } = req.params;
    const { status } = req.body;

    const allowedStatus = ["pending", "confirmed", "cancelled", "completed"];
    if (!allowedStatus.includes(status)) {
      debug("INVALID_STATUS", status);
      await transaction.rollback();
      return res.status(400).json({ message: "Invalid status value" });
    }

    const booking = await Booking.findByPk(id, {
      include: [
        { model: MedicalRecord, as: "medicalRecord" },
        { model: Service }
      ],
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!booking) {
      debug("BOOKING_NOT_FOUND", id);
      await transaction.rollback();
      return res.status(404).json({ message: "Booking not found" });
    }

    debug("BOOKING_FOUND", {
      id: booking.id,
      oldStatus: booking.status,
      payment_status: booking.payment_status,
      is_wallet_processed: booking.is_wallet_processed
    });

    booking.status = status;
    await booking.save({ transaction });

    debug("STATUS_UPDATED", status);

    /* =========================
       AUTO MEDICAL RECORD
    ========================= */
    if (status === "confirmed" && !booking.medicalRecord) {
      debug("CREATE_MEDICAL_RECORD");
      await MedicalRecord.create(
        {
          booking_id: booking.id,
          patient_id: booking.patient_id,
          doctor_id: booking.doctor_id
        },
        { transaction }
      );
    } else {
      debug("SKIP_MEDICAL_RECORD", {
        status,
        hasMedicalRecord: !!booking.medicalRecord
      });
    }

    /* =========================
       WALLET
    ========================= */
    if (
      status === "completed" &&
      booking.payment_status === "paid" &&
      booking.is_wallet_processed === false
    ) {
      debug("WALLET_PROCESS_START");

      if (!booking.Service) {
        debug("SERVICE_NOT_FOUND");
        throw new Error("Service not found");
      }

      const price = Number(booking.Service.price);
      const percent = booking.Service.is_live ? 0.7 : 0.9;
      const income = price * percent;

      debug("WALLET_CALCULATION", {
        price,
        percent,
        income
      });

      const [wallet] = await WalletDoctor.findOrCreate({
        where: { doctor_id: booking.doctor_id },
        defaults: { balance: 0 },
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      wallet.balance = Number(wallet.balance) + income;
      await wallet.save({ transaction });

      booking.is_wallet_processed = true;
      await booking.save({ transaction });

      debug("WALLET_UPDATED", {
        doctor_id: booking.doctor_id,
        new_balance: wallet.balance
      });
    } else {
      debug("SKIP_WALLET", {
        status,
        payment_status: booking.payment_status,
        is_wallet_processed: booking.is_wallet_processed
      });
    }

    /* =========================
       🔔 NOTIFICATIONS
    ========================= */
    let notifTitle = "";
    let notifBody = "";
    let notifType = "";

    if (status === "confirmed") {
      notifTitle = "Booking confirmed";
      notifBody = "Dokter telah mengonfirmasi jadwal kamu";
      notifType = "booking_confirmed";
    }

    if (status === "cancelled") {
      notifTitle = "Booking dibatalkan";
      notifBody = "Jadwal konsultasi telah dibatalkan";
      notifType = "booking_cancelled";
    }

    if (status === "completed" && booking.payment_status === "paid") {
      notifTitle = "Sesi selesai";
      notifBody = "Terima kasih, pembayaran sudah diterima";
      notifType = "booking_paid";
    }

    if (notifType) {
      debug("NOTIFICATION_START", notifType);

      const userToken = await PushToken.findOne({
        where: { user_id: booking.patient_id }
      });

      const doctorToken = await PushToken.findOne({
        where: { doctor_id: booking.doctor_id }
      });

      await Notification.create(
        {
          user_id: booking.patient_id,
          doctor_id: booking.doctor_id,
          booking_id: booking.id,
          title: notifTitle,
          body: notifBody,
          type: notifType
        },
        { transaction }
      );

      if (userToken) {
        debug("SEND_PUSH_USER");
        await sendPush(userToken.expo_token, notifTitle, notifBody);
      } else {
        debug("NO_USER_PUSH_TOKEN");
      }

      if (doctorToken) {
        debug("SEND_PUSH_DOCTOR");
        await sendPush(doctorToken.expo_token, notifTitle, notifBody);
      } else {
        debug("NO_DOCTOR_PUSH_TOKEN");
      }
    } else {
      debug("NO_NOTIFICATION_TRIGGERED");
    }

    await transaction.commit();
    debug("TRANSACTION_COMMIT");

    return res.json({
      message: "Booking updated + notification sent",
      booking
    });

  } catch (err) {
    debug("ERROR", err.message);
    await transaction.rollback();

    return res.status(500).json({
      message: "Failed to update booking",
      error: err.message
    });
  }
});




module.exports = router;
