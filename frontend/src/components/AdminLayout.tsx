import { useEffect, useState, type ReactNode } from "react";
import "./AdminUI.css";
import "./AdminMuseumTheme.css";
import { getStore, subscribeStore, type HXRSystemState } from "../syncStore";

interface AdminLayoutProps {
  activePage: "studio" | "center";
  onNavigate: (page: "user" | "studio" | "center" | "split") => void;
  children: ReactNode;
}

export function AdminLayout({
  activePage,
  onNavigate,
  children,
}: AdminLayoutProps) {
  const [store, setStore] = useState<HXRSystemState>(() => getStore());

  useEffect(() => {
    return subscribeStore(setStore);
  }, []);

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand"><span className="admin-brand-mark">HX</span><div><strong>HeritageXR</strong><span>Bảo tàng tương tác</span></div></div>
        <nav className="admin-nav" aria-label="Điều hướng quản trị">
          <button type="button" className={activePage === "center" ? "is-active" : ""} aria-current={activePage === "center" ? "page" : undefined} onClick={() => onNavigate("center")}>
            <span className="admin-nav-icon" aria-hidden="true">▥</span><span>Thống kê & Quầy</span>
            {!store.watermarkUnlocked && <span className="admin-pending-dot" />}
          </button>
          <button type="button" className={activePage === "studio" ? "is-active" : ""} aria-current={activePage === "studio" ? "page" : undefined} onClick={() => onNavigate("studio")}>
            <span className="admin-nav-icon" aria-hidden="true">✦</span><span>Xưởng hiện vật</span>
          </button>
        </nav>
        <div className="admin-sidebar-footer">
          <button type="button" className="admin-visitor-link" onClick={() => window.open("/", "_blank")}>↗ Mở trang du khách</button>
        </div>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar"><div><span className="admin-breadcrumb">HeritageXR / Quản trị</span><strong>{activePage === "studio" ? "Xưởng hiện vật" : "Thống kê & Quầy"}</strong></div><div className="admin-manager-profile" aria-label="Hồ sơ Manager"><span className="admin-manager-avatar" aria-hidden="true">M</span><div><strong>Manager</strong><span>Quản lý bảo tàng</span></div></div></header>
        <main className="admin-main">{children}</main>
      </div>
      <footer className="admin-mobile-footer"><button type="button" className="admin-visitor-link" onClick={() => window.open("/", "_blank")}>↗ Mở trang du khách</button></footer>
    </div>
  );
}
