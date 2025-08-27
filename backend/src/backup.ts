// backend/src/backup.ts
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import archiver from 'archiver';
import cron from 'node-cron';
import { 
  PartsMaster, 
  Inventory, 
  CalculationHistory,
  User 
} from './database';

// バックアップフォルダのパス
const BACKUP_DIR = path.join(__dirname, '../backups');

// バックアップフォルダが存在しない場合は作成
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  console.log('📁 バックアップフォルダを作成しました');
}

// ===== バックアップ関数 =====

// 1. データベース全体をExcelファイルにエクスポート
export const exportToExcel = async (): Promise<string> => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const fileName = `backup_${timestamp}.xlsx`;
    const filePath = path.join(BACKUP_DIR, fileName);

    // ワークブックを作成
    const wb = XLSX.utils.book_new();

    // 1. 部品マスターデータをエクスポート
    const partsMasterData = await PartsMaster.findAll();
    const partsMasterSheet = XLSX.utils.json_to_sheet(
      partsMasterData.map(p => ({
        '製品': p.product,
        '部品名': p.partName,
        '必要数': p.quantity,
        '作成日': p.createdAt,
        '更新日': p.updatedAt
      }))
    );
    XLSX.utils.book_append_sheet(wb, partsMasterSheet, '部品マスター');

    // 2. 在庫データをエクスポート
    const inventoryData = await Inventory.findAll();
    const inventorySheet = XLSX.utils.json_to_sheet(
      inventoryData.map(i => ({
        '部品名': i.partName,
        '在庫数': i.stock,
        '最終更新': i.lastUpdated,
        '作成日': i.createdAt
      }))
    );
    XLSX.utils.book_append_sheet(wb, inventorySheet, '在庫');

    // 3. 計算履歴をエクスポート（最新100件）
    const historyData = await CalculationHistory.findAll({
      limit: 100,
      order: [['calculatedAt', 'DESC']]
    });
    const historySheet = XLSX.utils.json_to_sheet(
      historyData.map(h => ({
        'ID': h.id,
        '計算日時': h.calculatedAt,
        'リクエストデータ': h.requestData,
        '結果データ': h.resultData
      }))
    );
    XLSX.utils.book_append_sheet(wb, historySheet, '計算履歴');

    // 4. ユーザーデータをエクスポート（パスワード以外）
    const userData = await User.findAll({
      attributes: ['id', 'email', 'name', 'role', 'lastLogin', 'createdAt']
    });
    const userSheet = XLSX.utils.json_to_sheet(
      userData.map(u => ({
        'ID': u.id,
        'メール': u.email,
        '名前': u.name,
        '権限': u.role,
        '最終ログイン': u.lastLogin,
        '登録日': u.createdAt
      }))
    );
    XLSX.utils.book_append_sheet(wb, userSheet, 'ユーザー');

    // Excelファイルを保存
    XLSX.writeFile(wb, filePath);
    
    console.log(`✅ Excelバックアップを作成しました: ${fileName}`);
    return filePath;
  } catch (error) {
    console.error('❌ Excelエクスポートエラー:', error);
    throw error;
  }
};

// 2. SQLiteデータベースファイルをコピー
export const backupDatabase = async (): Promise<string> => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const dbPath = path.join(__dirname, '../data/database.sqlite');
    const backupPath = path.join(BACKUP_DIR, `database_${timestamp}.sqlite`);

    // データベースファイルをコピー
    fs.copyFileSync(dbPath, backupPath);
    
    console.log(`✅ データベースバックアップを作成しました: database_${timestamp}.sqlite`);
    return backupPath;
  } catch (error) {
    console.error('❌ データベースバックアップエラー:', error);
    throw error;
  }
};

