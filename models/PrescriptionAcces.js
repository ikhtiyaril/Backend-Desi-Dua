// models/PrescriptionAccess.js
module.exports = (sequelize, DataTypes) => {
  const PrescriptionAccess = sequelize.define(
    "PrescriptionAccess",
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
      product_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("approved", "pending", "rejected"),
        allowNull: false,
        defaultValue: "pending",
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      prescription_image: {
  type: DataTypes.STRING,
  allowNull: true,
}

    },
    {
      tableName: "prescription_access",
      timestamps: true, // otomatis createdAt & updatedAt
    }
  );

  PrescriptionAccess.associate = (models) => {
    PrescriptionAccess.belongsTo(models.User, {
      foreignKey: "user_id",
      as: "user",
    });

    PrescriptionAccess.belongsTo(models.Medicine, {
      foreignKey: "product_id",
      as: "product",
    });
  };

  return PrescriptionAccess;
};
