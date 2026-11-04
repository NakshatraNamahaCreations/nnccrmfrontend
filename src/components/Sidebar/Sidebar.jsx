import { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  FileText,
  BarChart3,
  Trophy,
  Building2,
  LogOut,
  CreditCard,
  Settings,
  ClipboardList,
  Wallet,
  TrendingUp,
  BookOpen,
  MessageSquare,
  UserCheck,
  PiggyBank,
  X,
  Grid3X3,
  ReceiptText,
  Briefcase,
  ShieldCheck,
  Plug,
  Repeat,
  Headset,
  SearchCheck,
} from "lucide-react";
import nncLogo from "../../assets/nnclogo.png";
import "./Sidebar.css";
import TeamChat from "../TeamChat/TeamChat";

/* Bottom nav items shown on mobile (most-used pages) */
const BOTTOM_NAV = [
  { label: "Today",  path: "/todays-plan", key: "todays-plan", icon: ClipboardList   },
  { label: "Leads",  path: "/leads",       key: "all-leads",   icon: Users           },
  { label: "Home",   path: "/dashboard",   key: "dashboard",   icon: LayoutDashboard },
  { label: "Reports",path: "/analytics",   key: "analytics",   icon: BarChart3       },
];

const API_BASE = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:5000";

export default function Sidebar() {
  const nav = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const sbContentRef  = useRef(null);
  const scrollPosRef  = useRef(0);
  const [newEnquiryCount, setNewEnquiryCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const token = localStorage.getItem("nnc_token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        // Unseen (new, not-yet-viewed) enquiries across BOTH sites — matches the
        // alert badges on the Enquiries tabs.
        const [nncRes, digiRes] = await Promise.all([
          fetch(`${API_BASE}/api/enquiries/stats?site=nnc`,        { headers }),
          fetch(`${API_BASE}/api/enquiries/stats?site=nncdigital`, { headers }),
        ]);
        const [nncJson, digiJson] = await Promise.all([nncRes.json(), digiRes.json()]);
        const total =
          (nncJson?.success  ? (nncJson.data.unseen  || 0) : 0) +
          (digiJson?.success ? (digiJson.data.unseen || 0) : 0);
        setNewEnquiryCount(total);
      } catch { /* silent */ }
    };
    fetchCount();
    // Poll every 30s so new leads alert on the sidebar without navigating
    const id = setInterval(fetchCount, 30000);
    return () => clearInterval(id);
  }, [location.pathname]);

  /* Close drawer on route change, but restore sidebar scroll position */
  useEffect(() => {
    setOpen(false);
    /* Restore scroll after render so the active item stays visible */
    if (sbContentRef.current) {
      sbContentRef.current.scrollTop = scrollPosRef.current;
    }
  }, [location.pathname]);

  /* Lock body scroll while drawer is open on mobile */
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const { storedUser, isSuperAdmin, allowedModules } = useMemo(() => {
    try {
      const user = localStorage.getItem("nnc_user");
      const parsed = user ? JSON.parse(user) : null;
      const isSuper = !parsed || parsed?.role === "master_admin" || parsed?.modules == null;
      const mods = isSuper ? null : (Array.isArray(parsed?.modules) ? parsed.modules : []);
      return { storedUser: parsed, isSuperAdmin: isSuper, allowedModules: mods };
    } catch {
      return { storedUser: null, isSuperAdmin: true, allowedModules: null };
    }
  }, []);

  const userName      = storedUser?.name || "Master Admin";
  const userRole      = storedUser?.role || "master_admin";
  const userRoleLabel = userRole === "master_admin" ? "Super Admin" : (userRole || "User");

  const initials = useMemo(() => {
    const parts = String(userName).trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}`.toUpperCase();
  }, [userName]);

  const canSee = (moduleKey, adminOnly = false) => {
    if (adminOnly) return isSuperAdmin;
    if (allowedModules === null) return true;
    return allowedModules.some(m => m === moduleKey || m === `${moduleKey}:view` || m === `${moduleKey}:edit`);
  };

  const rawSections = [
    {
      title: "Overview",
      items: [
        { label: "Owner's Desk",      path: "/owner-desk",  moduleKey: "owner-desk",        icon: <Briefcase size={15} /> },
        { label: "All Leads",         path: "/sales-desk",  moduleKey: "all-leads",         icon: <Headset size={15} />, badge: newEnquiryCount || null },
        { label: "SEO & Ads Team",    path: "/seo-team",    moduleKey: "seo-team",          icon: <SearchCheck size={15} /> },
        { label: "Employee Portal",   path: "/employee-portal", moduleKey: "employee-portal", icon: <UserCheck size={15} /> },
        { label: "NNC Credentials", path: "/credentials", moduleKey: "credentials-vault", icon: <ShieldCheck size={15} /> },
        { label: "Today's Plan",  path: "/todays-plan", moduleKey: "todays-plan", icon: <ClipboardList size={15} /> },
        { label: "Dashboard",     path: "/dashboard",   moduleKey: "dashboard",   icon: <LayoutDashboard size={15} /> },
      ],
    },
    {
      title: "Sales",
      items: [
        // "All Leads" (/enquiries) is hidden: new leads are worked from All Leads (/sales-desk). The page still opens at /enquiries.
        { label: "Projects", path: "/leads",     moduleKey: "all-leads", icon: <Users size={15} /> },
        { label: "Monthly & Extras", path: "/monthly-billing", moduleKey: "all-leads", icon: <Repeat size={15} /> },
        { label: "Credential Vault", path: "/integrations", moduleKey: "integrations", icon: <Plug size={15} /> },
        { label: "Quotations", path: "/quotations",  moduleKey: "quotations",  icon: <ReceiptText size={15} /> },
        { label: "Calendar",   path: "/calendar",    moduleKey: "calendar",    icon: <CalendarDays size={15} /> },
      ],
    },
    {
      title: "Documents",
      items: [
        { label: "Documents", path: "/documents", moduleKey: "documents", icon: <FileText size={15} /> },
      ],
    },
    {
      title: "Analytics",
      items: [
        { label: "Analytics",       path: "/analytics",      moduleKey: "analytics",      icon: <BarChart3 size={15} /> },
        { label: "Leaderboard",     path: "/leaderboard",    moduleKey: "leaderboard",    icon: <Trophy size={15} /> },
        { label: "Branch Reports",  path: "/branch-reports", moduleKey: "branch-reports", icon: <Building2 size={15} /> },
        { label: "Payment Tracker", path: "/payment-tracker",moduleKey: "payment-tracker",icon: <CreditCard size={15} /> },
        { label: "Expense Tracker", path: "/expense-tracker",moduleKey: "expense-tracker",icon: <Wallet size={15} /> },
        { label: "P&L Report",      path: "/pnl",            moduleKey: "pnl",            icon: <TrendingUp size={15} /> },
        { label: "GST Report",      path: "/gst-report",     moduleKey: "gst-report",     icon: <ReceiptText size={15} /> },
        { label: "Reserve Funds",   path: "/funds",          moduleKey: "funds",          icon: <PiggyBank size={15} /> },
        { label: "Accounting",      path: "/accounting",     moduleKey: "accounting",     icon: <BookOpen size={15} /> },
        { label: "Settings",        path: "/settings",       moduleKey: "settings",       icon: <Settings size={15} /> },
      ],
    },
    {
      title: "HR",
      items: [
        { label: "Attendance & Salary", path: "/attendance", moduleKey: "attendance", icon: <UserCheck size={15} /> },
      ],
    },
  ];

  const menuSections = rawSections
    .map(s => ({ ...s, items: s.items.filter(i => canSee(i.moduleKey, i.adminOnly)) }))
    .filter(s => s.items.length > 0);

  const isActive = (path) => location.pathname === path;

  const goTo = (path) => {
    /* Save current scroll position before navigating */
    if (sbContentRef.current) {
      scrollPosRef.current = sbContentRef.current.scrollTop;
    }
    nav(path);
  };

  const handleLogout = () => {
    ["nnc_auth","nnc_token","nnc_role","nnc_email","nnc_user","nnc_modules"].forEach(k => localStorage.removeItem(k));
    nav("/", { replace: true });
  };

  return (
    <>
      {/* ── Backdrop (mobile drawer open) ───────────────────── */}
      {open && <div className="sbBackdrop" onClick={() => setOpen(false)} />}

      {/* ── Sidebar / Drawer ─────────────────────────────────── */}
      <aside className={`sb${open ? " sb-open" : ""}`}>

        {/* Close button — only shown inside drawer on mobile */}
        <button className="sbMobileClose" onClick={() => setOpen(false)} aria-label="Close menu">
          <X size={16} />
        </button>

        <div className="sbTop" onClick={() => goTo("/todays-plan")} style={{ cursor: "pointer" }}>
          <div className="sbBrandRow">
            <div className="sbLogoWrap">
              <img src={nncLogo} alt="NNC Logo" className="sbLogoImage" />
            </div>
            <div className="sbBrandText">
              <div className="sbTitle">NNC CRM</div>
              <div className="sbSub">Website Services Dashboard</div>
            </div>
          </div>
        </div>

        <div className="sbContent" ref={sbContentRef}>
          {menuSections.map(section => (
            <div className="sbGroup" key={section.title}>
              <div className="sbGroupTitle">{section.title}</div>
              <div className="sbGroupItems">
                {section.items.map(item => (
                  <Item
                    key={item.path}
                    icon={item.icon}
                    label={item.label}
                    badge={item.badge}
                    active={isActive(item.path)}
                    onClick={() => goTo(item.path)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="sbBottomWrap">
          <div className="sbUserCard">
            <div className="sbUserAvatar">{initials}</div>
            <div className="sbUserInfo">
              <div className="sbUserName">{userName}</div>
              <div className="sbUserRole">{userRoleLabel}</div>
            </div>
          </div>
          <button type="button" className="sbLogoutBtn" onClick={handleLogout}>
            <span className="sbLogoutIcon"><LogOut size={15} /></span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile bottom navigation bar ─────────────────────── */}
      <nav className="sbMobileNav">
        {BOTTOM_NAV.filter(item => canSee(item.key)).map(item => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              className={`sbMobileNavItem${active ? " active" : ""}`}
              onClick={() => goTo(item.path)}
            >
              <span className="sbMobileNavIcon"><Icon size={21} /></span>
              <span className="sbMobileNavLabel">{item.label}</span>
            </button>
          );
        })}
        {/* "More" opens the full drawer */}
        <button
          className={`sbMobileNavItem${open ? " active" : ""}`}
          onClick={() => setOpen(v => !v)}
        >
          <span className="sbMobileNavIcon">
            {open ? <X size={21} /> : <Grid3X3 size={21} />}
          </span>
          <span className="sbMobileNavLabel">More</span>
        </button>
      </nav>

      {/* Team chat with Employee Portal staff */}
      {canSee("employee-portal") && <TeamChat />}
    </>
  );
}

function Item({ label, badge, active, onClick, icon }) {
  return (
    <button type="button" className={`sbItem ${active ? "active" : ""}`} onClick={onClick}>
      <span className="sbIconWrap">
        <span className="sbIcon">{icon}</span>
      </span>
      <span className="sbLabel">{label}</span>
      {badge ? <span className="sbBadge">{badge}</span> : null}
    </button>
  );
}
