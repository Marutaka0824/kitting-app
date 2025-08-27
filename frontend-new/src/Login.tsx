// frontend-new/src/Login.tsx
import React, { useState } from 'react';

interface LoginProps {
  onLoginSuccess: (token: string, user: any) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true); // true: ログイン, false: 新規登録
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ログイン処理
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        // ログイン成功
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        onLoginSuccess(data.token, data.user);
      } else {
        setError(data.error || 'ログインに失敗しました');
      }
    } catch (err) {
      setError('サーバーに接続できません');
    } finally {
      setLoading(false);
    }
  };

  // 新規登録処理
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });

      const data = await response.json();

      if (response.ok) {
        // 登録成功後、自動的にログイン
        alert('登録が完了しました。ログインしてください。');
        setIsLogin(true);
        setPassword('');
      } else {
        setError(data.error || '登録に失敗しました');
      }
    } catch (err) {
      setError('サーバーに接続できません');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom, #DBEAFE, #EBF8FF)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        padding: '40px',
        width: '100%',
        maxWidth: '400px'
      }}>
        {/* タイトル */}
        <h1 style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#1E40AF',
          textAlign: 'center',
          marginBottom: '8px'
        }}>
          キッティングリスト MTTC
        </h1>
        
        <h2 style={{
          fontSize: '18px',
          color: '#4B5563',
          textAlign: 'center',
          marginBottom: '24px'
        }}>
          {isLogin ? 'ログイン' : '新規登録'}
        </h2>

        {/* エラーメッセージ */}
        {error && (
          <div style={{
            background: '#FEE2E2',
            color: '#DC2626',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        {/* フォーム */}
        <form onSubmit={isLogin ? handleLogin : handleRegister}>
          {/* 名前（新規登録時のみ） */}
          {!isLogin && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                marginBottom: '4px',
                color: '#374151',
                fontSize: '14px'
              }}>
                お名前
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={!isLogin}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  fontSize: '16px',
                  outline: 'none'
                }}
                placeholder="山田太郎"
              />
            </div>
          )}

          {/* メールアドレス */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '4px',
              color: '#374151',
              fontSize: '14px'
            }}>
              メールアドレス
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                fontSize: '16px',
                outline: 'none'
              }}
              placeholder="example@email.com"
            />
          </div>

          {/* パスワード */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              marginBottom: '4px',
              color: '#374151',
              fontSize: '14px'
            }}>
              パスワード {!isLogin && '（6文字以上）'}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                fontSize: '16px',
                outline: 'none'
              }}
              placeholder="••••••••"
            />
          </div>

          {/* 送信ボタン */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: loading ? '#9CA3AF' : '#2563EB',
              color: 'white',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: '600',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: '16px'
            }}
          >
            {loading ? '処理中...' : (isLogin ? 'ログイン' : '登録')}
          </button>
        </form>

        {/* デモ用：管理者でログイン */}
        {isLogin && (
          <button
            onClick={() => {
              setEmail('admin@example.com');
              setPassword('admin123');
            }}
            style={{
              width: '100%',
              padding: '8px',
              background: '#10B981',
              color: 'white',
              borderRadius: '6px',
              fontSize: '14px',
              border: 'none',
              cursor: 'pointer',
              marginBottom: '16px'
            }}
          >
            デモ: 管理者情報を入力
          </button>
        )}

        {/* 切り替えリンク */}
        <div style={{
          textAlign: 'center',
          fontSize: '14px',
          color: '#6B7280'
        }}>
          {isLogin ? (
            <>
              アカウントをお持ちでない方は
              <button
                onClick={() => setIsLogin(false)}
                style={{
                  color: '#2563EB',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  marginLeft: '4px'
                }}
              >
                新規登録
              </button>
            </>
          ) : (
            <>
              既にアカウントをお持ちの方は
              <button
                onClick={() => setIsLogin(true)}
                style={{
                  color: '#2563EB',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  marginLeft: '4px'
                }}
              >
                ログイン
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;