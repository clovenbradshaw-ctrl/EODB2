import { useState } from 'react';

interface Props {
  onSubmit: (homeserver: string, username: string, password: string) => void;
}

export function Login({ onSubmit }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [homeserver, setHomeserver] = useState('https://app.aminoimmigration.com');

  // Auto-fill the homeserver from the MXID's server-name part so users
  // typing `@alice:matrix.org` don't have to enter the URL twice.
  const onUsernameChange = (value: string) => {
    setUsername(value);
    if (value.includes(':')) {
      setHomeserver('https://' + value.split(':').slice(1).join(':'));
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    onSubmit(homeserver.trim(), username.trim(), password);
  };

  const showHsField = !username.includes(':');

  return (
    <form className="panel login" onSubmit={submit}>
      <h2>Connect</h2>
      <label>
        Username
        <input
          autoFocus
          placeholder="@user:homeserver.com"
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
        />
      </label>
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {showHsField && (
        <label>
          Homeserver
          <input
            placeholder="https://matrix.org"
            value={homeserver}
            onChange={(e) => setHomeserver(e.target.value)}
          />
        </label>
      )}
      <button type="submit" className="primary">
        Login
      </button>
    </form>
  );
}
