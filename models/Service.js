'use strict';
module.exports = (sequelize, DataTypes) => {
  const Service = sequelize.define('Service', {
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    duration_minutes: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    price: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    require_doctor: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    allow_walkin: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },// ==============================
    // ⬇⬇⬇ Extra for LiveKit Video Call
    // ==============================
    livekit_room_name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    is_live: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
  }, {
    tableName: 'services',
    underscored: true,
    timestamps:true
  });

  Service.associate = function(models) {
    // contoh relasi many-to-many service <-> doctor
    Service.belongsToMany(models.Doctor, {
      through: models.ServiceDoctor,
      foreignKey: 'service_id'
    });
  };

  return Service;
};
