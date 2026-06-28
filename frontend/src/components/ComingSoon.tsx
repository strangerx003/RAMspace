import React from 'react';

interface Props {
  title: string;
  desc: string;
}

export default function ComingSoon({ title, desc }: Props) {
  return (
    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
      <div style={{ fontSize: '48px', marginBottom: '12px', opacity: .3 }}>🔧</div>
      <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#e4e6f0', marginBottom: '4px' }}>{title}</h3>
      <p style={{ fontSize: '12px', color: '#5c6078', maxWidth: '300px' }}>{desc}</p>
      <div style={{ marginTop: '16px', padding: '6px 14px', background: 'rgba(79,143,247,.1)', borderRadius: '6px', display: 'inline-block', fontSize: '11px', color: '#4f8ff7', fontWeight: 600 }}>
        Coming Soon
      </div>
    </div>
  );
}
