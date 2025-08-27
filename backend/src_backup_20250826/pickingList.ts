// backend/src/pickingList.ts
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

// 型定義
interface BOMItem {
  丸高管理No: string;
  品目コード: string;
  メーカー名: string;
  品目名: string;
  単位: string;
  手配先: string;
  員数: number;
}

interface InventoryItem {
  品目コード: string;
  社内在庫数: number;
}

interface PickingListItem {
  丸高管理No: string;
  品目コード: string;
  メーカー名: string;
  品目名: string;
  単位: string;
  手配先: string;
  社内在庫数: number | string;
  準備必要数: number;
  備考: string;
  支給先: string;
}

interface ProductRequest {
  productId: string;  // Z4①, Z4②, Z4③
  quantity: number;
}

// BOMファイルのパス設定
const BOM_FILES: { [key: string]: string } = {
  'Z4①': 'Z4①　BOM.xlsx',
  'Z4②': 'Z4②　BOM.xlsx',
  'Z4③': 'Z4③　BOM.xlsx'
};

const INVENTORY_FILE = '★Z42244040在庫表.xlsx';

// データフォルダのパス
const DATA_DIR = path.join(__dirname, '../data');

// BOMファイルを読み込む関数
export const loadBOMData = (productId: string): { items: BOMItem[], supplier: string } => {
  try {
    const fileName = BOM_FILES[productId];
    if (!fileName) {
      throw new Error(`製品 ${productId} のBOMファイルが見つかりません`);
    }

    const filePath = path.join(DATA_DIR, fileName);
    
    // ファイルの存在確認
    if (!fs.existsSync(filePath)) {
      console.error(`ファイルが存在しません: ${filePath}`);
      throw new Error(`BOMファイル ${fileName} が見つかりません`);
    }

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // B1セルから支給先を取得
    const supplierCell = sheet['B1'];
    const supplier = supplierCell ? supplierCell.v : '不明';
    
    // データを配列に変換（ヘッダー行は2行目）
    const data = XLSX.utils.sheet_to_json(sheet, { 
      header: 1,
      defval: '' 
    }) as any[][];
    
    // ヘッダー行（2行目）を取得
    const headers = data[1] || [];
    
    // データ行（3行目以降）を処理
    const items: BOMItem[] = [];
    for (let i = 2; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;
      
      // 品目コードが空の行はスキップ
      if (!row[1]) continue;
      
      const item: BOMItem = {
        丸高管理No: String(row[0] || ''),
        品目コード: String(row[1] || ''),
        メーカー名: String(row[2] || ''),
        品目名: String(row[3] || ''),
        単位: String(row[4] || ''),
        手配先: String(row[5] || ''),
        員数: Number(row[6]) || 0
      };
      
      items.push(item);
    }
    
    console.log(`${productId} BOMデータ読み込み完了: ${items.length}件, 支給先: ${supplier}`);
    return { items, supplier };
  } catch (error) {
    console.error(`BOMファイル読み込みエラー (${productId}):`, error);
    throw error;
  }
};

// 在庫データを読み込む関数
export const loadInventoryData = (): Map<string, number> => {
  try {
    const filePath = path.join(DATA_DIR, INVENTORY_FILE);
    
    if (!fs.existsSync(filePath)) {
      console.warn(`在庫ファイルが見つかりません: ${filePath}`);
      return new Map();
    }

    const workbook = XLSX.readFile(filePath);
    // 2025年在庫表シートを使用
    const sheetName = '2025年在庫表';
    const sheet = workbook.Sheets[sheetName];
    
    if (!sheet) {
      console.warn(`シート ${sheetName} が見つかりません`);
      return new Map();
    }
    
    // データを配列に変換
    const data = XLSX.utils.sheet_to_json(sheet, { 
      header: 1,
      defval: '' 
    }) as any[][];
    
    // 在庫マップを作成（キー: 品目コード、値: 在庫数）
    const inventoryMap = new Map<string, number>();
    
    // 5行目からデータ開始（1-4行目はヘッダー）
    for (let i = 4; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;
      
      const partNumber = String(row[0] || ''); // A列: Part Number（品目コード）
      const stock = Number(row[8]) || 0; // I列: 在庫数（12/20吉川S/S在庫数）
      
      if (partNumber) {
        inventoryMap.set(partNumber, stock);
      }
    }
    
    console.log(`在庫データ読み込み完了: ${inventoryMap.size}件`);
    return inventoryMap;
  } catch (error) {
    console.error('在庫ファイル読み込みエラー:', error);
    return new Map();
  }
};

