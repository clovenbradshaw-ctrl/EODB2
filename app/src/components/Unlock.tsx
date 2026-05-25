import { useState } from 'react';

interface Props {
  userId: string;
  onSubmit: (userId: string, password: string) => void;
  onSwitchAccount: () => void;
}

export function Unlock({ userId, onSubmit, onSwitchAccount }: Props) {
  const [password, setPassword] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    onSubmit(userId, password);
  };

  return (
    <form className="panel login" onSubmit={submit}>
      <h2>Unlock</h2>
      <p className="dim small">
        Welcome back. This device already has a local vault for{' '}
        <strong>{userId}</strong>. Enter your password to decrypt local data.
      </p>
      <label>
        Password
        <input
          autoFocus
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <div className="btn-row">
        <button type="submit" className="primary">
          Unlock
        </button>
        <button type="button" onClick={onSwitchAccount}>
          Use different account
        </button>
      </div>
    </form>
  );
}
