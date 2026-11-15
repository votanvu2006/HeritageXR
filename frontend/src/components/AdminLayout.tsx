import { useEffect, useState, type ReactNode } from "react";
import "./AdminUI.css";
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
        <div className="admin-brand"><span className="admin-brand-mark">HX</span><div><strong>HeritageXR</strong><span>Quản trị Bảo tàng</span></div></div>
        <div className="admin-nav-label">KHÔNG GIAN LÀM VIỆC</div>
        <nav className="admin-nav" aria-label="Điều hướng quản trị">
          <button type="button" className={activePage === "center" ? "is-active" : ""} aria-current={activePage === "center" ? "page" : undefined} onClick={() => onNavigate("center")}>
            <span className="admin-nav-icon" aria-hidden="true">▥</span><span>Thống kê & Quầy</span>
            {!store.watermarkUnlocked && <span className="admin-pending-dot" />}
          </button>
          <button type="button" className={activePage === "studio" ? "is-active" : ""} aria-current={activePage === "studio" ? "page" : undefined} onClick={() => onNavigate("studio")}>
            <span className="admin-nav-icon" aria-hidden="true">✦</span><span>AI Studio</span>
          </button>
        </nav>
        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-note">HeritageXR<span>Bảo tồn di sản · Kết nối trải nghiệm</span></div>
          <button type="button" className="admin-visitor-link" onClick={() => window.open("/", "_blank")}>↗ Mở trang Du khách</button>
          <button type="button" className="admin-home-link" onClick={() => onNavigate("user")}>← Về trang chính</button>
        </div>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar"><div><span className="admin-breadcrumb">HeritageXR / Quản trị</span><strong>{activePage === "studio" ? "AI Studio" : "Thống kê & Quầy"}</strong></div><span className="admin-workspace-badge">KHÔNG GIAN QUẢN TRỊ</span></header>
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}
