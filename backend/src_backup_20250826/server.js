const express = require('express');
const cors = require('cors');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// データフォルダの作成
const dataDir = path.join(__dirname, '..', 'data');
const bomDir = path.join(dataDir, 'bom');
const inventoryDir = path.join(dataDir, 'inventory');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
if (!fs.existsSync(bomDir)) fs.mkdirSync(bomDir);
if (!fs.existsSync(inventoryDir)) fs.mkdirSync(inventoryDir);

// ヘルスチェック
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

// ピッキングリスト生成
app.post('/api/generate-list', (req, res) => {
  try {
    const { products } = req.body;
    console.log('受信:', products);
    
    let allParts = [];
    
    products.forEach(product => {
      const bomPath = path.join(dataDir, `${product.name}　BOM.xlsx`);
      console.log('BOMファイル確認:', bomPath);
      
      if (fs.existsSync(bomPath)) {
        console.log('ファイル存在確認OK');
        const workbook = XLSX.readFile(bomPath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet, { range: 1 });
        console.log(`${product.name}のデータ数:`, data.length);
        
        data.forEach((row) => {
          const existing = allParts.find(p => p.品目コード === row['品目コード']);
          const needed = (row['員数'] || row['必要数'] || 1) * product.quantity;
          
          if (existing) {
            existing.準備必要数 += needed;
          } else {
            allParts.push({
              丸高管理No: row['丸高\r\n管理No'] || row['丸高管理No'] || '',
              品目コード: row['品目コード'] || '',
              メーカー名: row['メーカー名'] || '',
              品目名: row['品目名'] || '',
              単位: row['単位'] || '',
              手配先: row['手配先'] || '',
              準備必要数: needed,
              社内在庫数: 100,
              備考: needed > 100 ? `不足: ${needed - 100}個` : ''
            });
          }
        });
      }
    });
    
    // 在庫照合
    const inventoryPath = path.join(dataDir, '★Z42244040在庫表.xlsx');
    console.log('在庫ファイル確認:', inventoryPath);
    
    if (fs.existsSync(inventoryPath)) {
      console.log('在庫ファイル読み込み開始');
      const workbook = XLSX.readFile(inventoryPath);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      
      // 6行スキップ（7行目から開始）
      const inventoryData = XLSX.utils.sheet_to_json(sheet, { range: 6 });
      
      console.log('在庫データ数:', inventoryData.length);
      if (inventoryData.length > 0) {
        console.log('在庫データの列名:', Object.keys(inventoryData[0]));
      }
      
      allParts.forEach(part => {
        const inv = inventoryData.find(i => {
          // A列の品目コードで照合
          const itemCode = i['__EMPTY'] || i['品目コード'] || i[Object.keys(i)[0]];
          return itemCode === part.品目コード;
        });
        
        if (inv) {
          // CS列（9/20棚卸総合計）の値を取得
          const stockKey = Object.keys(inv).find(k => k.includes('9/20') || k.includes('棚卸'));
          part.社内在庫数 = inv[stockKey] || inv['__EMPTY_96'] || 0;
          
          if (typeof part.社内在庫数 === 'string') {
            part.社内在庫数 = parseFloat(part.社内在庫数) || 0;
          }
          
          if (part.準備必要数 > part.社内在庫数) {
            part.備考 = `不足: ${part.準備必要数 - part.社内在庫数}個`;
          }
        }
      });
    } else {
      console.log('在庫ファイルが見つかりません');
    }
    
    console.log('結果:', allParts.length, '件');
    res.json(allParts);
  } catch (error) {
    console.error('エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// Excel出力
app.post('/api/export-excel', (req, res) => {
  try {
    const { data } = req.body;
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'ピッキングリスト');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=picking_list.xlsx');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`サーバー起動: http://localhost:${PORT}`);
});