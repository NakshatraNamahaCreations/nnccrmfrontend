import { GST_RATES, calcGst, inr } from "./gst";

const btn = (active) => ({
  flex: 1, padding: "8px 0", borderRadius: 8, border: "1.5px solid",
  borderColor: active ? "#2563eb" : "#d1d5db",
  background: active ? "#eff6ff" : "#fff",
  color: active ? "#2563eb" : "#6b7280",
  fontWeight: 600, fontSize: 13, cursor: "pointer",
});

/**
 * With / Without GST toggle + rate + live breakdown, shown right under
 * the "Total Amount Agreed" field. `onChange(patch)` receives
 * { gstApplicable } or { gstRate }.
 */
export default function GstPicker({ value, gstApplicable, gstRate, onChange }) {
  const { base, gst, total } = calcGst(value, gstApplicable, gstRate);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" style={btn(gstApplicable)} onClick={() => onChange({ gstApplicable: true })}>With GST</button>
        <button type="button" style={btn(!gstApplicable)} onClick={() => onChange({ gstApplicable: false })}>Without GST</button>
        {gstApplicable && (
          <select
            value={gstRate}
            onChange={e => onChange({ gstRate: Number(e.target.value) })}
            style={{ width: 90, borderRadius: 8 }}
            aria-label="GST rate"
          >
            {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
          </select>
        )}
      </div>

      {base > 0 && (
        <div style={{
          display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 14px",
          padding: "8px 12px", borderRadius: 8, fontSize: 13,
          background: gstApplicable ? "#eff6ff" : "#f8fafc",
          border: `1px solid ${gstApplicable ? "#bfdbfe" : "#e2e8f0"}`, color: "#475569",
        }}>
          <span>Amount: <strong style={{ color: "#0f172a" }}>{inr(base)}</strong></span>
          {gstApplicable && <span>+ GST {gstRate}%: <strong style={{ color: "#0f172a" }}>{inr(gst)}</strong></span>}
          <span style={{ marginLeft: "auto" }}>
            Total{gstApplicable ? " (incl. GST)" : ""}: <strong style={{ color: "#1d4ed8", fontSize: 15 }}>{inr(total)}</strong>
          </span>
        </div>
      )}
    </div>
  );
}
