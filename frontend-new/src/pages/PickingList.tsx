// src/pages/PickingList.tsx
import { useState } from 'react';  // React削除

// API URLの定義
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type ProductInput = {
  productId: string;
  quantity: number;
};

const PickingList = () => {  // React.FCを削除
  const [products, setProducts] = useState<ProductInput[]>([]);
  const [result, setResult] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleAddProduct = () => {
    if (products.length >= 3) return;
    setProducts([...products, { productId: '', quantity: 1 }]);
  };

  const handleChange = (index: number, field: keyof ProductInput, value: string | number) => {
    const updated: ProductInput[] = [...products];  // 型を明示
    if (field === 'quantity') {
      updated[index][field] = Number(value);
    } else {
      updated[index][field] = String(value);
    }
    setProducts(updated);
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/picking/generate`, {  // API_URL使用
        method: 'POST',
        credentials: 'include',  // 追加
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products })
      });
      const data = await res.json();
      setResult(data.data || []);
    } catch (err) {
      console.error('生成エラー:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = async () => {
    try {
      const res = await fetch(`${API_URL}/api/picking/excel`, {  // API_URL使用
        method: 'POST',
        credentials: 'include',  // 追加
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products })
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'PickingList.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Excel出力エラー:', err);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>ピッキングリスト作成</h1>

      <div style={{ marginBottom: '24px' }}>
        {products.map((p, i) => (
          <div key={i} style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
            <select
              value={p.productId}
              onChange={(e) => handleChange(i, 'productId', e.target.value)}
              style={{ border: '1px solid #ccc', padding: '8px', borderRadius: '4px' }}
            >
              <option value="">製品を選択</option>
              <option value="Z4①">Z4①</option>
              <option value="Z4②">Z4②</option>
              <option value="Z4③">Z4③</option>
            </select>
            <input
              type="number"
              min={1}
              value={p.quantity}
              onChange={(e) => handleChange(i, 'quantity', e.target.value)}
              style={{ border: '1px solid #ccc', padding: '8px', borderRadius: '4px', width: '96px' }}
            />
          </div>
        ))}
        {products.length < 3 && (
          <button 
            onClick={handleAddProduct} 
            style={{ backgroundColor: '#3b82f6', color: 'white', padding: '8px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
          >
            製品を追加
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <button 
          onClick={handleGenerate} 
          style={{ backgroundColor: '#10b981', color: 'white', padding: '8px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
        >
          ピッキングリスト生成
        </button>
        <button 
          onClick={handleDownloadExcel} 
          style={{ backgroundColor: '#6366f1', color: 'white', padding: '8px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
        >
          Excel出力
        </button>
      </div>

      {loading && <p>読み込み中...</p>}

      {result.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ccc' }}>
          <thead>
            <tr style={{ backgroundColor: '#e5e5e5' }}>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>丸高管理No</th>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>品目コード</th>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>メーカー名</th>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>品目名</th>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>単位</th>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>手配先</th>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>社内在庫数</th>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>準備必要数</th>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>備考</th>
            </tr>
          </thead>
          <tbody>
            {result.map((item, i) => (
              <tr key={i} style={item.備考 === '在庫不足' ? { backgroundColor: '#fee2e2' } : {}}>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>{item.丸高管理No}</td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>{item.品目コード}</td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>{item.メーカー名}</td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>{item.品目名}</td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>{item.単位}</td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>{item.手配先}</td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>{item.社内在庫数}</td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>{item.準備必要数}</td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>{item.備考}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default PickingList;