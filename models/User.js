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
      failed_login_attempt: {
  type: DataTypes.INTEGER,
  defaultValue: 0,
},

lock_until: {
  type: DataTypes.DATE,
  allowNull: true,
},
is_verified: {
  type: DataTypes.BOOLEAN,
  defaultValue: false,
},
verify_token: {
  type: DataTypes.STRING,
  allowNull: true,
},
verify_token_exp: {
  type: DataTypes.DATE,
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
