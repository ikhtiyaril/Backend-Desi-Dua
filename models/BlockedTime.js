'use strict';
module.exports = (sequelize, DataTypes) => {
  const BlockedTime = sequelize.define('BlockedTime', {
    doctor_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
   
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    time_start: {
      type: DataTypes.TIME,
      allowNull: false
    },
    time_end: {
      type: DataTypes.TIME,
      allowNull: false
    },
    booked_by: {
      type: DataTypes.INTEGER,
       defaultValue: 1  // FK ke booking_id
    }
  }, {
    tableName: 'blocked_times',
    underscored: true
  });

  BlockedTime.associate = function(models) {
    BlockedTime.belongsTo(models.Doctor, {
      foreignKey: 'doctor_id'
    });

 

    BlockedTime.belongsTo(models.Booking, {
      foreignKey: 'booked_by'
    });
  };

  return BlockedTime;
};
