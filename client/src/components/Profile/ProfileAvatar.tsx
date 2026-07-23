import { useState } from 'react';

interface Props {
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function ProfileAvatar({ src, size = 'md', className }: Props) {
  const [error, setError] = useState(false);

  const sizeClass = size === 'lg' ? 'avatar lg' : size === 'sm' ? 'avatar sm' : 'avatar';

  if (!src || error) {
    return <div className={`${sizeClass} ${className || ''}`.trim()}>🦁</div>;
  }

  return (
    <div className={`${sizeClass} ${className || ''}`.trim()} style={{ overflow: 'hidden' }}>
      <img
        src={src}
        alt="profile"
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        onError={() => setError(true)}
      />
    </div>
  );
}
