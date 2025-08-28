// frontend-new/src/App.tsx
// import React from 'react'; ← この行を削除
import './App.css'
import PickingList from './components/PickingList';

function App() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>MTTCシステム</h1>
      <PickingList />
    </div>
  );
}

export default App;