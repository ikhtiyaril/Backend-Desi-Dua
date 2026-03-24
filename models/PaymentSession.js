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
      type: DataTypes.ENUM(
'PENDING',
'PAID',
'EXPIRED',
'FAILED'
),
      defaultValue: "PENDING",
    },
    url_payment: {
      type: DataTypes.STRING,
      allowNull:false
    }
  });

  return PaymentSession;
};
