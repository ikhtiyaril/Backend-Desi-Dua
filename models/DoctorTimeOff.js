'use strict';
module.exports = (sequelize, DataTypes) => {
  const DoctorTimeOff = sequelize.define('DoctorTimeOff', {
    doctor_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    start_time: {
      type: DataTypes.TIME,
      allowNull: true
    },
    end_time: {
      type: DataTypes.TIME,
      allowNull: true
    }
  }, {
    tableName: 'doctor_time_off',
    underscored: true
  });

  DoctorTimeOff.associate = function(models) {
    DoctorTimeOff.belongsTo(models.Doctor, {
      foreignKey: 'doctor_id'
    });
  };

  return DoctorTimeOff;
};
