module.exports = (sequelize, DataTypes) => {
  const WalletDoctor = sequelize.define(
    "WalletDoctor",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      doctor_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
      },

      balance: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: "wallet_doctors",
      timestamps: true,
      underscored: true,
    }
  );

  WalletDoctor.associate = (models) => {
    WalletDoctor.belongsTo(models.Doctor, {
      foreignKey: "doctor_id",
      as: "doctor",
      onDelete: "CASCADE",
    });
  };

  return WalletDoctor;
};
