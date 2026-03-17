import React from 'react';

const Column = ({ children, gap = 0 }: { children: React.ReactNode; gap?: number }) => {
  return <div style={{ display: 'flex', flexDirection: 'column', gap }}>{children}</div>;
};

export default Column;
