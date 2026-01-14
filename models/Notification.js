module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define("Notification", {
    user_id: DataTypes.INTEGER,
    doctor_id: DataTypes.INTEGER,
    booking_id: DataTypes.INTEGER,
    title: DataTypes.STRING,
    body: DataTypes.TEXT,
    type: {
      type: DataTypes.ENUM(
        "booking_confirmed",
        "booking_cancelled",
        "booking_paid",
        "reminder_5min",
        "booking_started"
      )
    },
    is_read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  },{
    tableName: "notifications",
    underscored: true
  });

  Notification.associate = (models) => {
    Notification.belongsTo(models.User, { foreignKey: "user_id" });
    Notification.belongsTo(models.Doctor, { foreignKey: "doctor_id" });
    Notification.belongsTo(models.Booking, { foreignKey: "booking_id" });
  };

  return Notification;
};
