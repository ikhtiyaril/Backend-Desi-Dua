module.exports = (sequelize, DataTypes) => {
  const Doctor = sequelize.define(
    'Doctor',
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: false
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false
      },
      specialization: {
        type: DataTypes.STRING
      },
      bio: {
        type: DataTypes.TEXT
      },
      avatar: {
        type: DataTypes.STRING
      },
      Study: {
        type: DataTypes.JSON
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      }
    },
    {
      tableName: 'doctors',
      underscored: true,
      timestamps: true
    }
  );

  Doctor.associate = function (models) {
    // Many-to-Many dengan Service lewat pivot table ServiceDoctor
    Doctor.belongsToMany(models.Service, {
      through: models.ServiceDoctor,
      foreignKey: 'doctor_id'
    });

    // One-to-Many dengan BlockedTime
    Doctor.hasMany(models.BlockedTime, {
      foreignKey: 'doctor_id'
    });

    Doctor.hasMany(models.DoctorSchedule,{
        foreignKey: 'doctor_id'
    })
  };

  return Doctor;
};
