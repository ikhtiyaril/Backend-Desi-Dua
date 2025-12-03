// models/Category.js
module.exports = (sequelize, DataTypes) => {
  const Category = sequelize.define(
    "Category",
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
    },
    {
      tableName: "categories",
      timestamps: true, // otomatis createdAt & updatedAt
    }
  );

  // Relation
  Category.associate = (models) => {
    Category.hasMany(models.Medicine, {
      foreignKey: "category_id",
      as: "medicines",
    });
  };

  return Category;
};
