// backend/src/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from './database';

// JWT秘密鍵（本番環境では環境変数を使用）
const JWT_SECRET = 'your-secret-key-change-this-in-production';

// JWTトークンの生成
export const generateToken = (userId: number, email: string, role: string) => {
  return jwt.sign(
    { userId, email, role },
    JWT_SECRET,
    { expiresIn: '24h' } // 24時間有効
  );
};

// パスワードのハッシュ化
export const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, 10);
};

// パスワードの検証
export const verifyPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword);
};

// 認証ミドルウェア（リクエストのtokenを検証）
export const authenticateToken = (req: Request & { user?: any }, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: '認証が必要です' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'トークンが無効です' });
    }
    req.user = user;
    next();
  });
};

// 管理者権限チェック
export const requireAdmin = (req: Request & { user?: any }, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: '管理者権限が必要です' });
  }
  next();
};

// ===== 認証関連のAPI関数 =====

// ユーザー登録
export const registerUser = async (email: string, password: string, name: string) => {
  // メールアドレスの重複チェック
  const existingUser = await User.findOne({ where: { email } });
  if (existingUser) {
    throw new Error('このメールアドレスは既に登録されています');
  }

  // パスワードをハッシュ化
  const hashedPassword = await hashPassword(password);

  // ユーザーを作成
  const user = await User.create({
    email,
    password: hashedPassword,
    name,
    role: 'user'
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  };
};

// ログイン処理
export const loginUser = async (email: string, password: string) => {
  // ユーザーを検索
  const user = await User.findOne({ where: { email } });
  if (!user) {
    throw new Error('メールアドレスまたはパスワードが間違っています');
  }

  // パスワードを検証
  const isValid = await verifyPassword(password, user.password);
  if (!isValid) {
    throw new Error('メールアドレスまたはパスワードが間違っています');
  }

  // 最終ログイン時刻を更新
  user.lastLogin = new Date();
  await user.save();

  // トークンを生成
  const token = generateToken(user.id, user.email, user.role);

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  };
};