// ピッキングリストを生成する関数
export const generatePickingList = (requests: ProductRequest[]): PickingListItem[] => {
  try {
    // 在庫データを読み込み
    const inventoryMap = loadInventoryData();
    
    // 支給先ごとにアイテムを集計するマップ
    const aggregatedMap = new Map<string, PickingListItem>();
    
    // 各製品のBOMを処理
    for (const request of requests) {
      if (!request.productId || request.quantity <= 0) continue;
      
      const { items: bomItems, supplier } = loadBOMData(request.productId);
      
      // 各BOMアイテムを処理
      for (const bomItem of bomItems) {
        // 一意のキーを作成（支給先_品目コード）
        const key = `${supplier}_${bomItem.品目コード}`;
        
        // 準備必要数を計算
        const requiredQuantity = bomItem.員数 * request.quantity;
        
        if (aggregatedMap.has(key)) {
          // 既存のアイテムに数量を追加
          const existing = aggregatedMap.get(key)!;
          existing.準備必要数 += requiredQuantity;
        } else {
          // 新しいアイテムを作成
          const stock = inventoryMap.get(bomItem.品目コード) || 0;
          const shortage = requiredQuantity > stock;
          
          const pickingItem: PickingListItem = {
            丸高管理No: bomItem.丸高管理No,
            品目コード: bomItem.品目コード,
            メーカー名: bomItem.メーカー名,
            品目名: bomItem.品目名,
            単位: bomItem.単位,
            手配先: bomItem.手配先,
            社内在庫数: stock || '該当無し',
            準備必要数: requiredQuantity,
            備考: shortage ? '在庫不足' : '',
            支給先: supplier
          };
          
          aggregatedMap.set(key, pickingItem);
        }
      }
    }
    
    // マップを配列に変換し、在庫不足を再計算
    const result = Array.from(aggregatedMap.values()).map(item => {
      // 在庫不足の判定を更新
      if (typeof item.社内在庫数 === 'number' && item.準備必要数 > item.社内在庫数) {
        item.備考 = '在庫不足';
      }
      return item;
    });
    
    // 支給先、品目コードでソート
    result.sort((a, b) => {
      if (a.支給先 !== b.支給先) {
        return a.支給先.localeCompare(b.支給先);
      }
      return a.品目コード.localeCompare(b.品目コード);
    });
    
    console.log(`ピッキングリスト生成完了: ${result.length}件`);
    return result;
  } catch (error) {
    console.error('ピッキングリスト生成エラー:', error);
    throw error;
  }
};

// Excelファイルを生成する関数
export const generateExcelFile = (items: PickingListItem[]): Buffer => {
  try {
    // ワークブックを作成
    const wb = XLSX.utils.book_new();
    
    // 支給先ごとにシートを作成
    const supplierGroups = new Map<string, PickingListItem[]>();
    
    // 支給先ごとにグループ化
    items.forEach(item => {
      if (!supplierGroups.has(item.支給先)) {
        supplierGroups.set(item.支給先, []);
      }
      supplierGroups.get(item.支給先)!.push(item);
    });
    
    // 各支給先のシートを作成
    supplierGroups.forEach((groupItems, supplier) => {
      // データを配列形式に変換（支給先列を除く）
      const sheetData = [
        // ヘッダー行
        ['丸高管理No', '品目コード', 'メーカー名', '品目名', '単位', '手配先', '社内在庫数', '準備必要数', '備考'],
        // データ行
        ...groupItems.map(item => [
          item.丸高管理No,
          item.品目コード,
          item.メーカー名,
          item.品目名,
          item.単位,
          item.手配先,
          item.社内在庫数,
          item.準備必要数,
          item.備考
        ])
      ];
      
      // シートを作成
      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      
      // 列幅を設定
      ws['!cols'] = [
        { wch: 12 }, // 丸高管理No
        { wch: 15 }, // 品目コード
        { wch: 20 }, // メーカー名
        { wch: 30 }, // 品目名
        { wch: 8 },  // 単位
        { wch: 15 }, // 手配先
        { wch: 12 }, // 社内在庫数
        { wch: 12 }, // 準備必要数
        { wch: 12 }  // 備考
      ];
      
      // シート名を設定（Excelのシート名制限: 31文字以内）
      const sheetName = supplier.substring(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });
    
    // Excelファイルをバッファとして生成
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    console.log('Excelファイル生成完了');
    return buffer;
  } catch (error) {
    console.error('Excelファイル生成エラー:', error);
    throw error;
  }
};
// CommonJS形式でエクスポート（これだけ残す）
module.exports = {
  generatePickingList,
  generateExcelFile,
  loadBOMData,
  loadInventoryData
};