import express from 'express';
import cors from 'cors';
import multer from 'multer';
import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));

// Multer設定（ファイルアップロード用）
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// 製品定義（Z4①、Z4②、Z4③に変更）
const PRODUCTS = ['Z4①', 'Z4②', 'Z4③'];

// BOMファイルと在庫表のパス（全角スペースに対応）
const BOM_FILES = {
  'Z4①': path.join(__dirname, '..', 'data', 'Z4①　BOM.xlsx'),
  'Z4②': path.join(__dirname, '..', 'data', 'Z4②　BOM.xlsx'),
  'Z4③': path.join(__dirname, '..', 'data', 'Z4③　BOM.xlsx'),
};

const INVENTORY_FILE = path.join(__dirname, '..', 'data', '★Z42244040在庫表.xlsx');

// ピッキングリスト生成API
app.post('/api/picking-list', async (req, res) => {
  try {
    const { products } = req.body;
    console.log('受信したデータ:', products);

    // 支給先ごとにデータを格納するマップ
    const supplierGroups = new Map();

    // 各製品のBOMを読み込んで支給先ごとに集計
    for (const product of products) {
      if (product.quantity > 0) {
        const bomData = readBOM(product.name);
        
        // 支給先を取得（BOMの1行目B列）
        const filePath = BOM_FILES[product.name];
        const workbook = XLSX.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const supplierName = data[0] && data[0][1] ? data[0][1] : '支給先不明';
        
        // 支給先ごとのマップを取得または作成
        if (!supplierGroups.has(supplierName)) {
          supplierGroups.set(supplierName, new Map());
        }
        const partsMap = supplierGroups.get(supplierName);
        
        // BOMデータを支給先ごとに集計
        bomData.forEach(part => {
          const key = String(part.itemCode).trim();
          const requiredQty = part.quantity * product.quantity;
          
          if (partsMap.has(key)) {
            const existing = partsMap.get(key);
            existing.requiredQuantity += requiredQty;
          } else {
            partsMap.set(key, {
              ...part,
              requiredQuantity: requiredQty
            });
          }
        });
      }
    }

    // 在庫表を読み込む
    console.log('在庫表読み込み開始...');
    const inventory = readInventory();
    console.log('在庫表読み込み完了');

    // 全品目コードのマップを作成（重複を排除）
    const allItemsMap = new Map();
    const supplierNames = Array.from(supplierGroups.keys());
    
    // 各支給先のデータを品目コードで集約
    supplierGroups.forEach((partsMap, supplierName) => {
      partsMap.forEach((part, itemCode) => {
        const itemCodeStr = String(itemCode).trim();
        
        if (!allItemsMap.has(itemCodeStr)) {
          const stock = inventory.get(itemCodeStr);
          allItemsMap.set(itemCodeStr, {
            managementNo: stock ? stock.managementNo : '',
            itemCode: part.itemCode,
            manufacturer: part.manufacturer || '',
            itemName: part.itemName,
            unit: part.unit || '個',
            supplier: part.supplier || '',
            stockQuantity: stock ? stock.stockQuantity : '該当無し',
            quantities: {} // 支給先ごとの数量
          });
        }
        
        // 支給先ごとの数量を設定
        const item = allItemsMap.get(itemCodeStr);
        item.quantities[supplierName] = part.requiredQuantity;
      });
    });

    // MapをArrayに変換
    const pickingList = [];
    allItemsMap.forEach((item) => {
      // 合計準備必要数を計算
      let totalRequired = 0;
      Object.values(item.quantities).forEach(qty => {
        totalRequired += qty;
      });
      
      // 在庫不足数を計算
      let shortageQty = 0;
      if (item.stockQuantity !== '該当無し') {
        const shortage = totalRequired - item.stockQuantity;
        if (shortage > 0) {
          shortageQty = shortage;
        }
      }
      
      pickingList.push({
        ...item,
        totalRequired: totalRequired,
        shortageQuantity: shortageQty
      });
    });

    // 手配先でソート
    pickingList.sort((a, b) => {
      if (a.supplier < b.supplier) return -1;
      if (a.supplier > b.supplier) return 1;
      return 0;
    });

    console.log('レスポンス送信:', { 
      success: true, 
      itemCount: pickingList.length,
      suppliers: supplierNames 
    });
    
    res.json({
      success: true,
      data: pickingList,
      suppliers: supplierNames,
      summary: {
        totalItems: pickingList.length,
        totalSuppliers: supplierNames.length,
        suppliers: supplierNames
      }
    });

  } catch (error) {
    console.error('エラー:', error);
    res.status(500).json({
      success: false,
      error: 'ピッキングリスト生成中にエラーが発生しました'
    });
  }
});

