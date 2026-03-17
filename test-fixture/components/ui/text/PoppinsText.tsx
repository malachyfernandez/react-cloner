import React from 'react';

const PoppinsText = ({ weight = 'regular', children }: { weight?: string; children: React.ReactNode }) => {
  return <span style={{ fontWeight: weight === 'bold' ? 'bold' : 'normal' }}>{children}</span>;
};

export default PoppinsText;
