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
      status: {
        type: DataTypes.ENUM("pending", "paid", "cancelled", "delivered"),
        allowNull: false,
        defaultValue: "pending",
      },
      payment_method: {
        type: DataTypes.STRING,
        allowNull: true, 
        // contoh: "qris", "bank_transfer", "cod", dll
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

    // Order punya banyak OrderItems nanti
    Order.hasMany(models.OrderItem, {
      foreignKey: "order_id",
      as: "items",
    });
  };

  return Order;
};

