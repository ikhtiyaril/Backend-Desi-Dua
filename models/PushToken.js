module.exports = (sequelize, DataTypes) => {
  const PushToken = sequelize.define("PushToken", {
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    doctor_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    expo_token: {
      type: DataTypes.STRING,
      allowNull: false
    }
  },{
    tableName: "push_tokens",
    underscored: true
  });

  PushToken.associate = (models) => {
    PushToken.belongsTo(models.User, { foreignKey: "user_id" });
    PushToken.belongsTo(models.Doctor, { foreignKey: "doctor_id" });
  };

  return PushToken;
};