// 3. 完全バックアップ（ZIPファイル作成）
export const createFullBackup = async (): Promise<string> => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const zipFileName = `full_backup_${timestamp}.zip`;
    const zipPath = path.join(BACKUP_DIR, zipFileName);

    // Excelファイルを作成
    const excelPath = await exportToExcel();
    
    // データベースをバックアップ
    const dbBackupPath = await backupDatabase();

    // ZIPアーカイブを作成
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise((resolve, reject) => {
      output.on('close', () => {
        console.log(`✅ 完全バックアップを作成しました: ${zipFileName} (${archive.pointer()} bytes)`);
        
        // 個別ファイルを削除（ZIPに含まれているため）
        fs.unlinkSync(excelPath);
        fs.unlinkSync(dbBackupPath);
        
        resolve(zipPath);
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);
      
      // ファイルをZIPに追加
      archive.file(excelPath, { name: path.basename(excelPath) });
      archive.file(dbBackupPath, { name: path.basename(dbBackupPath) });
      
      // 設定ファイルも追加
      const configPath = path.join(__dirname, '../package.json');
      if (fs.existsSync(configPath)) {
        archive.file(configPath, { name: 'package.json' });
      }
      
      archive.finalize();
    });
  } catch (error) {
    console.error('❌ 完全バックアップエラー:', error);
    throw error;
  }
};

// 4. 古いバックアップを削除（7日以上前）
export const cleanOldBackups = async (daysToKeep: number = 7): Promise<number> => {
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const now = Date.now();
    const maxAge = daysToKeep * 24 * 60 * 60 * 1000; // ミリ秒
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      const age = now - stats.mtimeMs;

      if (age > maxAge) {
        fs.unlinkSync(filePath);
        deletedCount++;
        console.log(`🗑️ 古いバックアップを削除: ${file}`);
      }
    }

    if (deletedCount > 0) {
      console.log(`✅ ${deletedCount}個の古いバックアップを削除しました`);
    }

    return deletedCount;
  } catch (error) {
    console.error('❌ バックアップクリーンアップエラー:', error);
    throw error;
  }
};

// 5. バックアップリストを取得
export const getBackupList = (): Array<{name: string, size: number, created: Date}> => {
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    return files.map(file => {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      return {
        name: file,
        size: stats.size,
        created: new Date(stats.mtime)
      };
    }).sort((a, b) => b.created.getTime() - a.created.getTime());
  } catch (error) {
    console.error('❌ バックアップリスト取得エラー:', error);
    return [];
  }
};

// ===== 自動バックアップのスケジューリング =====

// 毎日午前2時に自動バックアップ
export const scheduleAutoBackup = () => {
  // 開発環境では5分ごと、本番環境では毎日2時
  const schedule = process.env.NODE_ENV === 'development' 
    ? '*/5 * * * *'  // 5分ごと（テスト用）
    : '0 2 * * *';   // 毎日午前2時

  cron.schedule(schedule, async () => {
    console.log('🔄 自動バックアップを開始します...');
    try {
      await createFullBackup();
      await cleanOldBackups(7); // 7日以上前のバックアップを削除
      console.log('✅ 自動バックアップが完了しました');
    } catch (error) {
      console.error('❌ 自動バックアップに失敗しました:', error);
    }
  });

  console.log('⏰ 自動バックアップをスケジュール設定しました');
};

// ===== バックアップからの復元 =====

// Excelファイルからデータを復元
export const restoreFromExcel = async (filePath: string): Promise<void> => {
  try {
    const workbook = XLSX.readFile(filePath);
    
    // 部品マスターを復元
    if (workbook.SheetNames.includes('部品マスター')) {
      const sheet = workbook.Sheets['部品マスター'];
      const data = XLSX.utils.sheet_to_json(sheet);
      
      await PartsMaster.destroy({ where: {} });
      await PartsMaster.bulkCreate(data.map((row: any) => ({
        product: row['製品'],
        partName: row['部品名'],
        quantity: row['必要数']
      })));
      
      console.log('✅ 部品マスターを復元しました');
    }
    
    // 在庫を復元
    if (workbook.SheetNames.includes('在庫')) {
      const sheet = workbook.Sheets['在庫'];
      const data = XLSX.utils.sheet_to_json(sheet);
      
      await Inventory.destroy({ where: {} });
      await Inventory.bulkCreate(data.map((row: any) => ({
        partName: row['部品名'],
        stock: row['在庫数'],
        lastUpdated: row['最終更新'] || new Date()
      })));
      
      console.log('✅ 在庫データを復元しました');
    }
    
    console.log('✅ Excelファイルからの復元が完了しました');
  } catch (error) {
    console.error('❌ 復元エラー:', error);
    throw error;
  }
};