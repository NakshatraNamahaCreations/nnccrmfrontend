import { useCallback, useEffect, useRef, useState } from "react";
import {
  Plus, Search, Eye, Edit2, Trash2, Send, RefreshCcw,
  ChevronLeft, ChevronRight, FileText, CheckCircle2, XCircle,
  PlusCircle, Minus, Download, MessageSquare,
  GitBranch, TrendingUp, Receipt,
} from "lucide-react";
import Sidebar from "../../components/Sidebar/Sidebar";
import { toast } from "../../utils/toast";
import nncLogo from "../../assets/nnclogo.png";
import "./QuotationPage.css";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const isMasterAdmin = () => localStorage.getItem("nnc_role") === "master_admin";
const getUser = () => localStorage.getItem("nnc_name") || "Admin";

const BRANCHES = ["Bangalore", "Mysore", "Mumbai"];

const BRANCH_INFO = {
  Bangalore: { addr: "Darshan Plaza, 1st Floor, Channasandra, Karnataka 560 098", phone: "+91 99005 66466" },
  Mysore:    { addr: "Suswani Towers, JP Nagar 2nd Stage, Karnataka 570 008",      phone: "+91 99005 66466" },
  Mumbai:    { addr: "Lodha Signet, Kolshet Rd, Thane West, Maharashtra 400 607",  phone: "+91 99005 66466" },
};

const getNncGstin = () => localStorage.getItem("nnc_gstin") || "29AABCN1234F1Z5";

const STATUS_META = {
  draft:            { label: "Draft",             color: "gray"   },
  sent:             { label: "Sent",              color: "blue"   },
  under_negotiation:{ label: "Negotiating",       color: "amber"  },
  approved:         { label: "Approved",          color: "green"  },
  rejected:         { label: "Rejected",          color: "red"    },
  final:            { label: "Final",             color: "indigo" },
  converted:        { label: "Converted to PI",   color: "teal"   },
  expired:          { label: "Expired",           color: "orange" },
};

const PI_STATUS_META = {
  draft:     { label: "Draft",     color: "gray"  },
  sent:      { label: "Sent",      color: "blue"  },
  paid:      { label: "Paid",      color: "green" },
  cancelled: { label: "Cancelled", color: "red"   },
};

const STATUSES = Object.keys(STATUS_META);
const EMPTY_ITEM = { description: "", qty: 1, rate: 0, amount: 0 };

const SERVICE_CATEGORIES = [
  "Website Development",
  "Mobile Application",
  "E-Commerce Website",
  "SEO & Digital Marketing",
  "Logo & Branding",
  "UI/UX Design",
  "Cloud & Hosting",
  "CRM / Software Development",
  "Social Media Management",
  "Other",
];

const DEFAULT_TERMS = {
  "Website Development": `1. A minimum of 50% advance payment is required to initiate the project.
2. Remaining 50% to be paid before the website goes live on the domain.
3. Client must provide all content (text, images, videos) within 5 working days of project start.
4. Client feedbacks to be given at every milestone. We wait for 3 working days for feedback. If not submitted, we consider it approved and proceed.
5. Post-launch support of 30 days is included at no additional cost for bug fixes only.
6. Any new requirements raised after final delivery will be billed separately.
7. Domain and hosting charges are not included in this quotation unless explicitly mentioned.`,

  "Mobile Application": `1. A minimum of 50% advance payment is required to initiate the project.
2. Remaining 50% to be paid before the app is submitted to the App Store / Play Store.
3. Client must provide all content, branding assets, and API credentials within 5 working days.
4. App Store / Play Store developer account charges are borne by the client.
5. Client feedbacks to be given within 3 working days at each milestone; delays extend the delivery timeline.
6. Post-launch support of 30 days is included for bug fixes only. New features will be billed separately.
7. Any third-party API, payment gateway, or subscription charges are the client's responsibility.`,

  "E-Commerce Website": `1. A minimum of 50% advance payment is required to initiate the project.
2. Remaining 50% to be paid before going live.
3. Product data, images, and descriptions must be provided by the client within 7 working days.
4. Payment gateway integration charges (if any) are borne by the client.
5. Domain, hosting, and SSL certificate charges are not included unless explicitly mentioned.
6. Client feedbacks to be given within 3 working days at each stage; delays will extend delivery.
7. Post-launch support of 30 days is included for bug fixes only.`,

  "SEO & Digital Marketing": `1. Services are billed on a monthly retainer basis, payable in advance.
2. A minimum contract period of 3 months is applicable.
3. Results are subject to search engine algorithm changes and are not guaranteed.
4. Client must provide access to website, Google Analytics, Search Console, and social accounts.
5. Content approvals must be provided within 2 working days to maintain the posting schedule.
6. Either party may terminate with 30 days written notice after the minimum period.`,

  "Logo & Branding": `1. Full payment is required before delivery of final source files.
2. Up to 3 rounds of revisions are included in the quoted price.
3. Additional revision rounds will be charged at ₹500 per round.
4. Final files will be delivered in AI, EPS, PNG, and PDF formats.
5. All rights to the final design are transferred to the client upon full payment.
6. NNC reserves the right to showcase the work in its portfolio unless requested otherwise.`,

  "UI/UX Design": `1. A minimum of 50% advance payment is required to start the design work.
2. Remaining 50% to be paid upon delivery of final design files.
3. Up to 2 rounds of revisions are included per screen/page design.
4. Client must provide brand guidelines, content, and reference materials before kickoff.
5. Designs will be delivered in Figma or Adobe XD format.
6. Development is not included unless separately quoted.`,

  "Cloud & Hosting": `1. Hosting and cloud services are billed monthly/annually as per the chosen plan.
2. Setup charges are one-time and non-refundable.
3. The client is responsible for regular backups unless a managed backup plan is included.
4. Downtime due to data center/provider issues is not the liability of NNC.
5. Services can be cancelled with 15 days notice before the next billing cycle.`,

  "CRM / Software Development": `1. A minimum of 50% advance payment is required to initiate development.
2. Remaining 50% to be paid in milestones as agreed in the project plan.
3. Requirements must be finalized and signed off before development begins. Changes post-sign-off will be billed separately.
4. Client feedbacks to be given within 3 working days at each milestone.
5. Source code ownership transfers to the client upon full payment.
6. Post-delivery support of 60 days is included for bug fixes only.`,

  "Social Media Management": `1. Services are billed monthly, payable in advance before the month begins.
2. A minimum contract period of 3 months is applicable.
3. Client must provide brand approvals for posts within 24 hours to maintain the schedule.
4. Ad spend (if any) is separate and borne by the client.
5. Either party may terminate with 30 days written notice after the minimum period.
6. NNC retains the right to share content examples in its portfolio.`,

  "Other": `1. A minimum of 50% advance payment is required to initiate the project.
2. Remaining 50% to be paid upon project completion before final delivery.
3. Client feedbacks to be given within 3 working days at each stage.
4. Any changes to the scope after project start will be quoted and billed separately.
5. All deliverables remain the property of NNC until full payment is received.`,
};

const EMPTY_FORM = {
  clientName: "", clientPhone: "", clientEmail: "", clientCompany: "",
  clientAddress: "", clientGstin: "",
  senderEmail: "",
  branch: "Bangalore", enquiryId: "", status: "draft",
  serviceCategory: "",
  lineItems: [{ ...EMPTY_ITEM }],
  discount: 0, tax: 18,
  validUntil: "", notes: "", terms: "",
};

function authHeader() {
  const token = localStorage.getItem("nnc_token");
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

function fmt(n) {
  return Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0 });
}

