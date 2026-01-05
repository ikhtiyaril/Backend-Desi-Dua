module.exports = (sequelize, DataTypes) => {
  const WithdrawRequest = sequelize.define(
    "WithdrawRequest",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      doctor_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
      },

      bank_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      bank_account: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      account_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      status: {
        type: DataTypes.ENUM("pending", "approved", "rejected", "paid"),
        allowNull: false,
        defaultValue: "pending",
      },

      proof_image: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      requested_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },

      processed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "withdraw_requests",
      timestamps: false,
      underscored: true,
    }
  );

  WithdrawRequest.associate = (models) => {
    WithdrawRequest.belongsTo(models.User, {
      foreignKey: "doctor_id",
      as: "doctor",
      onDelete: "CASCADE",
    });
  };

  return WithdrawRequest;
};
