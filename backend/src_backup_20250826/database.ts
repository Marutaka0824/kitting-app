// backend/src/database.ts
import { Sequelize, DataTypes, Model } from 'sequelize';
import path from 'path';

// SQLiteデータベースの設定
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../data/database.sqlite'),
  logging: false // SQLログを非表示（開発時はtrueにすると便利）
});

// ===== モデルの定義 =====

// 1. 部品マスターモデル
class PartsMaster extends Model {
  public id!: number;
  public product!: string;
  public partName!: string;
  public quantity!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PartsMaster.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    product: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    partName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
  },
  {
    sequelize,
    modelName: 'PartsMaster',
    tableName: 'parts_master',
  }
);

// 2. 在庫モデル
class Inventory extends Model {
  public id!: number;
  public partName!: string;
  public stock!: number;
  public lastUpdated!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Inventory.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    partName: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    lastUpdated: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'Inventory',
    tableName: 'inventory',
  }
);

// 3. 履歴モデル（新規追加）
// 4. ユーザーモデル（認証用）
class User extends Model {
  public id!: number;
  public email!: string;
  public password!: string;
  public name!: string;
  public role!: string;
  public lastLogin!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING,
      defaultValue: 'user', // 'admin' or 'user'
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
  }
);
class CalculationHistory extends Model {
  public id!: number;
  public requestData!: string;
  public resultData!: string;
  public calculatedAt!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

CalculationHistory.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    requestData: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    resultData: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    calculatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'CalculationHistory',
    tableName: 'calculation_history',
  }
);

// ===== 初期データの投入 =====
const initializeDatabase = async () => {
  try {
    // データベースの同期
    await sequelize.sync({ force: false }); // force: trueにすると既存データが削除される
    console.log('✅ データベースを初期化しました');

    // 初期データがない場合のみ投入
    const partsCount = await PartsMaster.count();
    // デフォルト管理者ユーザーを作成
    const userCount = await User.count();
    if (userCount === 0) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await User.create({
        email: 'admin@example.com',
        password: hashedPassword,
        name: '管理者',
        role: 'admin'
      });
      
      console.log('📧 デフォルト管理者を作成しました');
      console.log('   Email: admin@example.com');
      console.log('   Password: admin123');
    }
        if (partsCount === 0) {
      console.log('📝 初期データを投入します...');
      
      // デフォルトの部品マスターデータ
      const defaultPartsMaster = [
        // 製品A
        { product: 'A', partName: 'CPU Intel Core i5', quantity: 1 },
        { product: 'A', partName: 'メモリ 8GB DDR4', quantity: 2 },
        { product: 'A', partName: 'SSD 256GB', quantity: 1 },
        { product: 'A', partName: '電源ユニット 500W', quantity: 1 },
        { product: 'A', partName: 'マザーボード ATX', quantity: 1 },
        // 製品B
        { product: 'B', partName: 'CPU Intel Core i7', quantity: 1 },
        { product: 'B', partName: 'メモリ 16GB DDR4', quantity: 2 },
        { product: 'B', partName: 'SSD 512GB', quantity: 1 },
        { product: 'B', partName: '電源ユニット 650W', quantity: 1 },
        { product: 'B', partName: 'マザーボード ATX Pro', quantity: 1 },
        // 製品C
        { product: 'C', partName: 'CPU Intel Core i9', quantity: 1 },
        { product: 'C', partName: 'メモリ 32GB DDR5', quantity: 2 },
        { product: 'C', partName: 'SSD 1TB NVMe', quantity: 1 },
        { product: 'C', partName: '電源ユニット 850W', quantity: 1 },
        { product: 'C', partName: 'マザーボード ATX Premium', quantity: 1 },
        // 製品D
        { product: 'D', partName: 'CPU AMD Ryzen 9', quantity: 1 },
        { product: 'D', partName: 'メモリ 64GB DDR5', quantity: 4 },
        { product: 'D', partName: 'SSD 2TB NVMe', quantity: 1 },
        { product: 'D', partName: '電源ユニット 1000W', quantity: 1 },
        { product: 'D', partName: 'マザーボード ATX Ultimate', quantity: 1 },
      ];

      // デフォルトの在庫データ
      const defaultInventory = [
        { partName: 'CPU Intel Core i5', stock: 15 },
        { partName: 'CPU Intel Core i7', stock: 8 },
        { partName: 'CPU Intel Core i9', stock: 5 },
        { partName: 'CPU AMD Ryzen 9', stock: 3 },
        { partName: 'メモリ 8GB DDR4', stock: 50 },
        { partName: 'メモリ 16GB DDR4', stock: 30 },
        { partName: 'メモリ 32GB DDR5', stock: 20 },
        { partName: 'メモリ 64GB DDR5', stock: 10 },
        { partName: 'SSD 256GB', stock: 25 },
        { partName: 'SSD 512GB', stock: 15 },
        { partName: 'SSD 1TB NVMe', stock: 12 },
        { partName: 'SSD 2TB NVMe', stock: 5 },
        { partName: '電源ユニット 500W', stock: 20 },
        { partName: '電源ユニット 650W', stock: 15 },
        { partName: '電源ユニット 850W', stock: 8 },
        { partName: '電源ユニット 1000W', stock: 4 },
        { partName: 'マザーボード ATX', stock: 10 },
        { partName: 'マザーボード ATX Pro', stock: 7 },
        { partName: 'マザーボード ATX Premium', stock: 5 },
        { partName: 'マザーボード ATX Ultimate', stock: 2 },
      ];

      // データを投入
      await PartsMaster.bulkCreate(defaultPartsMaster);
      await Inventory.bulkCreate(defaultInventory);
      
      console.log('✅ 初期データの投入が完了しました');
    }
  } catch (error) {
    console.error('❌ データベース初期化エラー:', error);
  }
};

// ===== データアクセス関数 =====

// 部品マスターデータを取得
export const getPartsMaster = async () => {
  return await PartsMaster.findAll();
};

// 在庫データを取得
export const getInventory = async () => {
  return await Inventory.findAll();
};

// 在庫を更新
export const updateInventory = async (partName: string, newStock: number) => {
  const inventory = await Inventory.findOne({ where: { partName } });
  if (inventory) {
    inventory.stock = newStock;
    inventory.lastUpdated = new Date();
    await inventory.save();
    return inventory;
  }
  return null;
};

// 計算履歴を保存
export const saveCalculationHistory = async (requestData: any, resultData: any) => {
  return await CalculationHistory.create({
    requestData: JSON.stringify(requestData),
    resultData: JSON.stringify(resultData),
    calculatedAt: new Date(),
  });
};

// 計算履歴を取得
export const getCalculationHistory = async (limit: number = 10) => {
  return await CalculationHistory.findAll({
    order: [['calculatedAt', 'DESC']],
    limit,
  });
};

export { sequelize, PartsMaster, Inventory, CalculationHistory, User, initializeDatabase };