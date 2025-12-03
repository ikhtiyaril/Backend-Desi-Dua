// models/Cart.js
module.exports = (sequelize, DataTypes) => {
  const Cart = sequelize.define(
    "Cart",
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
    },
    {
      tableName: "carts",
      timestamps: true, // createdAt & updatedAt
    }
  );

  // Relations
  Cart.associate = (models) => {
    Cart.belongsTo(models.User, {
      foreignKey: "user_id",
      as: "user",
    });

    // nanti cart bakal punya banyak cart_items
    Cart.hasMany(models.CartItem, {
      foreignKey: "cart_id",
      as: "items",
    });
  };

  return Cart;
};