function calcTotals(items = [], discount = 0, tax = 0) {
  const subtotal   = items.reduce((s, it) => s + Number(it.amount || 0), 0);
  const discounted = Math.max(0, subtotal - Number(discount));
  const gstAmt     = (discounted * Number(tax)) / 100;
  return { subtotal, gstAmt, total: discounted + gstAmt };
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/* ────────────────────────────────────────────────────────────────
   PROPOSAL CONTENT DATA  (per service category)
──────────────────────────────────────────────────────────────────*/
const PROPOSAL_DATA = {
  "Website Development": {
    tagline: "Corporate Website Development",
    techLabel: "Next.js | Responsive Design",
    summary: (client) => `${client} requires a professional, fast-loading website that establishes credibility, showcases its products and services, and makes it easy for clients and partners to reach out. Nakshatra Namaha Creations proposes a clean, modern website built on Next.js — a technology that delivers the best combination of performance, SEO and modern design for a corporate brand. The website will be fully responsive across mobile, tablet and desktop, optimised for Google search, and delivered in 15 working days from kickoff.`,
    stats: [{ val: "5-6", lbl: "Pages Delivered" }, { val: "Next.js", lbl: "Tech Stack" }, { val: "15", lbl: "Working Days" }, { val: "100%", lbl: "Mobile Responsive" }],
    scope: [
      { num: "01", title: "Home Page", desc: "Navigation header, hero banner with tagline and CTA, about us snippet, key services/product highlights, why-choose-us section, client logos/trust badges, footer with contact, quick links and social media." },
      { num: "02", title: "About Us", desc: "Company background and history, mission and vision statements, core values, leadership team with photos and designations, company milestones and certificates." },
      { num: "03", title: "Products / Services", desc: "Service/product category overview, individual cards with descriptions and specifications. Can be split into two pages if both products and services are required." },
      { num: "04", title: "Why Us / Our Strength", desc: "Key differentiators, industry experience, quality commitments, certifications, client testimonials and achievement numbers (years in business, clients served, projects delivered)." },
      { num: "05", title: "Gallery / Portfolio (Optional)", desc: "Grid-based image gallery with lightbox view. Included if client provides sufficient visual content, or can be replaced with an expanded Products/Services page." },
      { num: "06", title: "Contact Us", desc: "Contact form with email notification, address, phone and email, Google Maps embed, business hours, WhatsApp direct contact button." },
    ],
    included: ["Next.js website — all pages built for fast loading and SEO performance", "Custom UI/UX design tailored to client brand — not a template", "Fully responsive — mobile, tablet and desktop", "Contact form with email notification", "Google Maps integration on Contact page", "WhatsApp click-to-chat button on all pages", "Basic technical SEO — page structure and headings optimised", "Social media links in header and footer", "Google Analytics 4 integration", "SSL-ready deployment", "Source code handover on final payment", "Deployment to Vercel or client hosting of choice", "30-day post-launch support for bug fixes"],
    notIncluded: [["Domain name registration", "Yes — billed at actual cost"], ["Web hosting charges", "Yes — Vercel free tier or paid plan"], ["Content writing", "Yes — content writing service available"], ["Logo design", "Yes — logo design available separately"], ["E-commerce functionality", "Yes — e-commerce as separate project"], ["Admin panel or CMS", "Yes — CMS/admin as add-on"]],
    timeline: [
      { phase: "Phase 1 — Kickoff & Design", days: "Days 1–4", activity: "Requirement discussion. Design mockups for Home and one inner page shared for approval.", client: "Design mockups, sitemap, UI wireframes shared with client." },
      { phase: "Phase 2 — Design Approval", days: "Days 5–6", activity: "Client reviews mockups. Revisions incorporated. Final design approved before development begins.", client: "Revised designs with incorporated feedback delivered." },
      { phase: "Phase 3 — Development", days: "Days 7–12", activity: "All pages developed in Next.js. Contact form, maps, WhatsApp, SEO and analytics integrated.", client: "Fully functional staging site with all pages and integrations." },
      { phase: "Phase 4 — Testing", days: "Days 13–14", activity: "Content uploaded. Cross-browser and mobile testing on iOS and Android. Speed optimisation and SEO meta tags added.", client: "Tested, optimised staging site ready for final client review." },
      { phase: "Phase 5 — Launch", days: "Day 15", activity: "Deployed to live domain. Google Analytics set up. DNS configuration completed.", client: "Live website, Analytics configured, deployment report shared." },
    ],
    totalDays: "15 Working Days",
  },
  "Mobile Application": {
    tagline: "Mobile Application Development",
    techLabel: "React Native | iOS & Android",
    summary: (client) => `${client} requires a professional, feature-rich mobile application that delivers a seamless experience on both iOS and Android platforms. Nakshatra Namaha Creations proposes a cross-platform mobile app built on React Native — enabling a single codebase that works perfectly on all devices, reducing cost and time-to-market. The app will be designed with a modern UI, smooth animations and all required functionality, delivered in 30 working days from kickoff.`,
    stats: [{ val: "iOS+Android", lbl: "Both Platforms" }, { val: "React Native", lbl: "Tech Stack" }, { val: "30", lbl: "Working Days" }, { val: "100%", lbl: "Native Performance" }],
    scope: [
      { num: "01", title: "UI/UX Design", desc: "Complete app wireframes and high-fidelity designs for all screens, following iOS Human Interface Guidelines and Android Material Design principles." },
      { num: "02", title: "Onboarding & Authentication", desc: "Splash screen, onboarding slides, user registration, login (email/phone/OTP), forgot password and secure session management." },
      { num: "03", title: "Core Feature Screens", desc: "All primary feature screens as per client requirements — product listings, service pages, dashboards, forms, detail views and any custom business logic." },
      { num: "04", title: "Profile & Settings", desc: "User profile management, notification preferences, account settings, password change and logout functionality." },
      { num: "05", title: "Notifications", desc: "Push notification integration (Firebase FCM) for order updates, promotions, reminders and any event-driven alerts." },
      { num: "06", title: "App Store Submission", desc: "App packaged and submitted to Google Play Store and Apple App Store. Developer account setup guidance provided. Review turnaround time is subject to store policies." },
    ],
    included: ["Cross-platform app for iOS and Android from a single codebase", "Custom UI/UX design for all screens", "User authentication — email, phone and OTP login", "Push notifications via Firebase FCM", "API integration with any existing backend or NNC-built backend", "Google Maps / location integration if required", "In-app camera, gallery and file upload support", "Offline-first capability for key screens", "App Store and Play Store submission", "Source code handover on final payment", "30-day post-launch support for bug fixes"],
    notIncluded: [["App Store / Play Store developer account fees", "Client's responsibility"], ["Backend / API development", "Yes — available as separate scope"], ["Content writing and copywriting", "Yes — available separately"], ["Third-party API subscription charges", "Client's responsibility"], ["Paid push notification services beyond free tier", "Client's responsibility"]],
    timeline: [
      { phase: "Phase 1 — Kickoff & Design", days: "Days 1–7", activity: "Requirement finalisation. Wireframes and high-fidelity designs for all key screens.", client: "Complete wireframes + high-fidelity Figma designs for all screens." },
      { phase: "Phase 2 — Design Approval", days: "Days 8–9", activity: "Client reviews all screen designs. Revisions incorporated. Final designs signed off.", client: "Revised screen designs with all feedback incorporated." },
      { phase: "Phase 3 — Development", days: "Days 10–24", activity: "All screens developed. Authentication, APIs, push notifications and third-party integrations built.", client: "Working app build on staging with all features integrated." },
      { phase: "Phase 4 — Testing", days: "Days 25–28", activity: "QA testing on iOS and Android devices. Performance, crash and compatibility testing.", client: "QA report, bug fixes and tested APK/IPA build shared." },
      { phase: "Phase 5 — Launch", days: "Days 29–30", activity: "App submitted to Google Play Store and Apple App Store. Store listing assets prepared.", client: "Store submission confirmation and live app link shared." },
    ],
    totalDays: "30 Working Days",
  },
  "E-Commerce Website": {
    tagline: "E-Commerce Website Development",
    techLabel: "Next.js | Razorpay | Full Store",
    summary: (client) => `${client} requires a complete, conversion-optimised e-commerce website to sell products or services online. Nakshatra Namaha Creations proposes a modern online store built on Next.js with a full product catalogue, cart, checkout, payment gateway integration and order management — giving the client a professional online selling platform that works seamlessly on all devices and ranks well on Google.`,
    stats: [{ val: "Full Store", lbl: "End-to-End" }, { val: "Next.js", lbl: "Tech Stack" }, { val: "21", lbl: "Working Days" }, { val: "100%", lbl: "Mobile Ready" }],
    scope: [
      { num: "01", title: "Home Page", desc: "Hero banner with offers, featured products/categories, promotional sections, trust badges, newsletter signup and footer with all links." },
      { num: "02", title: "Product Catalogue", desc: "Category pages, product listing with filters and sorting, product detail pages with images, descriptions, specifications and related products." },
      { num: "03", title: "Cart & Checkout", desc: "Add to cart, update quantities, remove items, apply coupon codes, address entry, delivery options and order summary before payment." },
      { num: "04", title: "Payment Gateway", desc: "Razorpay or PayU integration for UPI, cards, net banking and wallets. Order confirmation emails sent automatically on successful payment." },
      { num: "05", title: "User Accounts", desc: "Customer registration, login, order history, saved addresses, wishlist and password management." },
      { num: "06", title: "Admin Panel", desc: "Product management (add/edit/delete), order management, inventory tracking, coupon management and basic sales reports." },
    ],
    included: ["Complete e-commerce store with all core pages", "Product catalogue with categories, filters and search", "Cart and multi-step checkout flow", "Razorpay / PayU payment gateway integration", "Automatic order confirmation emails to customer and admin", "Customer accounts — registration, login, order history, wishlist", "Admin panel for products, orders and inventory management", "Coupon / promo code system", "Fully responsive — mobile-first design", "Basic technical SEO for all product and category pages", "Google Analytics 4 with e-commerce tracking", "SSL-ready deployment", "Source code handover on final payment", "30-day post-launch support"],
    notIncluded: [["Domain and hosting charges", "Client's responsibility"], ["Payment gateway registration fees", "Client's responsibility"], ["Content writing / product descriptions", "Yes — available separately"], ["Bulk product upload (more than 100 SKUs)", "Yes — available as add-on"], ["Custom ERP or accounting integration", "Yes — quoted separately"]],
    timeline: [
      { phase: "Phase 1 — Kickoff & Design", days: "Days 1–5", activity: "Requirement discussion. Design mockups for Home, Product listing and Product detail pages.", client: "UI mockups for Home, Product listing and Product detail pages." },
      { phase: "Phase 2 — Design Approval", days: "Days 6–7", activity: "Client reviews designs. Revisions incorporated. Final designs approved.", client: "Final approved designs with all revisions incorporated." },
      { phase: "Phase 3 — Development", days: "Days 8–17", activity: "All pages developed. Cart, checkout, payment gateway and admin panel built and integrated.", client: "Complete store on staging — cart, checkout, payment and admin panel." },
      { phase: "Phase 4 — Testing", days: "Days 18–20", activity: "End-to-end checkout testing, payment testing in sandbox mode, mobile and cross-browser testing.", client: "Full QA report, sandbox payment test results and mobile test screenshots." },
      { phase: "Phase 5 — Launch", days: "Day 21", activity: "Live deployment. Payment gateway switched to production mode. Analytics and SEO finalised.", client: "Live store with payment gateway active, analytics and SEO configured." },
    ],
    totalDays: "21 Working Days",
  },
  "SEO & Digital Marketing": {
    tagline: "SEO & Digital Marketing Services",
    techLabel: "SEO | Google Ads | Social Media",
    summary: (client) => `${client} requires a structured digital marketing strategy to increase online visibility, drive qualified traffic and generate leads. Nakshatra Namaha Creations proposes a comprehensive SEO and digital marketing engagement covering on-page optimisation, local SEO, Google Ads management and social media marketing — delivering measurable growth in search rankings, website traffic and enquiries over a sustained engagement period.`,
    stats: [{ val: "3 Months", lbl: "Minimum Engagement" }, { val: "10+", lbl: "Target Keywords" }, { val: "Monthly", lbl: "Reports" }, { val: "100%", lbl: "Transparent" }],
    scope: [
      { num: "01", title: "SEO Audit & Keyword Research", desc: "Full technical SEO audit, competitor analysis, keyword research for 10+ target keywords, on-page and off-page gap analysis." },
      { num: "02", title: "On-Page SEO Optimisation", desc: "Title tags, meta descriptions, heading structure, URL optimisation, image alt text, internal linking, schema markup and page speed improvements." },
      { num: "03", title: "Local SEO", desc: "Google Business Profile optimisation, local citations, NAP consistency, review generation strategy and local keyword targeting." },
      { num: "04", title: "Content Marketing", desc: "Monthly blog posts (2–4 articles) optimised for target keywords, social media content calendar and LinkedIn/Instagram posts." },
      { num: "05", title: "Google Ads Management (if applicable)", desc: "Campaign setup, ad copywriting, keyword bidding strategy, A/B testing, negative keywords and monthly performance optimisation." },
      { num: "06", title: "Monthly Reporting", desc: "Keyword ranking report, traffic and lead analytics, campaign performance summary and next-month action plan shared every month." },
    ],
    included: ["Full SEO audit and competitor analysis", "Keyword research for 10+ target keywords", "On-page SEO for all website pages", "Google Business Profile optimisation", "Monthly blog content (2–4 articles)", "Social media content calendar and posts", "Google Search Console and Analytics setup", "Monthly ranking and traffic report", "Google Ads campaign management (if opted)", "Dedicated account manager"],
    notIncluded: [["Google Ads budget / ad spend", "Client's responsibility — billed directly by Google"], ["Website development or redesign", "Yes — available separately"], ["Paid social media ads budget", "Client's responsibility"], ["Video production for ads", "Yes — available as add-on"], ["Guaranteed ranking results", "Not possible — results depend on competition and algorithm"]],
    timeline: [
      { phase: "Month 1 — Audit & Foundation", days: "Weeks 1–4", activity: "SEO audit, keyword finalisation, on-page optimisation, Google Business Profile setup, content calendar creation.", client: "SEO audit report, keyword list, optimised pages, GBP updated, content calendar." },
      { phase: "Month 2 — Execution", days: "Weeks 5–8", activity: "Content publishing begins, link building outreach, social media posts go live, Google Ads campaign launched.", client: "4 published blog posts, social posts live, Ads campaign live, backlink report." },
      { phase: "Month 3 — Optimisation", days: "Weeks 9–12", activity: "Keyword ranking review, campaign optimisation, content strategy adjustment, detailed performance report.", client: "Monthly ranking report, campaign performance summary, next-month strategy." },
    ],
    totalDays: "Ongoing — minimum 3 months",
  },
  "Logo & Branding": {
    tagline: "Logo Design & Brand Identity",
    techLabel: "Brand Identity | Visual Design",
    summary: (client) => `${client} requires a professional logo and brand identity that communicates its values, stands out in its market and works consistently across all media. Nakshatra Namaha Creations proposes a complete brand identity package — covering logo design, colour palette, typography selection and brand usage guidelines — delivered as production-ready files in all required formats within 7 working days.`,
    stats: [{ val: "3 Concepts", lbl: "Initial Options" }, { val: "3 Rounds", lbl: "Revisions" }, { val: "7", lbl: "Working Days" }, { val: "All Formats", lbl: "Delivered" }],
    scope: [
      { num: "01", title: "Discovery & Brief", desc: "Brand questionnaire, competitor landscape review, mood board creation and design direction alignment with the client before any design work begins." },
      { num: "02", title: "Logo Design — 3 Concepts", desc: "Three distinct logo concepts presented for client review. Each concept includes primary logo, variations and black/white version." },
      { num: "03", title: "Revision Rounds", desc: "Up to 3 rounds of revisions on the chosen concept. Each round is one consolidated set of feedback communicated in a single message." },
      { num: "04", title: "Colour Palette", desc: "Primary and secondary brand colours defined with hex, RGB and CMYK values for consistent use across print and digital." },
      { num: "05", title: "Typography Selection", desc: "Primary and secondary brand fonts selected and specified with usage guidelines for headings, body text and digital use." },
      { num: "06", title: "Final File Delivery", desc: "Final logo delivered in AI, EPS, SVG, PNG (transparent, white and dark backgrounds) and PDF formats. Brand guidelines document included." },
    ],
    included: ["Brand discovery questionnaire and mood board", "3 initial logo concepts", "Up to 3 revision rounds on chosen concept", "Primary and secondary colour palette with hex/RGB/CMYK codes", "Typography selection with usage guidance", "Final files in AI, EPS, SVG, PNG and PDF formats", "Black and white version of logo", "Brand usage guidelines document (1–2 pages)", "Full IP transfer on final payment"],
    notIncluded: [["Stationery design (business cards, letterhead)", "Yes — available as add-on"], ["Social media branding kit", "Yes — available as add-on"], ["Packaging design", "Yes — quoted separately"], ["Website design or development", "Yes — separate project"], ["Video or motion logo animation", "Yes — available as add-on"]],
    timeline: [
      { phase: "Phase 1 — Discovery", days: "Day 1–2", activity: "Brand questionnaire, competitor research and mood board presented for approval.", client: "Brand questionnaire, competitor analysis and 3 mood board directions." },
      { phase: "Phase 2 — Concepts", days: "Days 3–4", activity: "Three logo concepts designed and presented with rationale.", client: "3 distinct logo concepts with rationale and black/white variants." },
      { phase: "Phase 3 — Refinement", days: "Days 5–6", activity: "Chosen concept refined through revision rounds. Colour palette and typography finalised.", client: "Refined logo, final colour palette and typography selection." },
      { phase: "Phase 4 — Delivery", days: "Day 7", activity: "Final files prepared in all formats. Brand guidelines document compiled and delivered.", client: "Final files in AI, EPS, SVG, PNG, PDF + brand guidelines document." },
    ],
    totalDays: "7 Working Days",
  },
  "UI/UX Design": {
    tagline: "UI/UX Design Services",
    techLabel: "Figma | User Research | Prototyping",
    summary: (client) => `${client} requires a professionally designed user interface and user experience that makes its digital product intuitive, visually compelling and easy to use. Nakshatra Namaha Creations proposes a structured UI/UX design engagement — from user research and wireframes through to high-fidelity Figma designs and interactive prototypes — delivering a complete design system ready for development handover.`,
    stats: [{ val: "Figma", lbl: "Design Tool" }, { val: "2 Rounds", lbl: "Revisions/Screen" }, { val: "Hi-Fi", lbl: "Prototype" }, { val: "Dev Ready", lbl: "Handover" }],
    scope: [
      { num: "01", title: "User Research & Strategy", desc: "User personas, user journey mapping, competitor UX analysis and information architecture (IA) planning before any design begins." },
      { num: "02", title: "Wireframes", desc: "Low-fidelity wireframes for all key screens showing layout, content hierarchy and user flow — approved before high-fidelity design begins." },
      { num: "03", title: "Visual Design System", desc: "Colour palette, typography, icon style, spacing system, component library and design tokens established as the foundation for all screens." },
      { num: "04", title: "High-Fidelity Screen Designs", desc: "Pixel-perfect Figma designs for all screens including desktop, tablet and mobile breakpoints. All states — default, hover, active, error, empty — designed." },
      { num: "05", title: "Interactive Prototype", desc: "Clickable Figma prototype linking all screens for stakeholder review, usability testing or developer reference." },
      { num: "06", title: "Developer Handover", desc: "Figma file with organised layers, annotated specs, asset exports (SVG/PNG), spacing values and component documentation for clean developer handover." },
    ],
    included: ["User research: personas and journey maps", "Information architecture and sitemap", "Low-fidelity wireframes for all screens", "Visual design system and component library", "High-fidelity designs for all screens and breakpoints", "All states designed: default, hover, error, empty, loading", "Interactive clickable prototype", "Developer handover file with specs and annotations", "Up to 2 revision rounds per screen", "Figma file ownership transferred on final payment"],
    notIncluded: [["Frontend or backend development", "Yes — available as a separate project"], ["Copywriting or content creation", "Yes — available separately"], ["User testing recruitment and facilitation", "Yes — available as add-on"], ["Motion design / micro-animations", "Yes — available as add-on"], ["Branding / logo design", "Yes — available as separate project"]],
    timeline: [
      { phase: "Phase 1 — Research & IA", days: "Days 1–3", activity: "User research, personas, journey maps and information architecture completed.", client: "User persona document, journey maps and IA sitemap delivered." },
      { phase: "Phase 2 — Wireframes", days: "Days 4–6", activity: "Wireframes for all key screens presented and revised.", client: "Low-fidelity wireframes for all screens with user flow annotations." },
      { phase: "Phase 3 — Visual Design", days: "Days 7–14", activity: "Design system built. High-fidelity screens designed for all breakpoints.", client: "Design system + high-fidelity Figma screens for all breakpoints." },
      { phase: "Phase 4 — Prototype & Handover", days: "Days 15–17", activity: "Interactive prototype built. Developer handover file prepared with all specs and assets.", client: "Clickable prototype + developer handover file with all specs and assets." },
    ],
    totalDays: "17 Working Days",
  },
  "CRM / Software Development": {
    tagline: "Custom CRM & Software Development",
    techLabel: "React | Node.js | MongoDB",
    summary: (client) => `${client} requires a custom-built software solution to streamline its business operations, manage data and automate workflows. Nakshatra Namaha Creations proposes a tailored CRM or business software application built on a modern full-stack architecture — designed specifically for the client's business processes, scalable for future growth and delivered with full source code ownership.`,
    stats: [{ val: "Custom Built", lbl: "No Templates" }, { val: "Full Stack", lbl: "Tech Stack" }, { val: "Milestones", lbl: "Delivery Model" }, { val: "100%", lbl: "Source Code Yours" }],
    scope: [
      { num: "01", title: "Requirements & System Design", desc: "Detailed requirements gathering, user role mapping, database schema design, API architecture planning and system flow documentation before development begins." },
      { num: "02", title: "Authentication & Access Control", desc: "Secure login, role-based access control (RBAC), session management, password policies and audit logging for all user actions." },
      { num: "03", title: "Core Module Development", desc: "All primary business modules built as per requirements — lead management, customer records, task management, billing, reports or any custom business logic." },
      { num: "04", title: "Dashboard & Analytics", desc: "Real-time dashboard with KPIs, charts and data summaries relevant to the client's business. Export to Excel/PDF for all key reports." },
      { num: "05", title: "Notifications & Automation", desc: "In-app notifications, email alerts for key events, automated reminders and any workflow automation rules as specified in requirements." },
      { num: "06", title: "Deployment & Handover", desc: "Production deployment to a cloud server (AWS/DigitalOcean/Render). Source code pushed to client's private Git repository. Admin training session included." },
    ],
    included: ["Complete requirements analysis and system design document", "Custom frontend built in React", "Custom backend API in Node.js and Express", "MongoDB or PostgreSQL database", "Role-based access control for all user types", "All core business modules as per requirements", "Real-time dashboard with charts and KPIs", "Email notifications and automated alerts", "Excel and PDF export for all reports", "Production deployment to cloud server", "Source code handover to client's private repository", "60-day post-launch support for bug fixes", "Admin user training session"],
    notIncluded: [["Cloud server subscription fees", "Client's responsibility"], ["Third-party API subscription costs", "Client's responsibility"], ["Mobile app version", "Yes — available as separate project"], ["Data migration from existing systems", "Yes — available as add-on"], ["Ongoing feature development after handover", "Yes — available on retainer"]],
    timeline: [
      { phase: "Phase 1 — Discovery", days: "Days 1–5", activity: "Requirements workshops, system design document, database schema and API architecture finalised.", client: "System design document, ER diagram, API architecture and project plan." },
      { phase: "Phase 2 — UI Design", days: "Days 6–10", activity: "All screen wireframes and high-fidelity designs for key modules presented for approval.", client: "Wireframes and high-fidelity Figma designs for all modules." },
      { phase: "Phase 3 — Backend Development", days: "Days 11–25", activity: "All APIs, database models, authentication, business logic and integrations built and tested.", client: "Complete backend APIs documented and tested via Postman/Swagger." },
      { phase: "Phase 4 — Frontend Development", days: "Days 26–38", activity: "All UI screens connected to backend APIs. Dashboard, reports and notifications implemented.", client: "Fully functional staging application with all modules connected." },
      { phase: "Phase 5 — Testing & Launch", days: "Days 39–45", activity: "Full QA testing, bug fixes, production deployment, source code handover and admin training.", client: "QA report, production deployment, source code handover and admin training." },
    ],
    totalDays: "45 Working Days",
  },
  "Social Media Management": {
    tagline: "Social Media Management",
    techLabel: "Instagram | LinkedIn | Facebook",
    summary: (client) => `${client} requires a consistent and professional social media presence to build brand awareness, engage its audience and drive enquiries from social platforms. Nakshatra Namaha Creations proposes a fully managed social media service — covering content strategy, graphic design, post scheduling, community management and monthly performance reporting — across Instagram, LinkedIn and Facebook.`,
    stats: [{ val: "3 Platforms", lbl: "Coverage" }, { val: "12+ Posts", lbl: "Per Month" }, { val: "Monthly", lbl: "Reports" }, { val: "3 Months", lbl: "Min. Term" }],
    scope: [
      { num: "01", title: "Social Media Strategy", desc: "Brand audit, competitor analysis, audience research, content pillar definition, tone of voice guidelines and monthly content calendar creation." },
      { num: "02", title: "Content Creation", desc: "12–16 designed posts per month across Instagram, LinkedIn and Facebook. Includes static graphics, carousel posts, story designs and caption copywriting." },
      { num: "03", title: "Post Scheduling & Publishing", desc: "Posts scheduled and published at optimal times for maximum reach. All content sent to client for approval before publishing." },
      { num: "04", title: "Community Management", desc: "Responding to comments and DMs within 24 hours (business days). Escalation of sales inquiries to the client team immediately." },
      { num: "05", title: "Reels / Short Videos (Optional)", desc: "2–4 short-form video reels per month using client-provided raw footage, edited with captions, music and branding. Available as an add-on." },
      { num: "06", title: "Monthly Performance Report", desc: "Reach, impressions, engagement rate, follower growth, top-performing content and next-month strategy shared in a clear monthly report." },
    ],
    included: ["Social media strategy and content calendar", "12–16 designed posts per month", "Content for Instagram, LinkedIn and Facebook", "Caption copywriting for all posts", "Post scheduling and publishing at optimal times", "Community management — comments and DMs (Mon–Sat)", "Monthly performance analytics report", "Dedicated social media manager", "Content approval workflow before every post"],
    notIncluded: [["Paid social media advertising budget", "Client's responsibility — billed by Meta/LinkedIn"], ["Video shooting and production", "Client to provide raw footage"], ["Influencer marketing and collaborations", "Yes — available as add-on"], ["Logo or brand design", "Yes — available separately"], ["Website development", "Yes — separate project"]],
    timeline: [
      { phase: "Month 1 — Strategy & Setup", days: "Weeks 1–4", activity: "Brand audit, competitor analysis, content strategy document, content calendar for Month 1 created and approved.", client: "Content strategy document, Month 1 calendar and 12–16 designed posts." },
      { phase: "Month 2 — Full Execution", days: "Weeks 5–8", activity: "Content published daily as per calendar. Community management begins. Mid-month check-in call.", client: "All posts published, DMs and comments managed, mid-month review shared." },
      { phase: "Month 3 — Optimisation", days: "Weeks 9–12", activity: "Performance analysed, best-performing content types scaled, strategy refined for Month 3 based on data.", client: "Monthly analytics report, optimised Month 3 strategy and content calendar." },
    ],
    totalDays: "Ongoing — minimum 3 months",
  },
  "Cloud & Hosting": {
    tagline: "Cloud Infrastructure & Hosting",
    techLabel: "AWS | DigitalOcean | Managed Hosting",
    summary: (client) => `${client} requires reliable, secure and scalable cloud infrastructure to host its website or application. Nakshatra Namaha Creations proposes a managed cloud hosting setup — covering server provisioning, security hardening, SSL configuration, automated backups and ongoing monitoring — ensuring the client's digital presence remains fast, secure and always online.`,
    stats: [{ val: "99.9%", lbl: "Uptime SLA" }, { val: "Managed", lbl: "Setup & Support" }, { val: "SSL", lbl: "Secured" }, { val: "Auto", lbl: "Daily Backups" }],
    scope: [
      { num: "01", title: "Server Provisioning", desc: "Cloud server setup on AWS, DigitalOcean or Hetzner as per requirement. OS installation, firewall configuration and initial security hardening." },
      { num: "02", title: "Domain & DNS Configuration", desc: "Domain DNS records configured, subdomain setup, email DNS records (MX, SPF, DKIM) and CDN configuration if required." },
      { num: "03", title: "SSL Certificate Setup", desc: "Free Let's Encrypt SSL or commercial SSL certificate installation, HTTPS enforcement and auto-renewal configuration." },
      { num: "04", title: "Application Deployment", desc: "Website or application deployed to the configured server. Environment variables, process manager (PM2) and Nginx/Apache reverse proxy configured." },
      { num: "05", title: "Automated Backups", desc: "Daily automated backups configured to a separate storage bucket (S3 or equivalent). Backup retention policy set as per client requirements." },
      { num: "06", title: "Monitoring & Alerts", desc: "Uptime monitoring configured with alerts to client email/WhatsApp if the server goes down. Monthly server health report provided." },
    ],
    included: ["Cloud server setup and OS configuration", "Firewall and basic security hardening", "Domain DNS and subdomain configuration", "SSL certificate installation and auto-renewal", "Application deployment and Nginx/Apache configuration", "Automated daily backups to cloud storage", "Uptime monitoring with email/WhatsApp alerts", "Monthly server health report", "One-time complete setup and handover documentation"],
    notIncluded: [["Monthly cloud server subscription cost", "Client's responsibility — billed by AWS/DO/Hetzner"], ["Domain registration fees", "Client's responsibility"], ["Application development or bug fixes", "Yes — quoted separately"], ["Managed WAF / DDoS protection (enterprise)", "Yes — available as add-on"], ["24/7 on-call support", "Yes — available on retainer"]],
    timeline: [
      { phase: "Phase 1 — Planning", days: "Day 1", activity: "Server requirements assessment, technology stack review, hosting platform selection and cost estimation.", client: "Infrastructure plan document with server specs and cost breakdown." },
      { phase: "Phase 2 — Server Setup", days: "Days 2–3", activity: "Server provisioned, OS configured, firewall rules set, SSL installed and Nginx configured.", client: "Configured server with SSL, firewall and Nginx — ready for deployment." },
      { phase: "Phase 3 — Deployment", days: "Days 4–5", activity: "Application deployed, tested in production, backups configured and monitoring set up.", client: "Live application, automated backups active, uptime monitoring configured." },
    ],
    totalDays: "5 Working Days (setup)",
  },
  "Other": {
    tagline: "Custom Digital Solutions",
    techLabel: "Tailored to Your Requirements",
    summary: (client) => `${client} requires a custom digital solution tailored to its specific business needs. Nakshatra Namaha Creations will work closely with the client to understand the full scope, define deliverables clearly and execute the project to a high standard with regular communication and transparent milestone-based delivery.`,
    stats: [{ val: "Custom", lbl: "Built for You" }, { val: "Dedicated", lbl: "Project Team" }, { val: "Milestone", lbl: "Delivery Model" }, { val: "100%", lbl: "Transparent" }],
    scope: [
      { num: "01", title: "Discovery & Requirements", desc: "Detailed requirements gathering sessions to fully understand the project scope, expected outcomes and success criteria." },
      { num: "02", title: "Proposal & Scope Definition", desc: "Detailed scope document, deliverable list and project plan agreed and signed off before any work begins." },
      { num: "03", title: "Design Phase", desc: "All design deliverables completed and approved by the client before development or execution begins." },
      { num: "04", title: "Development / Execution", desc: "Project executed in agreed milestones with regular updates and demos at each stage." },
      { num: "05", title: "Testing & Review", desc: "Thorough testing and client review period before final delivery to ensure all requirements are met." },
      { num: "06", title: "Delivery & Handover", desc: "All deliverables handed over in agreed formats. Documentation provided. Post-delivery support period included." },
    ],
    included: ["Complete requirements analysis", "Dedicated project manager", "Regular progress updates and milestone demos", "All agreed deliverables as per scope document", "Quality assurance and testing", "Final delivery in all agreed formats", "Source code / file handover on final payment", "30-day post-delivery support for bug fixes"],
    notIncluded: [["Any scope beyond what is explicitly agreed", "Will be estimated and quoted separately"], ["Third-party service subscription costs", "Client's responsibility"], ["Ongoing maintenance after support period", "Yes — available on retainer"]],
    timeline: [
      { phase: "Phase 1 — Discovery", days: "Days 1–3", activity: "Requirements gathering, scope finalisation and project plan agreed.", client: "Scope document, detailed requirements and project plan shared." },
      { phase: "Phase 2 — Design", days: "Days 4–8", activity: "All design work completed and presented for approval.", client: "All design deliverables presented with rationale and revision support." },
      { phase: "Phase 3 — Execution", days: "Days 9 onwards", activity: "Development / production work executed in milestones with regular demos.", client: "Milestone demos with working deliverables at each stage." },
      { phase: "Phase 4 — Delivery", days: "Final Days", activity: "Full testing, final delivery and handover of all files and documentation.", client: "All files, source code, documentation and handover report delivered." },
    ],
    totalDays: "As per agreed project plan",
  },
};


/* ────────────────────────────────────────────────────────────────
   ENTERPRISE DOCUMENT COMPONENT (also used for PDF print)
──────────────────────────────────────────────────────────────────*/
function QuotationDocument({ q, isProforma = false }) {
  const bi   = BRANCH_INFO[q.branch] || BRANCH_INFO.Bangalore;
  const gstAmt = ((q.subtotal - q.discount) * q.tax) / 100;

  /* ── For Proforma Invoice — keep existing simple format ── */
  if (isProforma) {
    return (
      <div className="qt-doc" id="qt-pdf-target">
        <div className="qt-doc-header">
          <div className="qt-doc-brand">
            <img src={nncLogo} alt="NNC" className="qt-doc-logo" />
            <div>
              <div className="qt-doc-company">Nakshatra Namaha Creations Pvt. Ltd.</div>
              <div className="qt-doc-tagline">Bengaluru · Mysuru · Mumbai</div>
            </div>
          </div>
          <div className="qt-doc-title-block">
            <div className="qt-doc-type">PROFORMA INVOICE</div>
            <div className="qt-doc-num">{q.proformaNumber}</div>
            {q.quoteNumber && <div className="qt-doc-ref">Ref: {q.quoteNumber}</div>}
          </div>
        </div>
        <div className="qt-doc-meta">
          <div className="qt-doc-billto">
            <div className="qt-doc-meta-label">Bill To</div>
            <div className="qt-doc-client-name">{q.clientName}</div>
            {q.clientCompany && <div className="qt-doc-client-co">{q.clientCompany}</div>}
            {q.clientAddress && <div className="qt-doc-client-addr">{q.clientAddress}</div>}
            {q.clientPhone   && <div className="qt-doc-client-contact">{q.clientPhone}</div>}
            {q.clientEmail   && <div className="qt-doc-client-contact">{q.clientEmail}</div>}
            {q.clientGstin   && <div className="qt-doc-client-gstin">GSTIN: {q.clientGstin}</div>}
          </div>
          <div className="qt-doc-details">
            <div className="qt-doc-meta-label">Invoice Details</div>
            <table className="qt-doc-detail-tbl"><tbody>
              <tr><td>Date</td><td>{fmtDate(new Date())}</td></tr>
              {q.deliveryDate && <tr><td>Delivery</td><td>{fmtDate(q.deliveryDate)}</td></tr>}
              {q.paymentTerms && <tr><td>Payment</td><td>{q.paymentTerms}</td></tr>}
              <tr><td>Branch</td><td>{q.branch}</td></tr>
              <tr><td>Our GSTIN</td><td>{getNncGstin()}</td></tr>
            </tbody></table>
          </div>
        </div>
        <table className="qt-doc-items">
          <thead><tr>
            <th className="col-sno">#</th><th className="col-desc">Description</th>
            <th className="col-qty">Qty</th><th className="col-rate">Rate (₹)</th><th className="col-amt">Amount (₹)</th>
          </tr></thead>
          <tbody>{(q.lineItems||[]).map((it,i)=>(
            <tr key={i}>
              <td className="col-sno">{i+1}</td><td className="col-desc">{it.description||"—"}</td>
              <td className="col-qty">{it.qty}</td><td className="col-rate">{fmt(it.rate)}</td><td className="col-amt">{fmt(it.amount)}</td>
            </tr>
          ))}</tbody>
        </table>
        <div className="qt-doc-totals">
          <div/>
          <div className="qt-doc-total-rows">
            <div className="qt-doc-total-row"><span>Subtotal</span><span>₹{fmt(q.subtotal)}</span></div>
            {q.discount>0 && <div className="qt-doc-total-row disc"><span>Discount</span><span>−₹{fmt(q.discount)}</span></div>}
            {q.tax>0 && <div className="qt-doc-total-row"><span>GST ({q.tax}%)</span><span>₹{fmt(gstAmt)}</span></div>}
            <div className="qt-doc-total-row grand"><span>Total</span><span>₹{fmt(q.total)}</span></div>
          </div>
        </div>
        {q.notes && <div className="qt-doc-box notes-box"><div className="qt-doc-box-label">Notes</div><div className="qt-doc-box-body">{q.notes}</div></div>}
        {q.terms && <div className="qt-doc-box terms-box"><div className="qt-doc-box-label">Terms &amp; Conditions</div><div className="qt-doc-box-body">{q.terms}</div></div>}
        <div className="qt-doc-footer">
          <div className="qt-doc-sig"><div className="qt-doc-sig-line"/><div className="qt-doc-sig-label">Authorised Signatory</div><div className="qt-doc-sig-co">NNC Nakshatra Namaha Creations</div></div>
          <div className="qt-doc-footer-info">
            <div className="qt-doc-footer-co">NNC Nakshatra Namaha Creations Pvt. Ltd.</div>
            <div className="qt-doc-footer-addr">{bi.addr}</div>
            <div className="qt-doc-footer-phone">{bi.phone} · nakshatranamahacreations.com</div>
            <div className="qt-doc-footer-gstin">GSTIN: {getNncGstin()}</div>
          </div>
        </div>
      </div>
    );
  }

  /* ── FULL PROPOSAL FORMAT for Quotations ── */
  const pd  = PROPOSAL_DATA[q.serviceCategory] || PROPOSAL_DATA["Other"];
  const cat = q.serviceCategory || "Custom Digital Solutions";

  /* ── Shared style tokens — Professional Clean Palette ── */
  const PRIMARY  = "#1e40af";   // rich indigo-blue (headers, accents)
  const PRIMARY2 = "#2563eb";   // lighter indigo-blue
  const ACCENT   = "#0ea5e9";   // sky blue highlight
  const DARK     = "#111827";   // near-black for headings
  const BODY     = "#374151";   // body text
  const SLATE    = "#6b7280";   // muted labels
  const WHITE    = "#ffffff";
  const OFFWHITE = "#f8fafc";   // page bg tint
  const LIGHT    = "#f1f5f9";   // light rows
  const BORDER   = "#e2e8f0";   // dividers
  const SUCCESS  = "#059669";   // green checkmarks
  const HEADBG   = "#1e3a8a";   // cover header bg

  /* ── Reusable sub-components ── */
  const PageHeader = ({ label }) => (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:28, paddingBottom:14, borderBottom:`2px solid ${BORDER}` }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <img src={nncLogo} alt="NNC" style={{ height:30, borderRadius:4 }}/>
        <div>
          <div style={{ fontSize:11.5, fontWeight:800, color:DARK, letterSpacing:.2 }}>Nakshatra Namaha Creations Pvt Ltd</div>
          <div style={{ fontSize:9.5, color:PRIMARY2, fontWeight:600 }}>Your Digital Solutions Partner</div>
        </div>
      </div>
      <div style={{ fontSize:9.5, color:SLATE, fontWeight:600, background:LIGHT, padding:"4px 12px", borderRadius:20, border:`1px solid ${BORDER}` }}>{label || `${cat} Proposal`}</div>
    </div>
  );

  const SectionLabel = ({ num, title }) => (
    <div style={{ marginBottom:20 }}>
      <div style={{ display:"inline-flex", alignItems:"center", gap:8, marginBottom:6 }}>
        <div style={{ width:26, height:26, borderRadius:"50%", background:`linear-gradient(135deg,${PRIMARY},${PRIMARY2})`, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <span style={{ fontSize:10, fontWeight:900, color:WHITE }}>{num}</span>
        </div>
        <div style={{ fontSize:9, fontWeight:700, color:ACCENT, letterSpacing:2, textTransform:"uppercase" }}>Section {num}</div>
      </div>
      <div style={{ fontSize:21, fontWeight:800, color:DARK, lineHeight:1.2, letterSpacing:-.3 }}>{title}</div>
      <div style={{ width:36, height:3, background:`linear-gradient(90deg,${PRIMARY},${ACCENT})`, marginTop:8, borderRadius:2 }}/>
    </div>
  );

  const PageFooter = () => (
    <div style={{ marginTop:28, paddingTop:10, borderTop:`1px solid ${BORDER}`, display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:9.5 }}>
      <span style={{ color:PRIMARY, fontWeight:800, letterSpacing:1, textTransform:"uppercase" }}>Confidential</span>
      <span style={{ color:SLATE }}>info@nakshatranamahacreations.com  |  +91 99005 66466  |  nakshatranamahacreations.com</span>
      <span style={{ color:SLATE }}>{q.clientName || q.clientCompany} | Proposal</span>
    </div>
  );

  return (
    <div id="qt-pdf-target" style={{ fontFamily:"'Inter','Segoe UI','Helvetica Neue',Arial,sans-serif", fontSize:13, color:BODY, background:WHITE }}>

      {/* ══════════════════════════════════════════
          PAGE 1 — COVER PAGE
      ══════════════════════════════════════════ */}
      {/* ══ COVER PAGE — clean professional ══ */}
      <div style={{ minHeight:780, background:WHITE, position:"relative", pageBreakAfter:"always", display:"flex", flexDirection:"column" }}>

        {/* Thin top accent line */}
        <div style={{ height:4, background:`linear-gradient(90deg,${PRIMARY} 0%,${ACCENT} 100%)`, flexShrink:0 }}/>

        {/* Header row */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 52px", borderBottom:`1px solid ${BORDER}`, flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <img src={nncLogo} alt="NNC" style={{ height:32, borderRadius:6 }}/>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:DARK }}>Nakshatra Namaha Creations Pvt Ltd</div>
              <div style={{ fontSize:9, color:SLATE, marginTop:1 }}>nakshatranamahacreations.com  ·  +91 99005 66466</div>
            </div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:8.5, color:SLATE, textTransform:"uppercase", letterSpacing:1.5, marginBottom:3 }}>Proposal No.</div>
            <div style={{ fontSize:12, fontWeight:800, color:PRIMARY, fontFamily:"'Courier New',monospace" }}>{q.quoteNumber}</div>
          </div>
        </div>

        {/* Main body */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center", padding:"52px 52px 36px" }}>

          {/* Overline */}
          <div style={{ fontSize:10, fontWeight:700, color:PRIMARY, textTransform:"uppercase", letterSpacing:3, marginBottom:20 }}>Project Proposal</div>

          {/* Client name — the hero */}
          <div style={{ fontSize:54, fontWeight:900, color:DARK, lineHeight:1, letterSpacing:-2, marginBottom:6 }}>
            {q.clientCompany || q.clientName || "Client"}
          </div>
          {q.clientCompany && q.clientName && q.clientName !== q.clientCompany && (
            <div style={{ fontSize:15, color:SLATE, marginBottom:0, fontWeight:400 }}>{q.clientName}</div>
          )}

          {/* Divider with service name inline */}
          <div style={{ display:"flex", alignItems:"center", gap:16, margin:"28px 0" }}>
            <div style={{ width:40, height:2, background:PRIMARY, borderRadius:1 }}/>
            <div style={{ fontSize:15, fontWeight:600, color:PRIMARY, letterSpacing:.3 }}>{cat}</div>
            <div style={{ flex:1, height:1, background:BORDER }}/>
          </div>

          {/* Description */}
          <div style={{ fontSize:13.5, color:BODY, lineHeight:1.9, maxWidth:500, marginBottom:52 }}>
            {pd.summary ? pd.summary("").split(".").slice(0,2).join(".").trim() + "." : `A complete ${cat.toLowerCase()} solution crafted for your business.`}
          </div>

          {/* 4 meta items in a clean row */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:0, border:`1px solid ${BORDER}`, borderRadius:10, overflow:"hidden" }}>
            {[
              { lbl:"Prepared For", val: q.clientCompany || q.clientName || "—" },
              { lbl:"Date",         val: fmtDate(new Date()) },
              { lbl:"Valid Until",  val: q.validUntil ? fmtDate(q.validUntil) : "30 Days" },
              { lbl:"Est. Delivery",val: pd.totalDays },
            ].map((item, i) => (
              <div key={i} style={{ padding:"16px 18px", borderRight: i < 3 ? `1px solid ${BORDER}` : "none", background: i % 2 === 0 ? WHITE : OFFWHITE }}>
                <div style={{ fontSize:8.5, fontWeight:700, color:SLATE, textTransform:"uppercase", letterSpacing:1.3, marginBottom:7 }}>{item.lbl}</div>
                <div style={{ fontSize:12, fontWeight:700, color:DARK, lineHeight:1.4 }}>{item.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ padding:"14px 52px", borderTop:`1px solid ${BORDER}`, display:"flex", justifyContent:"space-between", alignItems:"center", background:OFFWHITE, flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:PRIMARY }}/>
            <span style={{ fontSize:9, fontWeight:700, color:PRIMARY, textTransform:"uppercase", letterSpacing:1.5 }}>Confidential</span>
          </div>
          <span style={{ fontSize:9, color:SLATE }}>info@nakshatranamahacreations.com  ·  Bengaluru · Mysuru · Mumbai</span>
          <span style={{ fontSize:9, color:SLATE }}>GSTIN: {getNncGstin()}</span>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          PAGE 2 — EXECUTIVE SUMMARY + ABOUT NNC
      ══════════════════════════════════════════ */}
      <div style={{ padding:"36px 44px 24px", background:WHITE, pageBreakAfter:"always" }}>
        <PageHeader/>

        <SectionLabel num="01" title="Executive Summary"/>
        <div style={{ fontSize:13, color:BODY, lineHeight:1.95, marginBottom:28, textAlign:"justify" }}>{pd.summary(q.clientName || q.clientCompany || "your company")}</div>

        {/* Stat highlight — clean inline chips */}
        <div style={{ display:"grid", gridTemplateColumns:`repeat(${pd.stats.length},1fr)`, gap:12, marginBottom:32 }}>
          {pd.stats.map((s, i) => {
            const colors = [PRIMARY, "#0369a1", SUCCESS, "#7c3aed"];
            const bgs    = ["#eff6ff","#f0f9ff","#f0fdf4","#faf5ff"];
            const bds    = ["#bfdbfe","#bae6fd","#bbf7d0","#e9d5ff"];
            const c = colors[i % colors.length];
            return (
              <div key={i} style={{ padding:"9px 12px", background:bgs[i%4], border:`1px solid ${bds[i%4]}`, borderRadius:8, display:"flex", flexDirection:"column", gap:3 }}>
                <div style={{ fontSize:16, fontWeight:900, color:c, lineHeight:1, letterSpacing:-.3 }}>{s.val}</div>
                <div style={{ fontSize:8.5, fontWeight:600, color:SLATE, textTransform:"uppercase", letterSpacing:.8 }}>{s.lbl}</div>
              </div>
            );
          })}
        </div>

        <SectionLabel num="02" title="About Nakshatra Namaha Creations"/>
        <div style={{ fontSize:13, color:BODY, lineHeight:1.95, marginBottom:24, textAlign:"justify" }}>Nakshatra Namaha Creations is a full-service digital agency with over 10 years of experience building websites, mobile apps, CRM systems and digital platforms for businesses across India. We have delivered 565+ projects for clients in trading, manufacturing, healthcare, real estate and professional services. Our in-house team of designers and developers brings the same quality and attention to detail to every engagement — regardless of project size.</div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:0, border:`1px solid ${BORDER}`, borderRadius:10, overflow:"hidden" }}>
          {[
            {val:"10+", lbl:"Years in Business"},
            {val:"565+",lbl:"Projects Delivered"},
            {val:"35+", lbl:"In-House Experts"},
            {val:"4",   lbl:"Office Locations"},
          ].map((s,i)=>(
            <div key={i} style={{ padding:"22px 16px", background: i%2===0 ? WHITE : OFFWHITE, borderRight: i<3 ? `1px solid ${BORDER}` : "none", display:"flex", flexDirection:"column", gap:6 }}>
              <div style={{ fontSize:10, fontWeight:700, color:SLATE, textTransform:"uppercase", letterSpacing:1.5 }}>{s.lbl}</div>
              <div style={{ fontSize:32, fontWeight:900, color:DARK, lineHeight:1, letterSpacing:-1 }}>{s.val}</div>
              <div style={{ width:24, height:3, background:PRIMARY, borderRadius:2, marginTop:2 }}/>
            </div>
          ))}
        </div>

        <PageFooter/>
      </div>

      {/* ══════════════════════════════════════════
          PAGE 3 — SCOPE OF WORK
      ══════════════════════════════════════════ */}
      <div style={{ padding:"36px 44px 24px", background:WHITE, pageBreakAfter:"always" }}>
        <PageHeader/>
        <SectionLabel num="03" title="Scope of Work"/>
        <div style={{ fontSize:13, color:BODY, lineHeight:1.95, marginBottom:24, textAlign:"justify" }}>The following describes every deliverable included in this engagement for <strong style={{ color:DARK }}>{q.clientName || q.clientCompany}</strong>. Each item is individually scoped and executed to meet your specific business goals.</div>

        {pd.scope.map((s, i) => (
          <div key={i} style={{ display:"flex", gap:0, marginBottom:12, borderRadius:10, overflow:"hidden", border:`1px solid ${BORDER}`, boxShadow:"0 1px 3px rgba(0,0,0,.04)" }}>
            {/* number badge */}
            <div style={{ flexShrink:0, width:52, background: i%2===0 ? PRIMARY : PRIMARY2, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize:14, fontWeight:800, color:WHITE }}>{s.num}</span>
            </div>
            {/* content */}
            <div style={{ flex:1, padding:"13px 18px", background: i%2===0 ? WHITE : OFFWHITE }}>
              <div style={{ fontSize:13, fontWeight:700, color:DARK, marginBottom:4 }}>{s.title}</div>
              <div style={{ fontSize:11.5, color:SLATE, lineHeight:1.8, textAlign:"justify" }}>{s.desc}</div>
            </div>
          </div>
        ))}

        {q.notes && (
          <div style={{ marginTop:20, padding:"14px 18px", background:"#eff6ff", borderRadius:8, borderLeft:`4px solid ${PRIMARY2}` }}>
            <div style={{ fontSize:9.5, fontWeight:700, color:PRIMARY, textTransform:"uppercase", letterSpacing:1.5, marginBottom:6 }}>Additional Notes</div>
            <div style={{ fontSize:12, color:BODY, lineHeight:1.8, whiteSpace:"pre-wrap" }}>{q.notes}</div>
          </div>
        )}
        <PageFooter/>
      </div>

      {/* ══════════════════════════════════════════
          PAGE 4 — DELIVERABLES + TIMELINE
      ══════════════════════════════════════════ */}
      <div style={{ padding:"36px 44px 24px", background:WHITE, pageBreakAfter:"always" }}>
        <PageHeader/>
        <SectionLabel num="04" title="What Is Included"/>

        <div style={{ columns:2, columnGap:32, marginBottom:28 }}>
          {pd.included.map((item, i) => (
            <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"6px 0", borderBottom:`1px solid ${BORDER}`, breakInside:"avoid" }}>
              <span style={{ color:SUCCESS, fontWeight:900, fontSize:14, flexShrink:0, lineHeight:1.55 }}>✓</span>
              <span style={{ fontSize:11.5, color:BODY, lineHeight:1.7 }} dangerouslySetInnerHTML={{ __html: item.replace(/^([^—]+)—/, `<strong style="color:${DARK}">$1</strong> —`) }}/>
            </div>
          ))}
        </div>

        {pd.notIncluded.length > 0 && (
          <>
            <div style={{ fontSize:13, fontWeight:700, color:DARK, marginBottom:10, paddingBottom:6, borderBottom:`3px solid ${PRIMARY2}`, display:"inline-block" }}>Not Included in This Package</div>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11.5, marginBottom:28, borderRadius:8, overflow:"hidden" }}>
              <thead>
                <tr style={{ background:`linear-gradient(135deg,${HEADBG},${PRIMARY})` }}>
                  <th style={{ padding:"10px 14px", color:WHITE, textAlign:"left", fontWeight:600, fontSize:10, letterSpacing:.5 }}>Item</th>
                  <th style={{ padding:"10px 14px", color:WHITE, textAlign:"left", fontWeight:600, fontSize:10, letterSpacing:.5 }}>Status</th>
                  <th style={{ padding:"10px 14px", color:WHITE, textAlign:"left", fontWeight:600, fontSize:10, letterSpacing:.5 }}>Available Separately</th>
                </tr>
              </thead>
              <tbody>
                {pd.notIncluded.map(([item, avail], i) => (
                  <tr key={i} style={{ background: i%2===0 ? OFFWHITE : WHITE }}>
                    <td style={{ padding:"9px 14px", color:BODY, borderBottom:`1px solid ${BORDER}` }}>{item}</td>
                    <td style={{ padding:"9px 14px", borderBottom:`1px solid ${BORDER}` }}><span style={{ fontSize:10, fontWeight:600, color:"#b91c1c", background:"#fef2f2", padding:"2px 8px", borderRadius:4 }}>Not included</span></td>
                    <td style={{ padding:"9px 14px", color:SLATE, borderBottom:`1px solid ${BORDER}` }}>{avail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <SectionLabel num="05" title={`Project Timeline — ${pd.totalDays}`}/>
        {/* Timeline cards */}
        <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
          {pd.timeline.map((t, i) => (
            <div key={i} style={{ display:"flex", gap:0, alignItems:"stretch", marginBottom:10 }}>
              {/* Step number + connector */}
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginRight:16, flexShrink:0 }}>
                <div style={{ width:34, height:34, borderRadius:"50%", background: i===0 ? PRIMARY : i===pd.timeline.length-1 ? SUCCESS : OFFWHITE, border:`2px solid ${i===0 ? PRIMARY : i===pd.timeline.length-1 ? SUCCESS : BORDER}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <span style={{ fontSize:12, fontWeight:800, color: i===0||i===pd.timeline.length-1 ? WHITE : SLATE }}>{i+1}</span>
                </div>
                {i < pd.timeline.length-1 && <div style={{ width:2, flex:1, background:BORDER, minHeight:8, marginTop:4 }}/>}
              </div>
              {/* Card */}
              <div style={{ flex:1, border:`1px solid ${BORDER}`, borderRadius:8, overflow:"hidden", marginBottom: i < pd.timeline.length-1 ? 0 : 0 }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 16px", background: i===0 ? PRIMARY : i===pd.timeline.length-1 ? "#f0fdf4" : OFFWHITE, borderBottom:`1px solid ${BORDER}` }}>
                  <div style={{ fontSize:12, fontWeight:700, color: i===0 ? WHITE : DARK }}>{t.phase}</div>
                  <div style={{ fontSize:10, fontWeight:700, color: i===0 ? "rgba(255,255,255,.8)" : PRIMARY, background: i===0 ? "rgba(255,255,255,.15)" : "#eff6ff", padding:"2px 10px", borderRadius:12, border: i===0 ? "none" : `1px solid #bfdbfe` }}>{t.days}</div>
                </div>
                <div style={{ padding:"10px 16px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 20px", background:WHITE }}>
                  <div>
                    <div style={{ fontSize:8.5, fontWeight:700, color:SLATE, textTransform:"uppercase", letterSpacing:1, marginBottom:3 }}>Activities</div>
                    <div style={{ fontSize:11.5, color:BODY, lineHeight:1.7 }}>{t.activity}</div>
                  </div>
                  <div>
                    <div style={{ fontSize:8.5, fontWeight:700, color:PRIMARY, textTransform:"uppercase", letterSpacing:1, marginBottom:3 }}>NNC Deliverable</div>
                    <div style={{ fontSize:11.5, color:SLATE, lineHeight:1.7, fontStyle:"italic" }}>{t.client}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <PageFooter/>
      </div>

      {/* ══════════════════════════════════════════
          PAGE 5 — INVESTMENT
      ══════════════════════════════════════════ */}
      <div style={{ padding:"36px 44px 24px", background:WHITE, pageBreakAfter:"always" }}>
        <PageHeader/>
        <SectionLabel num="06" title="Investment &amp; Payment Schedule"/>
        <div style={{ fontSize:13, color:BODY, lineHeight:1.9, marginBottom:24 }}>The investment for this engagement for <strong style={{ color:DARK }}>{q.clientName || q.clientCompany}</strong> is outlined below. Payment is structured in two milestones for your convenience.</div>

        {/* Total callout — clean blue */}
        <div style={{ background:`linear-gradient(135deg,${HEADBG} 0%,${PRIMARY} 60%,${PRIMARY2} 100%)`, borderRadius:12, padding:"24px 32px", marginBottom:24, display:"flex", alignItems:"center", justifyContent:"space-between", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", right:-40, top:-40, width:200, height:200, borderRadius:"50%", background:"rgba(255,255,255,.05)" }}/>
          <div>
            <div style={{ fontSize:9.5, fontWeight:600, color:"rgba(255,255,255,.55)", letterSpacing:2, textTransform:"uppercase", marginBottom:8 }}>{cat.toUpperCase()} — Complete Package</div>
            <div style={{ fontSize:42, fontWeight:800, color:WHITE, lineHeight:1 }}>&#8377; {fmt(q.subtotal || q.total)}</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,.5)", marginTop:6 }}>Excluding GST</div>
          </div>
          <div style={{ textAlign:"right", position:"relative", zIndex:1 }}>
            <div style={{ fontSize:11, color:"rgba(255,255,255,.55)", marginBottom:6 }}>+ {q.tax || 18}% GST applicable</div>
            <div style={{ fontSize:13, fontWeight:800, color:WHITE, background:"rgba(255,255,255,.15)", padding:"8px 18px", borderRadius:8, border:"1px solid rgba(255,255,255,.2)" }}>
              Total Payable: &#8377; {fmt(q.total)}
            </div>
          </div>
        </div>

        {/* Line items table */}
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, marginBottom:24 }}>
          <thead>
            <tr style={{ borderBottom:`2px solid ${PRIMARY2}` }}>
              <th style={{ padding:"10px 14px", textAlign:"left", color:SLATE, fontWeight:700, fontSize:10, textTransform:"uppercase", letterSpacing:.5, width:44 }}>#</th>
              <th style={{ padding:"10px 14px", textAlign:"left", color:SLATE, fontWeight:700, fontSize:10, textTransform:"uppercase", letterSpacing:.5 }}>Deliverable</th>
              <th style={{ padding:"10px 14px", textAlign:"right", color:SLATE, fontWeight:700, fontSize:10, textTransform:"uppercase", letterSpacing:.5 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {(q.lineItems||[]).map((it, i) => (
              <tr key={i} style={{ background: i%2===0 ? OFFWHITE : WHITE, borderBottom:`1px solid ${BORDER}` }}>
                <td style={{ padding:"12px 14px" }}>
                  <div style={{ width:28, height:28, borderRadius:"50%", background:`linear-gradient(135deg,${PRIMARY},${PRIMARY2})`, color:WHITE, fontSize:11, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center" }}>{i+1}</div>
                </td>
                <td style={{ padding:"12px 14px", fontWeight:600, color:DARK }}>{it.description}</td>
                <td style={{ padding:"12px 14px", textAlign:"right", fontWeight:700, color:DARK, fontSize:13 }}>&#8377; {fmt(it.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop:`1px solid ${BORDER}` }}>
              <td/><td style={{ padding:"8px 14px", color:SLATE, fontSize:12 }}>Subtotal</td>
              <td style={{ padding:"8px 14px", textAlign:"right", fontWeight:700, color:DARK }}>&#8377; {fmt(q.subtotal)}</td>
            </tr>
            {q.discount > 0 && (
              <tr><td/><td style={{ padding:"4px 14px", color:SUCCESS, fontSize:12 }}>Discount</td><td style={{ padding:"4px 14px", textAlign:"right", color:SUCCESS, fontWeight:700 }}>− &#8377; {fmt(q.discount)}</td></tr>
            )}
            {q.tax > 0 && (
              <tr><td/><td style={{ padding:"4px 14px", color:SLATE, fontSize:12 }}>GST @ {q.tax}%</td><td style={{ padding:"4px 14px", textAlign:"right", color:SLATE, fontWeight:700 }}>&#8377; {fmt(gstAmt)}</td></tr>
            )}
            <tr style={{ background:`linear-gradient(135deg,${HEADBG},${PRIMARY})` }}>
              <td/>
              <td style={{ padding:"14px", color:WHITE, fontWeight:700, fontSize:14 }}>Total Payable (incl. GST)</td>
              <td style={{ padding:"14px", textAlign:"right", color:WHITE, fontWeight:900, fontSize:18 }}>&#8377; {fmt(q.total)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Payment schedule */}
        <div style={{ fontSize:13, fontWeight:700, color:DARK, marginBottom:12, paddingBottom:6, borderBottom:`3px solid ${PRIMARY2}`, display:"inline-block" }}>Payment Schedule</div>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, marginBottom:14 }}>
          <thead>
            <tr style={{ background:`linear-gradient(135deg,${HEADBG},${PRIMARY})` }}>
              {["Milestone","Amount","GST","Total Payable","When Due"].map(h=>(
                <th key={h} style={{ padding:"10px 14px", color:WHITE, textAlign:"left", fontWeight:600, fontSize:10, letterSpacing:.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[["Milestone 1 — Project Kickoff","Before design / development begins"],
              ["Milestone 2 — Before Delivery", "Before final delivery / go-live"]].map(([label, when], i) => {
              const half = (q.subtotal||0)/2;
              const gst  = (half * (q.tax||18)) / 100;
              return (
                <tr key={i} style={{ background: i%2===0 ? OFFWHITE : WHITE, borderBottom:`1px solid ${BORDER}` }}>
                  <td style={{ padding:"12px 14px", fontWeight:700, color:DARK }}>{label}</td>
                  <td style={{ padding:"12px 14px", fontWeight:700, color:DARK }}>&#8377; {fmt(half)}</td>
                  <td style={{ padding:"12px 14px", color:SLATE }}>&#8377; {fmt(gst)}</td>
                  <td style={{ padding:"12px 14px", fontWeight:800, color:WHITE, background:PRIMARY }}>&#8377; {fmt(half+gst)}</td>
                  <td style={{ padding:"12px 14px", color:SLATE, fontStyle:"italic" }}>{when}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ fontSize:11, color:SLATE, lineHeight:1.7, padding:"10px 16px", background:"#eff6ff", borderRadius:8, border:`1px solid #bfdbfe` }}>Accepted payment modes: Bank Transfer (NEFT / IMPS / RTGS), UPI, Cheque. A GST Invoice will be raised at each milestone.</div>
        <PageFooter/>
      </div>

      {/* ══════════════════════════════════════════
          PAGE 6 — TERMS & CLOSING
      ══════════════════════════════════════════ */}
      <div style={{ padding:"36px 44px 24px", background:WHITE }}>
        <PageHeader/>
        <SectionLabel num="07" title="Terms &amp; Conditions"/>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:8 }}>
          {(q.terms || DEFAULT_TERMS[q.serviceCategory] || "").split("\n").filter(Boolean).map((line, i) => (
            <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"12px 14px", background:WHITE, borderRadius:8, border:`1px solid ${BORDER}`, boxShadow:"0 1px 4px rgba(0,0,0,.04)" }}>
              <div style={{ flexShrink:0, width:20, height:20, borderRadius:6, background:PRIMARY, color:WHITE, fontSize:9, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", marginTop:1 }}>{i+1}</div>
              <div style={{ fontSize:11.5, color:BODY, lineHeight:1.8 }}>{line.replace(/^\d+\.\s*/, "")}</div>
            </div>
          ))}
        </div>

        {/* CTA closing box */}
        <div style={{ marginTop:32, borderRadius:12, overflow:"hidden", display:"flex", border:`1px solid ${BORDER}`, boxShadow:"0 2px 12px rgba(30,64,175,.08)" }}>
          <div style={{ flex:"0 0 55%", padding:"28px 32px", background:OFFWHITE, borderRight:`1px solid ${BORDER}` }}>
            <div style={{ fontSize:9.5, fontWeight:700, color:PRIMARY, letterSpacing:2, textTransform:"uppercase", marginBottom:8 }}>Next Step</div>
            <div style={{ fontSize:18, fontWeight:800, color:DARK, marginBottom:10, lineHeight:1.3 }}>Ready to get started?</div>
            <div style={{ fontSize:13, color:BODY, lineHeight:1.85 }}>Confirm this proposal and your <strong style={{ color:DARK }}>{cat.toLowerCase()}</strong> can be delivered in <strong style={{ color:PRIMARY }}>{pd.totalDays}</strong>. Reply to this proposal or contact us directly.</div>
          </div>
          <div style={{ flex:1, padding:"28px 28px", background:`linear-gradient(135deg,${HEADBG},${PRIMARY})`, display:"flex", flexDirection:"column", justifyContent:"center" }}>
            <div style={{ fontSize:9.5, fontWeight:700, color:"rgba(255,255,255,.6)", letterSpacing:2, textTransform:"uppercase", marginBottom:12 }}>Contact Us</div>
            <div style={{ fontSize:20, fontWeight:800, color:WHITE, marginBottom:8 }}>+91 99005 66466</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,.6)", marginBottom:4 }}>info@nakshatranamahacreations.com</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,.75)", fontWeight:600 }}>nakshatranamahacreations.com</div>
          </div>
        </div>

        {/* Signature row */}
        <div style={{ marginTop:32, display:"flex", justifyContent:"space-between", alignItems:"flex-end", padding:"20px 0", borderTop:`1px solid ${BORDER}` }}>
          <div>
            <div style={{ width:140, height:1, background:SLATE, marginBottom:8 }}/>
            <div style={{ fontSize:10, color:SLATE, marginBottom:2 }}>Authorised Signatory</div>
            <div style={{ fontSize:12, fontWeight:700, color:DARK }}>Nakshatra Namaha Creations</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:12, fontWeight:700, color:DARK }}>Nakshatra Namaha Creations Pvt. Ltd.</div>
            <div style={{ fontSize:10.5, color:SLATE, marginTop:3 }}>{bi.addr}</div>
            <div style={{ fontSize:10.5, color:PRIMARY2, marginTop:3, fontWeight:600 }}>{bi.phone}  ·  nakshatranamahacreations.com</div>
            <div style={{ fontSize:10, color:SLATE, marginTop:3 }}>GSTIN: {getNncGstin()}</div>
          </div>
        </div>

        <PageFooter/>
      </div>

      {/* ══════════════════════════════════════════
          PAGE 7 — THANK YOU
      ══════════════════════════════════════════ */}
      <div style={{ minHeight:780, background:WHITE, display:"flex", flexDirection:"column", position:"relative", overflow:"hidden" }}>
        {/* top accent line */}
        <div style={{ height:4, background:`linear-gradient(90deg,${PRIMARY},${ACCENT})`, flexShrink:0 }}/>

        {/* main center content */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"52px 48px 32px", textAlign:"center" }}>

          {/* Logo */}
          <div style={{ width:72, height:72, borderRadius:18, background:OFFWHITE, border:`1px solid ${BORDER}`, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:28 }}>
            <img src={nncLogo} alt="NNC" style={{ height:52 }}/>
          </div>

          {/* Thank you heading */}
          <div style={{ fontSize:11, fontWeight:700, color:PRIMARY, textTransform:"uppercase", letterSpacing:3, marginBottom:14 }}>Thank You</div>
          <div style={{ fontSize:42, fontWeight:900, color:DARK, lineHeight:1.1, letterSpacing:-1.5, marginBottom:16 }}>We appreciate your trust.</div>
          <div style={{ width:48, height:3, background:`linear-gradient(90deg,${PRIMARY},${ACCENT})`, borderRadius:2, margin:"0 auto 24px" }}/>
          <div style={{ fontSize:14, color:BODY, lineHeight:1.9, maxWidth:520, marginBottom:48 }}>
            We look forward to partnering with <strong style={{ color:DARK }}>{q.clientCompany || q.clientName || "you"}</strong> on this <strong style={{ color:PRIMARY }}>{cat}</strong> project. Our team is ready to begin as soon as you confirm this proposal. Please feel free to reach out with any questions.
          </div>

          {/* Contact highlight */}
          <div style={{ display:"flex", alignItems:"center", gap:24, marginBottom:52, padding:"16px 32px", background:OFFWHITE, borderRadius:10, border:`1px solid ${BORDER}` }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:9, fontWeight:700, color:SLATE, textTransform:"uppercase", letterSpacing:1.5, marginBottom:4 }}>Call Us</div>
              <div style={{ fontSize:15, fontWeight:800, color:PRIMARY, whiteSpace:"nowrap" }}>+91 99005 66466</div>
            </div>
            <div style={{ width:1, height:36, background:BORDER }}/>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:9, fontWeight:700, color:SLATE, textTransform:"uppercase", letterSpacing:1.5, marginBottom:4 }}>Email Us</div>
              <div style={{ fontSize:13, fontWeight:700, color:PRIMARY }}>info@nakshatranamahacreations.com</div>
            </div>
            <div style={{ width:1, height:36, background:BORDER }}/>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:9, fontWeight:700, color:SLATE, textTransform:"uppercase", letterSpacing:1.5, marginBottom:4 }}>Website</div>
              <div style={{ fontSize:13, fontWeight:700, color:PRIMARY }}>nakshatranamahacreations.com</div>
            </div>
          </div>

          {/* Branch offices */}
          <div style={{ width:"100%", maxWidth:640 }}>
            <div style={{ fontSize:10, fontWeight:700, color:SLATE, textTransform:"uppercase", letterSpacing:2, marginBottom:16 }}>Our Offices</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
              {[
                { city:"Bengaluru", addr:"Darshan Plaza, 1st Floor,\nChannasandra, Karnataka 560 098" },
                { city:"Mysuru",    addr:"Suswani Towers, JP Nagar\n2nd Stage, Karnataka 570 008" },
                { city:"Mumbai",    addr:"Lodha Signet, Kolshet Rd,\nThane West, Maharashtra 400 607" },
              ].map((o,i) => (
                <div key={i} style={{ borderRadius:10, border:`1px solid ${BORDER}`, overflow:"hidden", textAlign:"left" }}>
                  <div style={{ padding:"10px 14px", background:PRIMARY, display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:6, height:6, borderRadius:"50%", background:ACCENT }}/>
                    <div style={{ fontSize:11, fontWeight:800, color:WHITE, letterSpacing:.3 }}>{o.city}</div>
                  </div>
                  <div style={{ padding:"12px 14px", background:OFFWHITE }}>
                    <div style={{ fontSize:10.5, color:BODY, lineHeight:1.8, whiteSpace:"pre-line" }}>{o.addr}</div>
                    <div style={{ fontSize:10, color:PRIMARY, fontWeight:600, marginTop:6 }}>+91 99005 66466</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* bottom bar */}
        <div style={{ padding:"14px 52px", borderTop:`1px solid ${BORDER}`, display:"flex", justifyContent:"space-between", alignItems:"center", background:OFFWHITE, flexShrink:0 }}>
          <span style={{ fontSize:9, fontWeight:700, color:PRIMARY, textTransform:"uppercase", letterSpacing:1.5 }}>Confidential</span>
          <span style={{ fontSize:9, color:SLATE }}>Nakshatra Namaha Creations Pvt Ltd  ·  GSTIN: {getNncGstin()}</span>
          <span style={{ fontSize:9, color:SLATE, fontWeight:600 }}>{q.quoteNumber}</span>
        </div>
      </div>

    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   MAIN PAGE
──────────────────────────────────────────────────────────────────*/
export default function QuotationPage() {
  const [mode, setMode] = useState("list"); // list | form | view | proforma-view
  const [quotations, setQuotations] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({ total: 0, byStatus: {}, thisMonth: 0, acceptedValue: 0, conversionRate: 0 });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [filters, setFilters] = useState({ status: "", branch: "", q: "", page: 1 });
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [viewingProforma, setViewingProforma] = useState(null);

  // Negotiation panel
  const [negotiationNote, setNegotiationNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  // Revision form
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [revFormData, setRevFormData] = useState(null);

  // Convert to Proforma
  const [showConvertForm, setShowConvertForm] = useState(false);
  const [convertData, setConvertData] = useState({ deliveryDate: "", paymentTerms: "50% advance, 50% on delivery" });
  const [converting, setConverting] = useState(false);

  // Enquiry search (for form)
  const [enquirySearch, setEnquirySearch] = useState("");
  const [enquirySuggestions, setEnquirySuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const enquirySearchTimer = useRef(null);

  const pdfRef = useRef(null);

  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v, page: 1 }));

  /* ─── Fetch list ─── */
  const fetchQuotations = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filters.status) p.set("status", filters.status);
      if (filters.branch) p.set("branch", filters.branch);
      if (filters.q)      p.set("q", filters.q);
      p.set("page", filters.page);
      p.set("limit", 20);
      const res  = await fetch(`${API}/api/quotations?${p}`, { headers: authHeader() });
      const json = await res.json();
      if (json.success) { setQuotations(json.data); setTotalCount(json.total); }
    } catch { toast.error("Failed to fetch quotations"); }
    finally { setLoading(false); }
  }, [filters]);

  const fetchStats = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/api/quotations/stats`, { headers: authHeader() });
      const json = await res.json();
      if (json.success) setStats(json.data);
    } catch {}
  }, []);

  /* Run both fetches in parallel on first load; stats only on mount */
  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  useEffect(() => {
    fetchStats();
  }, []); // stats only once on mount

  /* ─── Enquiry autocomplete ─── */
  const searchEnquiries = (val) => {
    setEnquirySearch(val);
    clearTimeout(enquirySearchTimer.current);
    if (!val.trim()) { setEnquirySuggestions([]); setShowSuggestions(false); return; }
    enquirySearchTimer.current = setTimeout(async () => {
      try {
        const res  = await fetch(`${API}/api/enquiries?q=${encodeURIComponent(val)}&limit=5&includeConverted=true`, { headers: authHeader() });
        const json = await res.json();
        if (json.success) { setEnquirySuggestions(json.data || []); setShowSuggestions(true); }
      } catch {}
    }, 300);
  };

  const selectEnquiry = (enq) => {
    setFormData(f => ({
      ...f,
      clientName:    enq.name    || f.clientName,
      clientPhone:   enq.phone   || f.clientPhone,
      clientEmail:   enq.email   || f.clientEmail,
      clientCompany: enq.company || f.clientCompany,
      branch:        enq.branch  || f.branch,
      enquiryId:     enq._id,
      services:      enq.services || [],
    }));
    setEnquirySearch(`${enq.name} — ${enq.phone}`);
    setShowSuggestions(false);
  };

  /* ─── Line item helpers ─── */
  const updateItem = (idx, field, val) => {
    setFormData(f => {
      const items = f.lineItems.map((it, i) => {
        if (i !== idx) return it;
        const updated = { ...it, [field]: val };
        if (field === "qty" || field === "rate") {
          updated.amount = Number(updated.qty || 0) * Number(updated.rate || 0);
        }
        return updated;
      });
      return { ...f, lineItems: items };
    });
  };

  const addItem    = () => setFormData(f => ({ ...f, lineItems: [...f.lineItems, { ...EMPTY_ITEM }] }));
  const removeItem = (idx) => setFormData(f => ({
    ...f, lineItems: f.lineItems.length > 1 ? f.lineItems.filter((_, i) => i !== idx) : f.lineItems,
  }));

  const totals = calcTotals(formData.lineItems, formData.discount, formData.tax);

  /* ─── Save quotation ─── */
  const handleSave = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!formData.clientName.trim()) { toast.error("Client name is required"); return null; }
    setSaving(true);
    try {
      const url    = editingId ? `${API}/api/quotations/${editingId}` : `${API}/api/quotations`;
      const method = editingId ? "PUT" : "POST";
      let res  = await fetch(url, { method, headers: authHeader(), body: JSON.stringify(formData) });
      let json = await res.json();
      // Retry once on quote number conflict (race condition)
      if (!json.success && res.status === 409) {
        await new Promise(r => setTimeout(r, 200));
        res  = await fetch(url, { method, headers: authHeader(), body: JSON.stringify(formData) });
        json = await res.json();
      }
      if (json.success) {
        const baseMsg = editingId ? "Quotation updated" : "Quotation created";
        if (json.data?.clientEmail) {
          if (json.emailSent) {
            toast.success(`${baseMsg} — emailed to ${json.data.clientEmail}`);
          } else if (json.emailError) {
            toast.error(`${baseMsg}, but email failed: ${json.emailError}`, { duration: 8000 });
          } else {
            toast.success(baseMsg);
          }
        } else {
          toast.success(baseMsg);
        }
        return json.data;
      }
      toast.error(json.message || "Save failed");
      return null;
    } catch { toast.error("Save failed"); return null; }
    finally { setSaving(false); }
  };

  /* ─── Save & Send Mail (form button) ─── */
  const handleSaveAndSend = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!formData.clientEmail?.trim()) { toast.error("Client email is required to send mail"); return; }
    if (!formData.senderEmail?.trim()) { toast.error("Your email (replies go here) is required"); return; }
    const saved = await handleSave();
    if (!saved?._id) return;
    await handleSendEmail(saved._id);
    backToList();
    fetchQuotations(); fetchStats();
  };

  /* ─── Save only (form submit) ─── */
  const handleSaveOnly = async (e) => {
    const saved = await handleSave(e);
    if (saved) { backToList(); fetchQuotations(); fetchStats(); }
  };

  /* ─── Send email ─── */
  const handleSendEmail = async (id) => {
    setSending(true);
    // Client-side timeout — if the backend hangs (e.g. SMTP stuck), abort after 45s
    // so the button doesn't stay on "Sending..." forever.
    const ctrl    = new AbortController();
    const timerId = setTimeout(() => ctrl.abort(), 45000);
    try {
      const res = await fetch(`${API}/api/quotations/${id}/send`, {
        method:  "POST",
        headers: authHeader(),
        signal:  ctrl.signal,
      });
      let json = {};
      try { json = await res.json(); } catch { /* non-JSON response */ }

      if (res.ok && json.success && json.emailSent) {
        toast.success(json.message || "Quotation emailed to client");
        if (viewing?._id === id) {
          const r2 = await fetch(`${API}/api/quotations/${id}`, { headers: authHeader() });
          const j2 = await r2.json();
          if (j2.success) setViewing(j2.data);
        }
        fetchQuotations(); fetchStats();
      } else {
        // Show the actual server error (includes underlying SMTP code/response now)
        toast.error(json.message || `Email failed (HTTP ${res.status})`, { duration: 8000 });
      }
    } catch (err) {
      if (err.name === "AbortError") {
        toast.error("Email is taking too long — the SMTP server isn't responding. Check Render env vars (EMAIL_USER / GMAIL_APP_PASS).", { duration: 10000 });
      } else {
        toast.error(`Email failed: ${err.message || "network error"}`, { duration: 8000 });
      }
    } finally {
      clearTimeout(timerId);
      setSending(false);
    }
  };

  /* ─── Update status ─── */
  const handleStatusChange = async (id, status) => {
    try {
      const res  = await fetch(`${API}/api/quotations/${id}/status`, {
        method: "PATCH", headers: authHeader(), body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Marked as ${STATUS_META[status]?.label || status}`);
        setViewing(json.data);
        fetchQuotations(); fetchStats();
      } else toast.error(json.message || "Status update failed");
    } catch { toast.error("Status update failed"); }
  };

  /* ─── Add negotiation note ─── */
  const handleAddNote = async () => {
    if (!negotiationNote.trim()) { toast.error("Note cannot be empty"); return; }
    setAddingNote(true);
    try {
      const res  = await fetch(`${API}/api/quotations/${viewing._id}/negotiate`, {
        method: "POST", headers: authHeader(),
        body: JSON.stringify({ note: negotiationNote, by: getUser() }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Note added");
        setViewing(json.data);
        setNegotiationNote("");
        fetchQuotations(); fetchStats();
      } else toast.error(json.message || "Failed to add note");
    } catch { toast.error("Failed to add note"); }
    finally { setAddingNote(false); }
  };

  /* ─── Create revision ─── */
  const handleCreateRevision = async () => {
    if (!revFormData) return;
    setSaving(true);
    try {
      const res  = await fetch(`${API}/api/quotations/${viewing._id}/revise`, {
        method: "POST", headers: authHeader(), body: JSON.stringify(revFormData),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Revision ${json.data.revisionNumber} created: ${json.data.quoteNumber}`);
        setShowRevisionForm(false);
        setViewing(json.data);
        fetchQuotations(); fetchStats();
      } else toast.error(json.message || "Revision failed");
    } catch { toast.error("Revision failed"); }
    finally { setSaving(false); }
  };

  /* ─── Convert to Proforma ─── */
  const handleConvertToProforma = async () => {
    setConverting(true);
    try {
      const res  = await fetch(`${API}/api/quotations/${viewing._id}/convert-to-proforma`, {
        method: "POST", headers: authHeader(), body: JSON.stringify(convertData),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Proforma Invoice ${json.data.proformaNumber} created`);
        setShowConvertForm(false);
        // Refresh the quotation
        const r2 = await fetch(`${API}/api/quotations/${viewing._id}`, { headers: authHeader() });
        const j2 = await r2.json();
        if (j2.success) setViewing(j2.data);
        setViewingProforma(json.data);
        setMode("proforma-view");
        fetchQuotations(); fetchStats();
      } else toast.error(json.message || "Conversion failed");
    } catch { toast.error("Conversion failed"); }
    finally { setConverting(false); }
  };

  /* ─── Send Proforma Email ─── */
  const handleSendProformaEmail = async (piId) => {
    setSending(true);
    try {
      const res  = await fetch(`${API}/api/proforma-invoices/${piId}/send`, { method: "POST", headers: authHeader() });
      const json = await res.json();
      if (json.success) {
        toast.success(json.emailSent ? "Proforma emailed to client" : json.message);
        const r2 = await fetch(`${API}/api/proforma-invoices/${piId}`, { headers: authHeader() });
        const j2 = await r2.json();
        if (j2.success) setViewingProforma(j2.data);
      } else toast.error(json.message || "Email failed");
    } catch { toast.error("Email failed"); }
    finally { setSending(false); }
  };

  /* ─── View Proforma from converted quotation ─── */
  const openProformaFromQuotation = async (proformaId) => {
    try {
      const res  = await fetch(`${API}/api/proforma-invoices/${proformaId}`, { headers: authHeader() });
      const json = await res.json();
      if (json.success) { setViewingProforma(json.data); setMode("proforma-view"); }
      else toast.error("Could not load proforma invoice");
    } catch { toast.error("Failed to load proforma"); }
  };

  /* ─── Delete ─── */
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this quotation?")) return;
    try {
      const res  = await fetch(`${API}/api/quotations/${id}`, { method: "DELETE", headers: authHeader() });
      const json = await res.json();
      if (json.success) { toast.success("Deleted"); fetchQuotations(); fetchStats(); }
      else toast.error(json.message || "Delete failed");
    } catch { toast.error("Delete failed"); }
  };

  /* ─── Open edit ─── */
  const openEdit = (q) => {
    setFormData({
      clientName:    q.clientName    || "",
      clientPhone:   q.clientPhone   || "",
      clientEmail:   q.clientEmail   || "",
      clientCompany: q.clientCompany || "",
      clientAddress: q.clientAddress || "",
      clientGstin:   q.clientGstin   || "",
      branch:        q.branch        || "Bangalore",
      enquiryId:     q.enquiryId     || "",
      senderEmail:   q.senderEmail   || "",
      status:          q.status          || "draft",
      serviceCategory: q.serviceCategory || "",
      lineItems:       q.lineItems?.length ? q.lineItems : [{ ...EMPTY_ITEM }],
      discount:        q.discount        ?? 0,
      tax:             q.tax             ?? 18,
      validUntil:      q.validUntil ? q.validUntil.slice(0, 10) : "",
      notes:           q.notes           || "",
      terms:           q.terms           || "",
    });
    setEditingId(q._id);
    setEnquirySearch(q.enquiryId ? "Linked to enquiry" : "");
    setMode("form");
  };

  /* ─── PDF Download ─── */
  const handleDownloadPdf = async () => {
    const el = document.getElementById("qt-pdf-target");
    if (!el) return;
    const { default: html2pdf } = await import("html2pdf.js");
    const doc = viewing || viewingProforma;
    const filename = doc?.quoteNumber || doc?.proformaNumber || "quotation";
    html2pdf()
      .set({
        margin:      [8, 8, 8, 8],
        filename:    `${filename}.pdf`,
        image:       { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF:       { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(el)
      .save();
  };

  const backToList = () => {
    setMode("list");
    setEditingId(null);
    setFormData({ ...EMPTY_FORM });
    setViewing(null);
    setViewingProforma(null);
    setShowRevisionForm(false);
    setShowConvertForm(false);
    setNegotiationNote("");
    setEnquirySearch("");
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / 20));
  const sm = (status) => STATUS_META[status] || STATUS_META.draft;

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="qt-layout">
      <Sidebar />
      <main className="qt-main">

        {/* ─── Header ─── */}
        <header className="qt-header">
          <div>
            <div className="qt-eyebrow">Sales</div>
            <h1 className="qt-title">
              {mode === "proforma-view" ? "Proforma Invoice" : "Quotations"}
            </h1>
            <p className="qt-subtitle">
              {mode === "list"
                ? `${totalCount} quotation${totalCount !== 1 ? "s" : ""} total`
                : mode === "form"
                  ? editingId ? "Edit quotation" : "New quotation"
                  : mode === "view"
                    ? (viewing?.quoteNumber || "")
                    : (viewingProforma?.proformaNumber || "")}
            </p>
          </div>
          <div className="qt-header-acts">
            {mode !== "list" ? (
              <>
                {(mode === "view" || mode === "proforma-view") && (
                  <button className="qt-btn-dl" onClick={handleDownloadPdf}>
                    <Download size={14} /> Download PDF
                  </button>
                )}
                <button className="qt-btn-sec" onClick={backToList}>← Back</button>
              </>
            ) : (
              <>
                <button className="qt-btn-sec" onClick={() => { fetchQuotations(); fetchStats(); }}>
                  <RefreshCcw size={14} />
                </button>
                <button className="qt-btn-prim" onClick={() => { setFormData({ ...EMPTY_FORM }); setEditingId(null); setMode("form"); }}>
                  <Plus size={15} /> New Quotation
                </button>
              </>
            )}
          </div>
        </header>

        {/* ══ LIST MODE ══ */}
        {mode === "list" && (
          <>
            {/* ── NNC Company Banner ── */}
            <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:14, padding:"20px 28px", marginBottom:20, display:"flex", alignItems:"center", justifyContent:"space-between", gap:24, boxShadow:"0 1px 6px rgba(0,0,0,.05)" }}>
              {/* Left */}
              <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                <img src={nncLogo} alt="NNC" style={{ height:44, borderRadius:10 }}/>
                <div>
                  <div style={{ fontSize:15, fontWeight:800, color:"#111827", letterSpacing:-.3 }}>Nakshatra Namaha Creations</div>
                  <div style={{ fontSize:11.5, color:"#6b7280", marginTop:2 }}>Digital Agency · Bengaluru · Mysuru · Mumbai</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:8 }}>
                    {["Website","Mobile App","E-Commerce","SEO","Logo & Branding","Cloud"].map(s => (
                      <span key={s} style={{ fontSize:10, fontWeight:600, color:"#1e40af", background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:20, padding:"2px 10px" }}>{s}</span>
                    ))}
                  </div>
                </div>
              </div>
              {/* Right stats */}
              <div style={{ display:"flex", alignItems:"center", gap:0, flexShrink:0, border:"1px solid #e2e8f0", borderRadius:10, overflow:"hidden" }}>
                {[{num:"500+",lbl:"Projects"},{num:"350+",lbl:"Clients"},{num:"6+",lbl:"Years"}].map((s,i)=>(
                  <div key={i} style={{ padding:"14px 24px", textAlign:"center", borderRight: i<2 ? "1px solid #e2e8f0" : "none", background: i===1 ? "#f8fafc" : "#fff" }}>
                    <div style={{ fontSize:20, fontWeight:900, color:"#1e40af", lineHeight:1 }}>{s.num}</div>
                    <div style={{ fontSize:9.5, color:"#6b7280", marginTop:4, textTransform:"uppercase", letterSpacing:1 }}>{s.lbl}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="qt-stats">
              <div className="qt-stat-card indigo">
                <div className="qt-stat-icon">📋</div>
                <div className="qt-stat-label">Total Quotes</div>
                <div className="qt-stat-val">{stats.total}</div>
                <div className="qt-stat-sub">All time</div>
              </div>
              <div className="qt-stat-card blue">
                <div className="qt-stat-icon">📤</div>
                <div className="qt-stat-label">Sent</div>
                <div className="qt-stat-val">{stats.byStatus?.sent || 0}</div>
                <div className="qt-stat-sub">Awaiting reply</div>
              </div>
              <div className="qt-stat-card amber">
                <div className="qt-stat-icon">🤝</div>
                <div className="qt-stat-label">Negotiating</div>
                <div className="qt-stat-val">{stats.byStatus?.under_negotiation || 0}</div>
                <div className="qt-stat-sub">In discussion</div>
              </div>
              <div className="qt-stat-card green">
                <div className="qt-stat-icon">🏆</div>
                <div className="qt-stat-label">Won</div>
                <div className="qt-stat-val">{(stats.byStatus?.approved || 0) + (stats.byStatus?.final || 0) + (stats.byStatus?.converted || 0)}</div>
                <div className="qt-stat-sub">₹{fmt(stats.acceptedValue)}</div>
              </div>
              <div className="qt-stat-card violet">
                <div className="qt-stat-icon">📈</div>
                <div className="qt-stat-label">Conversion</div>
                <div className="qt-stat-val">{stats.conversionRate}%</div>
                <div className="qt-stat-sub">Win rate</div>
              </div>
              <div className="qt-stat-card teal">
                <div className="qt-stat-icon">📅</div>
                <div className="qt-stat-label">This Month</div>
                <div className="qt-stat-val">{stats.thisMonth || 0}</div>
                <div className="qt-stat-sub">New quotes</div>
              </div>
            </div>

            {/* Filters */}
            <div className="qt-filters">
              <div className="qt-search-wrap">
                <Search size={14} className="qt-search-icon" />
                <input
                  className="qt-search"
                  placeholder="Search client, company, quote no..."
                  value={filters.q}
                  onChange={e => setFilter("q", e.target.value)}
                />
              </div>
              <select className="qt-sel" value={filters.status} onChange={e => setFilter("status", e.target.value)}>
                <option value="">All Status</option>
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
              </select>
              <select className="qt-sel" value={filters.branch} onChange={e => setFilter("branch", e.target.value)}>
                <option value="">All Branches</option>
                {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              {(filters.status || filters.branch || filters.q) && (
                <button className="qt-clear-btn" onClick={() => setFilters({ status: "", branch: "", q: "", page: 1 })}>Clear</button>
              )}
            </div>

            {/* Table */}
            <div className="qt-table-section">
              {loading ? (
                <div className="qt-empty"><RefreshCcw size={24} className="qt-spin" /><p>Loading...</p></div>
              ) : quotations.length === 0 ? (
                <div className="qt-empty">
                  <FileText size={36} />
                  <p>No quotations found</p>
                  <button className="qt-btn-prim" onClick={() => setMode("form")}><Plus size={14} /> Create First</button>
                </div>
              ) : (
                <div className="qt-table-wrap">
                  <table className="qt-table">
                    <thead>
                      <tr>
                        <th>Quote #</th>
                        <th>Client</th>
                        <th>Branch</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Valid Until</th>
                        <th>Created</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotations.map(q => {
                        const s = sm(q.status);
                        return (
                          <tr key={q._id}>
                            <td>
                              <span className="qt-quote-num">{q.quoteNumber}</span>
                              {q.isRevision && <span className="qt-rev-badge">R{q.revisionNumber}</span>}
                            </td>
                            <td>
                              <div className="qt-client-cell">
                                <div className="qt-client-avatar">{(q.clientName||"?").charAt(0).toUpperCase()}</div>
                                <div className="qt-client-info">
                                  <div className="qt-client-name">{q.clientName}</div>
                                  {q.clientCompany && <div className="qt-client-co">{q.clientCompany}</div>}
                                  {q.clientPhone   && <div className="qt-client-ph">{q.clientPhone}</div>}
                                </div>
                              </div>
                            </td>
                            <td><span className="qt-branch">{q.branch}</span></td>
                            <td><span className="qt-amount">₹{fmt(q.total)}</span></td>
                            <td><span className={`qt-status qt-st-${s.color}`}>{s.label}</span></td>
                            <td>{fmtDate(q.validUntil)}</td>
                            <td>{fmtDate(q.createdAt)}</td>
                            <td>
                              <div className="qt-actions">
                                <button className="qt-btn-icon" title="View" onClick={() => { setViewing(q); setMode("view"); }}>
                                  <Eye size={15} />
                                </button>
                                <button className="qt-btn-icon" title="Edit" onClick={() => openEdit(q)}>
                                  <Edit2 size={15} />
                                </button>
                                {q.clientEmail && (
                                  <button className="qt-btn-icon send" title="Send to client" disabled={sending} onClick={() => handleSendEmail(q._id)}>
                                    <Send size={15} />
                                  </button>
                                )}
                                {isMasterAdmin() && (
                                  <button className="qt-btn-icon danger" title="Delete" onClick={() => handleDelete(q._id)}>
                                    <Trash2 size={15} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {totalPages > 1 && (
              <div className="qt-pagination">
                <button className="qt-pg-btn" disabled={filters.page <= 1} onClick={() => setFilter("page", filters.page - 1)}>
                  <ChevronLeft size={15} />
                </button>
                <span className="qt-pg-info">Page {filters.page} / {totalPages}</span>
                <button className="qt-pg-btn" disabled={filters.page >= totalPages} onClick={() => setFilter("page", filters.page + 1)}>
                  <ChevronRight size={15} />
                </button>
              </div>
            )}
          </>
        )}

        {/* ══ FORM MODE ══ */}
        {mode === "form" && (
          <form className="qt-form" onSubmit={handleSaveOnly}>
            <div className="qt-form-body">

              {/* Enquiry Search */}
              <div className="qt-form-section">
                <div className="qt-section-title">Link to Enquiry (optional)</div>
                <div className="qt-enquiry-search-wrap" style={{ position: "relative" }}>
                  <Search size={14} className="qt-search-icon" />
                  <input
                    className="qt-search"
                    placeholder="Search enquiry by name, phone, company..."
                    value={enquirySearch}
                    onChange={e => searchEnquiries(e.target.value)}
                    onFocus={() => enquirySuggestions.length > 0 && setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  />
                  {showSuggestions && enquirySuggestions.length > 0 && (
                    <div className="qt-enquiry-dropdown">
                      {enquirySuggestions.map(enq => (
                        <div key={enq._id} className="qt-enquiry-item" onMouseDown={() => selectEnquiry(enq)}>
                          <div className="qt-enq-name">{enq.name} <span className="qt-enq-phone">{enq.phone}</span></div>
                          {enq.company && <div className="qt-enq-co">{enq.company}</div>}
                          <div className="qt-enq-meta">{enq.branch} · {enq.services?.slice(0, 2).join(", ")}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {formData.enquiryId && (
                  <div className="qt-linked-badge">
                    <CheckCircle2 size={13} /> Linked to enquiry
                    <button type="button" className="qt-unlink" onClick={() => { setFormData(f => ({ ...f, enquiryId: "" })); setEnquirySearch(""); }}>
                      ✕ Unlink
                    </button>
                  </div>
                )}
              </div>

              {/* Client Info */}
              <div className="qt-form-section">
                <div className="qt-section-title">Client Information</div>
                <div className="qt-form-grid">
                  <div className="qt-field full">
                    <label>Service Category *</label>
                    <select
                      value={formData.serviceCategory}
                      onChange={e => {
                        const cat = e.target.value;
                        setFormData(f => ({
                          ...f,
                          serviceCategory: cat,
                          terms: cat && DEFAULT_TERMS[cat] && !f.terms ? DEFAULT_TERMS[cat] : (cat && DEFAULT_TERMS[cat] ? DEFAULT_TERMS[cat] : f.terms),
                        }));
                      }}
                    >
                      <option value="">— Select service type —</option>
                      {SERVICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="qt-field">
                    <label>Client Name *</label>
                    <input value={formData.clientName} onChange={e => setFormData(f => ({ ...f, clientName: e.target.value }))} placeholder="Full name" required />
                  </div>
                  <div className="qt-field">
                    <label>Phone</label>
                    <input value={formData.clientPhone} onChange={e => setFormData(f => ({ ...f, clientPhone: e.target.value }))} placeholder="+91 98765 43210" />
                  </div>
                  <div className="qt-field">
                    <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>Email</span>
                      <button
                        type="button"
                        disabled={saving || sending || !formData.clientEmail?.trim()}
                        onClick={handleSaveAndSend}
                        title={
                          !formData.clientEmail?.trim()
                            ? "Enter client email first"
                            : `Save and send to ${formData.clientEmail}${formData.senderEmail ? ` (CC: ${formData.senderEmail})` : ""}`
                        }
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "3px 9px", borderRadius: 6, border: "none",
                          background: !formData.clientEmail?.trim() ? "#e2e8f0" : "linear-gradient(135deg,#2563eb,#7c3aed)",
                          color: !formData.clientEmail?.trim() ? "#94a3b8" : "#fff",
                          fontSize: 11, fontWeight: 700, cursor: !formData.clientEmail?.trim() ? "not-allowed" : "pointer",
                          textTransform: "uppercase", letterSpacing: ".3px",
                        }}
                      >
                        {sending ? <RefreshCcw size={11} className="qt-spin" /> : <Send size={11} />}
                        {sending ? "Sending" : "Send Now"}
                      </button>
                    </label>
                    <input type="email" value={formData.clientEmail} onChange={e => setFormData(f => ({ ...f, clientEmail: e.target.value }))} placeholder="client@example.com" />
                  </div>
                  <div className="qt-field">
                    <label>Company</label>
                    <input value={formData.clientCompany} onChange={e => setFormData(f => ({ ...f, clientCompany: e.target.value }))} placeholder="Company name" />
                  </div>
                  <div className="qt-field">
                    <label>Your Email (Replies go here) *</label>
                    <input type="email" value={formData.senderEmail} onChange={e => setFormData(f => ({ ...f, senderEmail: e.target.value }))} placeholder="your.email@gmail.com" />
                    <span style={{fontSize:"10px",color:"#94a3b8",marginTop:2}}>Client replies to this email</span>
                  </div>
                  <div className="qt-field">
                    <label>GSTIN</label>
                    <input value={formData.clientGstin} onChange={e => setFormData(f => ({ ...f, clientGstin: e.target.value }))} placeholder="29AABCXXXXX1Z5" />
                  </div>
                  <div className="qt-field">
                    <label>Branch *</label>
                    <select value={formData.branch} onChange={e => setFormData(f => ({ ...f, branch: e.target.value }))}>
                      {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div className="qt-field full">
                    <label>Billing Address</label>
                    <input value={formData.clientAddress} onChange={e => setFormData(f => ({ ...f, clientAddress: e.target.value }))} placeholder="Full billing address" />
                  </div>
                  <div className="qt-field">
                    <label>Valid Until</label>
                    <input type="date" value={formData.validUntil} onChange={e => setFormData(f => ({ ...f, validUntil: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div className="qt-form-section">
                <div className="qt-section-title-row">
                  <span className="qt-section-title">Line Items</span>
                  <button type="button" className="qt-add-row-btn" onClick={addItem}><PlusCircle size={14} /> Add Row</button>
                </div>
                <div className="qt-items-table-wrap">
                  <table className="qt-items-table">
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th>Qty</th>
                        <th>Rate (₹)</th>
                        <th>Amount (₹)</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.lineItems.map((item, idx) => (
                        <tr key={idx}>
                          <td>
                            <input className="qt-item-input" placeholder="Service / Product description" value={item.description}
                              onChange={e => updateItem(idx, "description", e.target.value)} />
                          </td>
                          <td>
                            <input className="qt-item-input num" type="number" min="0" step="0.01" value={item.qty}
                              onChange={e => updateItem(idx, "qty", e.target.value)} />
                          </td>
                          <td>
                            <input className="qt-item-input num" type="number" min="0" step="1" value={item.rate}
                              onChange={e => updateItem(idx, "rate", e.target.value)} />
                          </td>
                          <td><span className="qt-item-amount">₹{fmt(item.amount)}</span></td>
                          <td>
                            <button type="button" className="qt-remove-row" onClick={() => removeItem(idx)} disabled={formData.lineItems.length <= 1}>
                              <Minus size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="qt-totals">
                  <div className="qt-totals-left">
                    <div className="qt-field-inline">
                      <label>Discount (₹)</label>
                      <input type="number" min="0" step="1" value={formData.discount} onChange={e => setFormData(f => ({ ...f, discount: e.target.value }))} />
                    </div>
                    <div className="qt-field-inline">
                      <label>GST (%)</label>
                      <input type="number" min="0" max="100" step="0.5" value={formData.tax} onChange={e => setFormData(f => ({ ...f, tax: e.target.value }))} />
                    </div>
                  </div>
                  <div className="qt-totals-right">
                    <div className="qt-total-row"><span>Subtotal</span><span>₹{fmt(totals.subtotal)}</span></div>
                    {Number(formData.discount) > 0 && <div className="qt-total-row discount"><span>Discount</span><span>− ₹{fmt(formData.discount)}</span></div>}
                    {Number(formData.tax) > 0 && <div className="qt-total-row"><span>GST ({formData.tax}%)</span><span>₹{fmt(totals.gstAmt)}</span></div>}
                    <div className="qt-total-row grand"><span>Total</span><span>₹{fmt(totals.total)}</span></div>
                  </div>
                </div>
              </div>

              {/* Notes & Terms */}
              <div className="qt-form-section">
                <div className="qt-section-title">Notes &amp; Terms</div>
                <div className="qt-form-grid">
                  <div className="qt-field full">
                    <label>Notes (visible to client)</label>
                    <textarea rows={3} value={formData.notes} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))} placeholder="Any special notes for the client..." />
                  </div>
                  <div className="qt-field full">
                    <label>Terms &amp; Conditions</label>
                    <textarea rows={7} value={formData.terms} onChange={e => setFormData(f => ({ ...f, terms: e.target.value }))} placeholder="Select a service category above to auto-fill standard terms, or type custom terms here..." />
                    {formData.serviceCategory && DEFAULT_TERMS[formData.serviceCategory] && (
                      <span style={{fontSize:"11px",color:"#1d4ed8",marginTop:3,cursor:"pointer",userSelect:"none"}}
                        onClick={() => setFormData(f => ({ ...f, terms: DEFAULT_TERMS[f.serviceCategory] }))}>
                        Reset to default terms for "{formData.serviceCategory}"
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="qt-form-footer">
              <button type="button" className="qt-btn-ghost" onClick={backToList}>Cancel</button>
              <button type="submit" className="qt-btn-prim" disabled={saving || sending}>
                {saving ? <RefreshCcw size={14} className="qt-spin" /> : <CheckCircle2 size={14} />}
                {saving ? "Saving..." : editingId ? "Update Quotation" : "Create Quotation"}
              </button>
              <button
                type="button"
                className="qt-btn-prim"
                disabled={saving || sending}
                onClick={handleSaveAndSend}
                title="Save the quotation and email it to the client (CC to your email)"
                style={{ background: "#2563eb" }}
              >
                {sending ? <RefreshCcw size={14} className="qt-spin" /> : <Send size={14} />}
                {sending ? "Sending..." : saving ? "Saving..." : "Save & Send Mail"}
              </button>
            </div>
          </form>
        )}

        {/* ══ VIEW MODE ══ */}
        {mode === "view" && viewing && (
          <div className="qt-view-enterprise">

            {/* Workflow Bar */}
            <div className="qt-workflow-bar">
              <div className="qt-workflow-status">
                <span className={`qt-status qt-st-${sm(viewing.status).color}`}>{sm(viewing.status).label}</span>
                {viewing.isRevision && <span className="qt-rev-badge">Revision {viewing.revisionNumber}</span>}
              </div>
              <div className="qt-workflow-actions">
                {/* Send email — prominent primary action */}
                <button
                  className="qt-wf-btn primary"
                  disabled={sending}
                  onClick={() => {
                    if (!viewing.clientEmail) {
                      toast.error("Client email is missing — add it via Edit before sending.");
                      openEdit(viewing);
                      return;
                    }
                    handleSendEmail(viewing._id);
                  }}
                  title={viewing.clientEmail
                    ? `Send to ${viewing.clientEmail}${viewing.senderEmail ? ` (CC: ${viewing.senderEmail})` : ""}`
                    : "Client email missing — opens edit form"}
                >
                  <Send size={14} /> {sending
                    ? "Sending..."
                    : (viewing.status === "draft" ? "Send Email to Client" : "Resend Email to Client")}
                </button>
                {/* Status transitions */}
                {viewing.status === "sent" && (
                  <>
                    <button className="qt-wf-btn amber" onClick={() => handleStatusChange(viewing._id, "under_negotiation")}>
                      <MessageSquare size={13} /> Under Negotiation
                    </button>
                    <button className="qt-wf-btn green" onClick={() => handleStatusChange(viewing._id, "approved")}>
                      <CheckCircle2 size={13} /> Approve
                    </button>
                    <button className="qt-wf-btn red" onClick={() => handleStatusChange(viewing._id, "rejected")}>
                      <XCircle size={13} /> Reject
                    </button>
                  </>
                )}
                {viewing.status === "under_negotiation" && (
                  <>
                    <button className="qt-wf-btn green" onClick={() => handleStatusChange(viewing._id, "approved")}>
                      <CheckCircle2 size={13} /> Approve
                    </button>
                    <button className="qt-wf-btn red" onClick={() => handleStatusChange(viewing._id, "rejected")}>
                      <XCircle size={13} /> Reject
                    </button>
                    <button className="qt-wf-btn purple" onClick={() => { setRevFormData({ ...viewing, lineItems: [...viewing.lineItems] }); setShowRevisionForm(true); }}>
                      <GitBranch size={13} /> Create Revision
                    </button>
                  </>
                )}
                {viewing.status === "approved" && (
                  <>
                    <button className="qt-wf-btn indigo" onClick={() => handleStatusChange(viewing._id, "final")}>
                      <TrendingUp size={13} /> Mark as Final
                    </button>
                    <button className="qt-wf-btn teal" onClick={() => setShowConvertForm(true)}>
                      <Receipt size={13} /> Convert to Proforma
                    </button>
                  </>
                )}
                {viewing.status === "final" && (
                  <button className="qt-wf-btn teal" onClick={() => setShowConvertForm(true)}>
                    <Receipt size={13} /> Convert to Proforma
                  </button>
                )}
                {viewing.status === "converted" && viewing.proformaId && (
                  <button className="qt-wf-btn teal" onClick={() => openProformaFromQuotation(viewing.proformaId)}>
                    <Receipt size={13} /> View Proforma Invoice
                  </button>
                )}
                {(viewing.status === "rejected" || viewing.status === "sent") && (
                  <button className="qt-wf-btn purple" onClick={() => { setRevFormData({ ...viewing, lineItems: [...viewing.lineItems] }); setShowRevisionForm(true); }}>
                    <GitBranch size={13} /> Create Revision
                  </button>
                )}
                <button className="qt-wf-btn gray" onClick={() => openEdit(viewing)}>
                  <Edit2 size={13} /> Edit
                </button>
              </div>
            </div>

            <div className="qt-view-enterprise-body">
              {/* Document Preview */}
              <div className="qt-doc-wrap" ref={pdfRef}>
                <QuotationDocument q={viewing} />
              </div>

              {/* Right Panel */}
              <div className="qt-side-panel">

                {/* Negotiation History */}
                <div className="qt-panel-card">
                  <div className="qt-panel-title"><MessageSquare size={14} /> Negotiation History</div>
                  {(viewing.negotiationHistory || []).length === 0 ? (
                    <div className="qt-panel-empty">No activity yet</div>
                  ) : (
                    <div className="qt-neg-list">
                      {[...viewing.negotiationHistory].reverse().map((entry, i) => (
                        <div key={i} className={`qt-neg-item ${entry.type}`}>
                          <div className="qt-neg-note">{entry.note}</div>
                          <div className="qt-neg-meta">{entry.by} · {fmtDate(entry.at)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="qt-neg-add">
                    <textarea
                      rows={3}
                      placeholder="Type your note here and click Add Note..."
                      value={negotiationNote}
                      onInput={e => setNegotiationNote(e.target.value)}
                      onChange={e => setNegotiationNote(e.target.value)}
                      style={{ minHeight: 64 }}
                    />
                    <button
                      className="qt-wf-btn blue"
                      disabled={addingNote || !negotiationNote.trim()}
                      onClick={e => { e.preventDefault(); e.stopPropagation(); handleAddNote(); }}
                    >
                      {addingNote ? <RefreshCcw size={12} className="qt-spin" /> : <Plus size={12} />} Add Note
                    </button>
                  </div>
                </div>

                {/* Meta info */}
                <div className="qt-panel-card">
                  <div className="qt-panel-title"><FileText size={14} /> Details</div>
                  <div className="qt-panel-meta">
                    <div><span>Branch</span><span>{viewing.branch}</span></div>
                    {viewing.senderEmail && <div><span>Reply-To</span><span>{viewing.senderEmail}</span></div>}
                    <div><span>Created by</span><span>{viewing.createdBy}</span></div>
                    <div><span>Created</span><span>{fmtDate(viewing.createdAt)}</span></div>
                    {viewing.sentAt     && <div><span>Sent</span><span>{fmtDate(viewing.sentAt)}</span></div>}
                    {viewing.approvedAt && <div><span>Approved</span><span>{fmtDate(viewing.approvedAt)}</span></div>}
                    {viewing.rejectedAt && <div><span>Rejected</span><span>{fmtDate(viewing.rejectedAt)}</span></div>}
                    {viewing.convertedAt && <div><span>Converted</span><span>{fmtDate(viewing.convertedAt)}</span></div>}
                    {viewing.validUntil && <div><span>Valid Until</span><span>{fmtDate(viewing.validUntil)}</span></div>}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Revision Form Modal ── */}
            {showRevisionForm && revFormData && (
              <div className="qt-modal-overlay" onClick={() => setShowRevisionForm(false)}>
                <div className="qt-modal" onClick={e => e.stopPropagation()}>
                  <div className="qt-modal-header">
                    <span><GitBranch size={15} /> Create Revision</span>
                    <button onClick={() => setShowRevisionForm(false)}>✕</button>
                  </div>
                  <div className="qt-modal-body">
                    <p className="qt-modal-hint">Adjust any line items or pricing for the revision. All other client details will be carried over.</p>
                    <div className="qt-items-table-wrap">
                      <table className="qt-items-table">
                        <thead>
                          <tr><th>Description</th><th>Qty</th><th>Rate (₹)</th><th>Amount (₹)</th></tr>
                        </thead>
                        <tbody>
                          {(revFormData.lineItems || []).map((item, idx) => (
                            <tr key={idx}>
                              <td><input className="qt-item-input" value={item.description}
                                onChange={e => {
                                  const items = [...revFormData.lineItems];
                                  items[idx] = { ...items[idx], description: e.target.value };
                                  setRevFormData(f => ({ ...f, lineItems: items }));
                                }} /></td>
                              <td><input className="qt-item-input num" type="number" value={item.qty}
                                onChange={e => {
                                  const items = [...revFormData.lineItems];
                                  items[idx] = { ...items[idx], qty: Number(e.target.value), amount: Number(e.target.value) * Number(items[idx].rate) };
                                  setRevFormData(f => ({ ...f, lineItems: items }));
                                }} /></td>
                              <td><input className="qt-item-input num" type="number" value={item.rate}
                                onChange={e => {
                                  const items = [...revFormData.lineItems];
                                  items[idx] = { ...items[idx], rate: Number(e.target.value), amount: Number(items[idx].qty) * Number(e.target.value) };
                                  setRevFormData(f => ({ ...f, lineItems: items }));
                                }} /></td>
                              <td><span className="qt-item-amount">₹{fmt(item.amount)}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="qt-modal-totals">
                      <div className="qt-field-inline">
                        <label>Discount (₹)</label>
                        <input type="number" value={revFormData.discount} onChange={e => setRevFormData(f => ({ ...f, discount: Number(e.target.value) }))} />
                      </div>
                      <div className="qt-field-inline">
                        <label>GST (%)</label>
                        <input type="number" value={revFormData.tax} onChange={e => setRevFormData(f => ({ ...f, tax: Number(e.target.value) }))} />
                      </div>
                    </div>
                    <div className="qt-field" style={{ marginTop: 12 }}>
                      <label>Notes (optional)</label>
                      <textarea rows={2} value={revFormData.notes || ""} onChange={e => setRevFormData(f => ({ ...f, notes: e.target.value }))} />
                    </div>
                  </div>
                  <div className="qt-modal-footer">
                    <button className="qt-btn-ghost" onClick={() => setShowRevisionForm(false)}>Cancel</button>
                    <button className="qt-btn-prim" disabled={saving} onClick={handleCreateRevision}>
                      {saving ? <RefreshCcw size={13} className="qt-spin" /> : <GitBranch size={13} />}
                      {saving ? "Creating..." : "Create Revision"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Convert to Proforma Modal ── */}
            {showConvertForm && (
              <div className="qt-modal-overlay" onClick={() => setShowConvertForm(false)}>
                <div className="qt-modal" onClick={e => e.stopPropagation()}>
                  <div className="qt-modal-header">
                    <span><Receipt size={15} /> Convert to Proforma Invoice</span>
                    <button onClick={() => setShowConvertForm(false)}>✕</button>
                  </div>
                  <div className="qt-modal-body">
                    <p className="qt-modal-hint">A Proforma Invoice will be created from <strong>{viewing.quoteNumber}</strong> with all line items and pricing.</p>
                    <div className="qt-form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                      <div className="qt-field">
                        <label>Delivery Date</label>
                        <input type="date" value={convertData.deliveryDate}
                          onChange={e => setConvertData(f => ({ ...f, deliveryDate: e.target.value }))} />
                      </div>
                      <div className="qt-field">
                        <label>Payment Terms</label>
                        <input value={convertData.paymentTerms}
                          onChange={e => setConvertData(f => ({ ...f, paymentTerms: e.target.value }))}
                          placeholder="e.g. 50% advance, 50% on delivery" />
                      </div>
                    </div>
                  </div>
                  <div className="qt-modal-footer">
                    <button className="qt-btn-ghost" onClick={() => setShowConvertForm(false)}>Cancel</button>
                    <button className="qt-btn-teal" disabled={converting} onClick={handleConvertToProforma}>
                      {converting ? <RefreshCcw size={13} className="qt-spin" /> : <Receipt size={13} />}
                      {converting ? "Converting..." : "Create Proforma Invoice"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ PROFORMA VIEW MODE ══ */}
        {mode === "proforma-view" && viewingProforma && (
          <div className="qt-view-enterprise">
            <div className="qt-workflow-bar">
              <div className="qt-workflow-status">
                <span className={`qt-status qt-st-${PI_STATUS_META[viewingProforma.status]?.color || "gray"}`}>
                  {PI_STATUS_META[viewingProforma.status]?.label || viewingProforma.status}
                </span>
                <span className="qt-pi-ref">From: {viewingProforma.quoteNumber}</span>
              </div>
              <div className="qt-workflow-actions">
                {viewingProforma.clientEmail && viewingProforma.status === "draft" && (
                  <button className="qt-wf-btn blue" disabled={sending} onClick={() => handleSendProformaEmail(viewingProforma._id)}>
                    <Send size={13} /> {sending ? "Sending..." : "Send to Client"}
                  </button>
                )}
              </div>
            </div>

            <div className="qt-view-enterprise-body">
              <div className="qt-doc-wrap">
                <QuotationDocument q={viewingProforma} isProforma />
              </div>
              <div className="qt-side-panel">
                <div className="qt-panel-card">
                  <div className="qt-panel-title"><Receipt size={14} /> Proforma Details</div>
                  <div className="qt-panel-meta">
                    <div><span>Number</span><span>{viewingProforma.proformaNumber}</span></div>
                    <div><span>Branch</span><span>{viewingProforma.branch}</span></div>
                    <div><span>Created by</span><span>{viewingProforma.createdBy}</span></div>
                    <div><span>Created</span><span>{fmtDate(viewingProforma.createdAt)}</span></div>
                    {viewingProforma.deliveryDate && <div><span>Delivery</span><span>{fmtDate(viewingProforma.deliveryDate)}</span></div>}
                    {viewingProforma.paymentTerms && <div><span>Payment</span><span>{viewingProforma.paymentTerms}</span></div>}
                    {viewingProforma.sentAt && <div><span>Sent</span><span>{fmtDate(viewingProforma.sentAt)}</span></div>}
                    {viewingProforma.paidAt && <div><span>Paid</span><span>{fmtDate(viewingProforma.paidAt)}</span></div>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
