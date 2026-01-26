// models/Order.js
module.exports = (sequelize, DataTypes) => {
  const Order = sequelize.define(
    "Order",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },

      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      total_price: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },

      // 🧾 Status order (logistik)
      status: {
        type: DataTypes.ENUM("pending", "processing", "delivered", "cancelled","completed"),
        allowNull: false,
        defaultValue: "pending",
      },

      // 💳 Status pembayaran (Tripay)
      payment_status: {
        type: DataTypes.ENUM("UNPAID", "PAID", "EXPIRED", "FAILED", "REFUND"),
        allowNull: false,
        defaultValue: "UNPAID",
      },

      payment_method: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      order_code: {
        type: DataTypes.STRING,
        allowNull: false,
      },

          // ===============================
      // 📦 SHIPPING INFO
      // ===============================
      ekspedition: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      no_resi: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      shipping_cost: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      // ===============================
      // 📍 SHIPPING ADDRESS (SNAPSHOT)
      // ===============================
      province: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      regency: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      district: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      village: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      address_detail: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

    
    },
    {
      tableName: "orders",
      timestamps: true,
    }
  );

  Order.associate = (models) => {
    Order.belongsTo(models.User, {
      foreignKey: "user_id",
      as: "user",
    });

    Order.hasMany(models.OrderItem, {
      foreignKey: "order_id",
      as: "items",
    });
  };

  return Order;
};
