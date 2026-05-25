import { useState } from 'react';

interface DisplayProps {
  recoveryKey: string;
  onAcknowledge: () => void;
}

export function RecoveryDisplayModal({ recoveryKey, onAcknowledge }: DisplayProps) {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Save your recovery key</h3>
        <p>
          This key restores your message history on new browsers and devices. Save it
          somewhere safe — it cannot be shown again.
        </p>
        <div className="key-display">{recoveryKey}</div>
        <div className="btn-row">
          <button className="primary" onClick={onAcknowledge}>
            I&apos;ve saved it
          </button>
        </div>
      </div>
    </div>
  );
}

interface EntryProps {
  onSubmit: (value: string | null) => void;
}

export function RecoveryEntryModal({ onSubmit }: EntryProps) {
  const [value, setValue] = useState('');
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Enter your recovery key</h3>
        <p>
          This device is new. Paste the recovery key from your first login to decrypt
          prior messages.
        </p>
        <input
          autoFocus
          placeholder="EsTb …"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="btn-row">
          <button
            className="primary"
            onClick={() => onSubmit(value.trim() || null)}
          >
            Unlock
          </button>
          <button onClick={() => onSubmit(null)}>Skip</button>
        </div>
      </div>
    </div>
  );
}