// BOMファイル読み込み関数
function readBOM(productName) {
  try {
    const filePath = BOM_FILES[productName];
    console.log(`読み込み中: ${filePath}`);
    
    if (!filePath) {
      throw new Error(`製品 ${productName} のBOMファイルが見つかりません`);
    }

    // ファイルの存在確認
    if (!fs.existsSync(filePath)) {
      console.error(`ファイルが存在しません: ${filePath}`);
      return [];
    }

    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    console.log(`${productName} - 全行数: ${data.length}`);
    console.log(`${productName} - 1行目:`, data[0]);
    console.log(`${productName} - 2行目:`, data[1]);
    console.log(`${productName} - 3行目:`, data[2]);

    // B1セルから支給先を取得
    const supplier = data[0] && data[0][1] ? data[0][1] : '';
    console.log(`${productName} - 支給先: ${supplier}`);

    // ヘッダー行（2行目）から列数を確認
    const headerRow = data[1] || [];
    const columnCount = headerRow.length;
    
    // 員数の列位置を判定（7列なら6番目、8列なら7番目）
    const quantityIndex = columnCount === 8 ? 7 : 6;
    console.log(`${productName} - 列数: ${columnCount}, 員数インデックス: ${quantityIndex}`);

    // ヘッダー行（2行目）をスキップして、データを抽出
    const bomData = [];
    for (let i = 2; i < data.length; i++) {
      const row = data[i];
      if (row && row[1]) { // 品目コード（B列）が存在する場合
        const item = {
          managementNo: row[0] || '',
          itemCode: row[1] || '',
          manufacturer: row[2] || '',
          itemName: row[3] || '',
          unit: row[4] || '個',
          supplier: row[5] || '',
          quantity: parseFloat(row[quantityIndex]) || 0  // 動的に員数位置を指定
        };
        bomData.push(item);
        
        // 最初の3件だけログ出力
        if (bomData.length <= 3) {
          console.log(`  部品${bomData.length}:`, item);
        }
      }
    }

    console.log(`${productName} - BOMデータ件数: ${bomData.length}`);
    return bomData;
  } catch (error) {
    console.error(`BOM読み込みエラー (${productName}):`, error.message);
    console.error('詳細:', error);
    return [];
  }
}

// 在庫表読み込み関数
function readInventory() {
  try {
    const workbook = XLSX.readFile(INVENTORY_FILE);
    // "2025年在庫表"シートを指定
    const sheet = workbook.Sheets["2025年在庫表"] || workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const inventoryMap = new Map();
    
    // ヘッダー行は4行目なので、5行目（index 4）からデータ開始
    for (let i = 4; i < data.length; i++) {
      const row = data[i];
      if (row[0]) { // 品目コード（A列）が存在する場合
        const itemCode = String(row[0]).trim(); // 品目コードを文字列として扱う
        const stockQty = parseFloat(row[8]) || 0; // I列: 社内在庫数
        const managementNo = row[2] || ''; // C列: 丸高管理No
        
        inventoryMap.set(itemCode, {
          itemCode: itemCode,
          managementNo: managementNo,
          stockQuantity: stockQty
        });
      }
    }

    console.log(`在庫表データ件数: ${inventoryMap.size}`);
    return inventoryMap;
  } catch (error) {
    console.error('在庫表読み込みエラー:', error);
    return new Map();
  }
}

// Excel出力API
app.post('/api/export-excel', (req, res) => {
  try {
    const { data } = req.body;

    // ワークブックとワークシートを作成
    const wb = XLSX.utils.book_new();
    
    // データはフロントエンドで整形済み
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'ピッキングリスト');

    // バッファとして書き出し
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // レスポンスヘッダーを設定
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="picking_list.xlsx"');
    
    res.send(buffer);
  } catch (error) {
    console.error('Excel出力エラー:', error);
    res.status(500).json({ error: 'Excel出力に失敗しました' });
  }
});

// ヘルスチェック
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'サーバーは正常に動作しています' });
});

// サーバー起動
app.listen(port, () => {
  console.log(`サーバーが起動しました: http://localhost:${port}`);
  console.log('利用可能なエンドポイント:');
  console.log('  POST /api/picking-list - ピッキングリスト生成');
  console.log('  POST /api/export-excel - Excel出力');
  console.log('  GET  /api/health - ヘルスチェック');
});