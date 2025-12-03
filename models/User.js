'use strict';
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    'User',
    {
      name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: false
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      role: {
        type: DataTypes.ENUM('patient', 'admin'),
        defaultValue: 'patient',
      },
      otp: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      otpexp: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      googleId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      tableName: 'Users',
      timestamps: true,
    }
  );

  User.associate = function (models) {
    // Pasien memiliki banyak booking
    User.hasMany(models.Booking, {
      foreignKey: 'patient_id',
      as: 'bookings'
    });

  };

  return User;
};
