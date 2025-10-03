const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Class = sequelize.define('Class', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  className: { type: DataTypes.STRING, allowNull: false },
  program: { type: DataTypes.STRING, allowNull: false },
  faculty: { type: DataTypes.ENUM('FICT', 'FBMG', 'FASS'), allowNull: false }
}, { timestamps: true });

module.exports = Class;