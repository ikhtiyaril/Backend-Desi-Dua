// models/OrderItem.js
module.exports = (sequelize, DataTypes) => {
  const OrderItem = sequelize.define(
    "OrderItem",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      order_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      product_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      price: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },
    },
    {
      tableName: "order_items",
      timestamps: true,
    }
  );

  OrderItem.associate = (models) => {
    OrderItem.belongsTo(models.Order, {
      foreignKey: "order_id",
      as: "order",
    });

    OrderItem.belongsTo(models.Medicine, {
      foreignKey: "product_id",
      as: "product",
    });
  };

  return OrderItem;
};
