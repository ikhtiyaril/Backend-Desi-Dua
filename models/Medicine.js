// models/Medicine.js
module.exports = (sequelize, DataTypes) => {
  const Medicine = sequelize.define(
    "Medicine",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      category_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      stock: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      image_url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      is_prescription_required: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: "medicines",
      timestamps: true, // untuk createdAt dan updatedAt
    }
  );

  // Relation
  Medicine.associate = (models) => {
    Medicine.belongsTo(models.Category, {
      foreignKey: "category_id",
      as: "category",
    });
  };

  return Medicine;
};
