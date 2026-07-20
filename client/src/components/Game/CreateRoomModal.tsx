import React, { useEffect, useState } from 'react';

interface CreateRoomModalProps {
  visible: boolean;
  defaultName?: string;
  onClose: () => void;
  onCreate: (title: string) => void;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ visible, defaultName = '', onClose, onCreate }) => {
  const [title, setTitle] = useState(defaultName);

  useEffect(() => {
    if (visible) setTitle(defaultName);
  }, [visible, defaultName]);

  if (!visible) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onCreate(trimmed);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <button className="modal-back" onClick={onClose}>←</button>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '18px' }}>방 만들기</div>
          </div>
        </div>

        <form className="modal-body" onSubmit={handleSubmit}>
          <label className="modal-label">방 이름</label>
          <input
            className="modal-input"
            maxLength={20}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="사자의 방"
          />
          <div className="modal-helper">방 이름을 입력하세요 (최대 20자)</div>

          <div style={{ marginTop: 18 }}>
            <button type="submit" className="btn" style={{ fontWeight: 800 }}>
              방 생성하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateRoomModal;
