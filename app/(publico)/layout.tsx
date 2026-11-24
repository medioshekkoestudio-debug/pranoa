import { MenuPublico } from './MenuPublico';

export default function LayoutPublico({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="con-menu">{children}</div>
      <MenuPublico />
    </>
  );
}
