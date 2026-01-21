const cron = require("node-cron");
const { Booking } = require("../models");
const { notifyUser } = require("../utils/notify");
const { Op } = require("sequelize");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);
const TZ = "Asia/Jakarta";

cron.schedule("* * * * *", async () => {
  try {
    const now = dayjs().tz(TZ);

    // Batasi query: cek booking dalam range hari ini s/d besok (optimasi)
    const today = now.format("YYYY-MM-DD");
    const tomorrow = now.add(1, "day").format("YYYY-MM-DD");

    // Ambil hanya booking confirmed yang belum dikirimi reminder, dalam rentang tanggal
    const candidates = await Booking.findAll({
      where: {
        status: "confirmed",
        reminder_1h_sent: false,
        date: {
          [Op.between]: [today, tomorrow]
        }
      }
    });

    for (const b of candidates) {
      // build start datetime in Jakarta timezone
      // b.date is YYYY-MM-DD, b.time_start is hh:mm:ss (or hh:mm)
      const start = dayjs.tz(`${b.date} ${b.time_start}`, "YYYY-MM-DD HH:mm:ss", TZ);
      const diffMin = start.diff(now, "minute"); // integer minutes

      // Jika persis 60 menit atau dalam window 60 menit (cron per menit)
      if (diffMin === 60) {
        // atomic update: set reminder flag if it's still false
        const [updatedRows] = await Booking.update(
          { reminder_1h_sent: true },
          {
            where: {
              id: b.id,
              reminder_1h_sent: false
            }
          }
        );

        if (updatedRows === 1) {
          // hanya kirim notif jika update berhasil (menghindari duplikasi)
          await notifyUser({
            user_id: b.user_id,
            title: "Booking akan dimulai dalam 1 jam",
            body: `Booking kamu dengan kode ${b.booking_code} dimulai ${start.format("HH:mm, DD MMM YYYY")}`,
            type: "booking_reminder",
            booking_id: b.id
          });
        }
      }

      // CHECK BOOKING STARTED (durasi window kecil supaya tidak spam)
      const diffSinceStart = start.diff(now, "minute"); // >0 berarti belum mulai
      if (diffSinceStart <= 0) {
        // booking sudah dimulai (<= 0 menit)
        const [updatedRows] = await Booking.update(
          { started_notif_sent: true },
          {
            where: {
              id: b.id,
              started_notif_sent: false
            }
          }
        );

        if (updatedRows === 1) {
          await notifyUser({
            user_id: b.user_id,
            title: "Booking dimulai",
            body: `Booking kamu dengan kode ${b.booking_code} sedang dimulai sekarang.`,
            type: "booking_started",
            booking_id: b.id
          });
        }
      }
    }
  } catch (err) {
    console.error("Cron booking error:", err);
  }
});
