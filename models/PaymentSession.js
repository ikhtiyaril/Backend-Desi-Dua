module.exports = (sequelize, DataTypes) => {
  const PaymentSession = sequelize.define("PaymentSession", {
    related_type: {
      type: DataTypes.ENUM("order", "booking"),
      allowNull: false,
    },
    related_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    session_data: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("UNPAID", "PAID", "EXPIRED"),
      defaultValue: "UNPAID",
    },
  });

  return PaymentSession;
};
