'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class TaskMessage extends Model {
    static associate(models) {
      TaskMessage.belongsTo(models.Task, { foreignKey: 'task_id' });
      TaskMessage.belongsTo(models.User, { foreignKey: 'author_user_id' });
    }
  }
  TaskMessage.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      task_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'tasks', key: 'id' },
      },
      author_user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
      },
      body: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'TaskMessage',
      tableName: 'task_messages',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
    }
  );
  return TaskMessage;
};
