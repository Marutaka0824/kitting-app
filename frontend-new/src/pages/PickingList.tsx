// src/pages/PickingList.tsx
import React, { useState } from 'react';

type ProductInput = {
  productId: string;
  quantity: number;
};

const PickingList: React.FC = () => {
  const [products, setProducts] = useState<ProductInput[]>([]);
  const [result, setResult] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleAddProduct = () => {
    if (products.length >= 3) return;
    setProducts([...products, { productId: '', quantity: 1 }]);
  };

  const handleChange = (index: number, field: keyof ProductInput, value: string | number) => {
    const updated = [...products];
    updated[index][field] = field === 'quantity' ? Number(value) : String(value);
    setProducts(updated);
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/picking/generate', {
        method: 'POST',
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
      const res = await fetch('/api/picking/excel', {
        method: 'POST',
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
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">ピッキングリスト作成</h1>

      <div className="space-y-4 mb-6">
        {products.map((p, i) => (
          <div key={i} className="flex gap-4">
            <select
              value={p.productId}
              onChange={(e) => handleChange(i, 'productId', e.target.value)}
              className="border p-2 rounded"
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
              className="border p-2 rounded w-24"
            />
          </div>
        ))}
        {products.length < 3 && (
          <button onClick={handleAddProduct} className="bg-blue-500 text-white px-4 py-2 rounded">
            製品を追加
          </button>
        )}
      </div>

      <div className="flex gap-4 mb-6">
        <button onClick={handleGenerate} className="bg-green-600 text-white px-4 py-2 rounded">
          ピッキングリスト生成
        </button>
        <button onClick={handleDownloadExcel} className="bg-indigo-600 text-white px-4 py-2 rounded">
          Excel出力
        </button>
      </div>

      {loading && <p>読み込み中...</p>}

      {result.length > 0 && (
        <table className="table-auto w-full border">
          <thead>
            <tr className="bg-gray-200">
              <th>丸高管理No</th>
              <th>品目コード</th>
              <th>メーカー名</th>
              <th>品目名</th>
              <th>単位</th>
              <th>手配先</th>
              <th>社内在庫数</th>
              <th>準備必要数</th>
              <th>備考</th>
            </tr>
          </thead>
          <tbody>
            {result.map((item, i) => (
              <tr key={i} className={item.備考 === '在庫不足' ? 'bg-red-100' : ''}>
                <td>{item.丸高管理No}</td>
                <td>{item.品目コード}</td>
                <td>{item.メーカー名}</td>
                <td>{item.品目名}</td>
                <td>{item.単位}</td>
                <td>{item.手配先}</td>
                <td>{item.社内在庫数}</td>
                <td>{item.準備必要数}</td>
                <td>{item.備考}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default PickingList;