import React, { useState } from 'react';

const PickingList = () => {
  const [products, setProducts] = useState([
    { id: '1', name: '', quantity: 0 }
  ]);
  const [result, setResult] = useState({ items: [], suppliers: [] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const productOptions = ['Z4①', 'Z4②', 'Z4③'];

  const handleProductChange = (id, value) => {
    setProducts(products.map(p => 
      p.id === id ? { ...p, name: value } : p
    ));
  };

  const handleQuantityChange = (id, value) => {
    setProducts(products.map(p => 
      p.id === id ? { ...p, quantity: parseInt(value) || 0 } : p
    ));
  };

  const addProduct = () => {
    if (products.length < 3) {
      setProducts([...products, { id: Date.now().toString(), name: '', quantity: 0 }]);
    }
  };

  const removeProduct = (id) => {
    if (products.length > 1) {
      setProducts(products.filter(p => p.id !== id));
    }
  };

  const generateList = async () => {
    setLoading(true);
    setError('');
    
    try {
      const validProducts = products
        .filter(p => p.name && p.quantity > 0)
        .map(p => ({ name: p.name, quantity: p.quantity }));
      
      console.log('フィルター後:', validProducts);
      if (validProducts.length === 0) {
        setError('製品と数量を入力してください');
        setLoading(false);
        return;
      }
      
      const response = await fetch('http://localhost:3001/api/picking-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: validProducts })
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || 'サーバーエラー');
      }
      
      const data = await response.json();
      console.log('受信データ全体:', data);
      console.log('data.data:', data.data);
      console.log('data.suppliers:', data.suppliers);
      
      // 新しいデータ構造（配列形式）に対応
      if (data.success && data.data) {
        setResult({
          items: data.data,
          suppliers: data.suppliers || []
        });
        console.log('resultにセット:', data.data);
      } else {
        setResult({ items: [], suppliers: [] });
        throw new Error('データの取得に失敗しました');
      }
    } catch (err) {
      console.error('エラー詳細:', err);
      setError('エラー: ' + err.message);
      setResult({ items: [], suppliers: [] });
    }
    
    setLoading(false);
  };

  // Excel出力機能
  const exportToExcel = async () => {
    try {
      // Excel用のデータを整形
      const excelData = result.items.map(item => {
        const row = {
          '丸高管理No': item.managementNo || '',
          '品目コード': item.itemCode,
          'メーカー名': item.manufacturer,
          '品目名': item.itemName,
          '単位': item.unit,
          '手配先': item.supplier,
          '社内在庫数': item.stockQuantity
        };
        
        // 支給先ごとの数量を追加
        result.suppliers.forEach(supplier => {
          row[supplier] = item.quantities[supplier] || 0;
        });
        
        row['合計必要数'] = item.totalRequired;
        row['在庫不足数'] = item.shortageQuantity > 0 ? item.shortageQuantity : '';
        
        return row;
      });

      const response = await fetch('http://localhost:3001/api/export-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: excelData })
      });

      if (!response.ok) {
        throw new Error('Excel出力に失敗しました');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `picking_list_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Excel出力エラー:', err);
      setError('Excel出力に失敗しました');
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>MTTC購買代行</h1>
      
      <h2 style={{ fontSize: '20px', marginBottom: '15px' }}>ピッキングリスト自動作成システム</h2>
      
      {error && (
        <div style={{
          color: 'red', 
          padding: '10px', 
          border: '1px solid red', 
          marginBottom: '20px',
          borderRadius: '4px',
          backgroundColor: '#ffebee'
        }}>
          {error}
        </div>
      )}
      
      <div style={{ marginBottom: '20px' }}>
        <h3>製品選択</h3>
        <table style={{ borderSpacing: '10px' }}>
          <thead>
            <tr>
              <th style={{ padding: '10px', textAlign: 'left', minWidth: '80px' }}>製品</th>
              <th style={{ padding: '10px', textAlign: 'left', minWidth: '100px' }}>製作台数</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {products.map(product => (
              <tr key={product.id}>
                <td style={{ padding: '8px' }}>
                  <select 
                    value={product.name}
                    onChange={(e) => handleProductChange(product.id, e.target.value)}
                    style={{ padding: '8px', width: '150px', fontSize: '14px' }}
                  >
                    <option value="">選択してください</option>
                    {productOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </td>
                <td style={{ padding: '8px' }}>
                  <input
                    type="number"
                    min="0"
                    value={product.quantity}
                    onChange={(e) => handleQuantityChange(product.id, e.target.value)}
                    style={{ width: '120px', padding: '8px', fontSize: '14px' }}
                  />
                </td>
                <td style={{ padding: '8px' }}>
                  {products.length > 1 && (
                    <button 
                      onClick={() => removeProduct(product.id)}
                      style={{ padding: '8px 15px', cursor: 'pointer', fontSize: '14px' }}
                    >
                      削除
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {products.length < 3 && (
          <button 
            onClick={addProduct}
            style={{ 
              marginTop: '10px', 
              padding: '5px 15px',
              cursor: 'pointer'
            }}
          >
            製品を追加
          </button>
        )}
      </div>
      
      <button 
        onClick={generateList}
        disabled={loading}
        style={{
          padding: '10px 20px',
          backgroundColor: '#2196F3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'wait' : 'pointer'
        }}
      >
        {loading ? '生成中...' : 'ピッキングリスト生成'}
      </button>
      
      {result && result.items && result.items.length > 0 && (
        <div style={{ marginTop: '20px', position: 'relative' }}>
          <h3>ピッキングリスト結果</h3>
          
          {/* Excel出力ボタン（右下配置） */}
          <button 
            onClick={exportToExcel}
            style={{
              position: 'absolute',
              right: '0',
              top: '0',
              padding: '10px 20px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            Excel出力
          </button>

          {/* 統合されたテーブル */}
          <table border="1" style={{ borderCollapse: 'collapse', width: '100%', marginTop: '50px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th style={{ padding: '8px' }}>丸高管理No</th>
                <th style={{ padding: '8px' }}>品目コード</th>
                <th style={{ padding: '8px' }}>メーカー名</th>
                <th style={{ padding: '8px' }}>品目名</th>
                <th style={{ padding: '8px' }}>単位</th>
                <th style={{ padding: '8px' }}>手配先</th>
                <th style={{ padding: '8px' }}>社内在庫数</th>
                {/* 支給先ごとの列 */}
                {result.suppliers.map(supplier => (
                  <th key={supplier} style={{ 
                    padding: '8px', 
                    backgroundColor: '#e8f5e9',
                    fontWeight: 'bold' 
                  }}>
                    {supplier}
                  </th>
                ))}
                <th style={{ padding: '8px', backgroundColor: '#fff3e0' }}>合計必要数</th>
                <th style={{ padding: '8px', backgroundColor: '#ffebee' }}>在庫不足数</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((item, idx) => (
                <tr key={idx} style={item.shortageQuantity > 0 ? {backgroundColor: '#ffebee'} : {}}>
                  <td style={{ padding: '8px' }}>{item.managementNo || ''}</td>
                  <td style={{ padding: '8px' }}>{item.itemCode}</td>
                  <td style={{ padding: '8px' }}>{item.manufacturer || ''}</td>
                  <td style={{ padding: '8px' }}>{item.itemName}</td>
                  <td style={{ padding: '8px' }}>{item.unit}</td>
                  <td style={{ padding: '8px' }}>{item.supplier || ''}</td>
                  <td style={{ 
                    padding: '8px', 
                    textAlign: item.stockQuantity === '該当無し' ? 'center' : 'right' 
                  }}>
                    {item.stockQuantity}
                  </td>
                  {/* 支給先ごとの数量 */}
                  {result.suppliers.map(supplier => (
                    <td key={supplier} style={{ 
                      padding: '8px', 
                      textAlign: 'right',
                      backgroundColor: item.quantities[supplier] > 0 ? '#f5f5f5' : 'transparent'
                    }}>
                      {item.quantities[supplier] || 0}
                    </td>
                  ))}
                  <td style={{ 
                    padding: '8px', 
                    textAlign: 'right',
                    backgroundColor: '#fff3e0',
                    fontWeight: 'bold'
                  }}>
                    {item.totalRequired}
                  </td>
                  <td style={{ 
                    padding: '8px', 
                    textAlign: 'right',
                    color: item.shortageQuantity > 0 ? 'red' : 'black',
                    fontWeight: item.shortageQuantity > 0 ? 'bold' : 'normal'
                  }}>
                    {item.shortageQuantity > 0 ? item.shortageQuantity : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PickingList;