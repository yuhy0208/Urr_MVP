import React from 'react';
import { useState, useEffect, useRef } from "react";
import emailjs from "@emailjs/browser";

// ── Google Sheets 백엔드 ── Apps Script Web App URL을 아래에 붙여넣으세요 ──
const SHEETS_URL = "https://script.google.com/macros/s/AKfycbxBgELxHabH2lyJOTLbY5K_xrFDdDkZhV3HRsQ3Ggg1z4soYlzW3gVco1PvvPbfoji2/exec";

// ── EMAILJS 설정 ── 아래 세 값을 본인 EmailJS 계정 정보로 교체하세요 ──
const EMAILJS_PUBLIC_KEY  = "qQQntQDNrotH_Vubi";
const EMAILJS_SERVICE_ID  = "service_f4bk12x";
const EMAILJS_TEMPLATE_ID = "template_lxjp9qn";
import {
  Calendar, Users, ChevronLeft, X, Star, Plus, Minus,
  CheckCircle, Trash2, MapPin, Clock, ShoppingCart, Search
} from "lucide-react";

// ── TIME SLOTS: 17:00 ~ 04:45 (48 slots, 15-min intervals) ──────
const SLOTS = (() => {
  const s = [];
  for (let h = 17; h <= 23; h++) for (let m = 0; m < 60; m += 15)
    s.push(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`);
  for (let h = 0; h <= 4; h++) for (let m = 0; m < 60; m += 15)
    s.push(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`);
  return s;
})();

// ── BASE AVAILABILITY: 모든 슬롯 = 최대 수용인원 ───────────────
const makeAvail = (cap) => {
  const out = {};
  SLOTS.forEach(sl => { out[sl] = cap; });
  return out;
};

// ── BAR DATA ─────────────────────────────────────────────────────
const BARS_RAW = [
  { id:1, name:"달빛 포차", emoji:"🏮", rating:4.8, reviews:347,
    addr:"대학로 12-3번길 · 도보 2분", cap:80,
    desc:"넉넉한 단체석 · 주차 가능 · 노래방 연계",
    menu:[
      {id:"a1",name:"국내산 삼겹살",price:18000,desc:"200g + 쌈채소",emoji:"🥩"},
      {id:"a2",name:"닭갈비 2인분",price:26000,desc:"매콤 춘천식",emoji:"🍗"},
      {id:"a3",name:"해물파전",price:16000,desc:"통통한 해물",emoji:"🥞"},
      {id:"a4",name:"소주",price:5000,desc:"참이슬/처음처럼",emoji:"🍶"},
      {id:"a5",name:"생맥주 500ml",price:6000,desc:"시원한 생맥주",emoji:"🍺"},
      {id:"a6",name:"막걸리 세트",price:14000,desc:"2병 + 도토리묵",emoji:"🫗"},
    ]},
  { id:2, name:"이자카야 하나", emoji:"🍱", rating:4.6, reviews:218,
    addr:"홍대입구역 3번출구 · 50m", cap:50,
    desc:"프라이빗 룸 완비 · 정통 일식 안주",
    menu:[
      {id:"b1",name:"야키토리 세트",price:22000,desc:"닭꼬치 8종 모둠",emoji:"🍢"},
      {id:"b2",name:"사시미 모둠",price:35000,desc:"제철 생선 7종",emoji:"🍣"},
      {id:"b3",name:"에비텐동",price:18000,desc:"새우튀김 덮밥",emoji:"🍤"},
      {id:"b4",name:"아사히 생맥주",price:7000,desc:"500ml",emoji:"🍺"},
      {id:"b5",name:"사케 720ml",price:35000,desc:"순수 쌀 정종",emoji:"🍶"},
      {id:"b6",name:"하이볼",price:9000,desc:"위스키 하이볼",emoji:"🥃"},
    ]},
  { id:3, name:"치맥 천국", emoji:"🍗", rating:4.5, reviews:512,
    addr:"신촌 로터리 · 도보 1분", cap:100,
    desc:"대형 단체석 100인 · 치킨+맥주 특화",
    menu:[
      {id:"c1",name:"후라이드 치킨",price:20000,desc:"바삭한 황금치킨",emoji:"🍗"},
      {id:"c2",name:"양념 치킨",price:21000,desc:"달콤매콤 양념",emoji:"🍗"},
      {id:"c3",name:"반반 치킨",price:22000,desc:"후라이드+양념",emoji:"🍗"},
      {id:"c4",name:"생맥주 500ml",price:5000,desc:"카스 생맥주",emoji:"🍺"},
      {id:"c5",name:"피처 맥주 3L",price:22000,desc:"테이블 공유용",emoji:"🍺"},
      {id:"c6",name:"감자튀김",price:8000,desc:"바삭한 웨지감자",emoji:"🍟"},
    ]},
  { id:4, name:"루프탑 비어가든", emoji:"🌙", rating:4.9, reviews:89,
    addr:"건대입구역 · 도보 5분", cap:40,
    desc:"야외 루프탑 · 도심 야경 · 수제맥주 전문",
    menu:[
      {id:"d1",name:"수제맥주 테이스팅",price:28000,desc:"4종 테이스팅",emoji:"🍻"},
      {id:"d2",name:"소시지 플래터",price:32000,desc:"독일식 5종",emoji:"🌭"},
      {id:"d3",name:"화덕 피자 32cm",price:28000,desc:"마르게리타",emoji:"🍕"},
      {id:"d4",name:"생맥주 파인트",price:8000,desc:"570ml",emoji:"🍺"},
      {id:"d5",name:"칵테일 피처",price:35000,desc:"상그리아/모히또",emoji:"🍹"},
      {id:"d6",name:"치즈 보드",price:24000,desc:"3종 + 크래커",emoji:"🧀"},
    ]},
];
const BARS = BARS_RAW.map((b) => ({ ...b, avail: makeAvail(b.cap) }));

// ── UTILS ────────────────────────────────────────────────────────
const fmt = (n) => n.toLocaleString("ko-KR") + "원";
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const slotColor = (avail, cap, need) => {
  if (avail === 0 || (need > 0 && avail < need)) return { bg: "#e2e8f0", disabled: true };
  const r = avail / cap;
  if (r > 0.6) return { bg: "#1d4ed8", disabled: false };
  if (r > 0.4) return { bg: "#3b82f6", disabled: false };
  if (r > 0.2) return { bg: "#93c5fd", disabled: false };
  return { bg: "#bfdbfe", disabled: false };
};

// ── TIMETABLE ────────────────────────────────────────────────────
const SW = 16; // slot width px
const SH = 42; // slot height px

function Timetable({ bar, need, sel, onSlot, avail: avOverride }) {
  const avail = avOverride || bar.avail;
  const [tapped, setTapped] = useState(null);

  const si = sel.start ? SLOTS.indexOf(sel.start) : -1;
  const ei = sel.end   ? SLOTS.indexOf(sel.end)   : -1;
  const inRange = (i) => si >= 0 && (ei < 0 ? i === si : i >= si && i <= ei);

  const hourLabels = SLOTS.reduce((acc, sl, i) => {
    if (sl.endsWith(":00")) acc.push({ label: sl.substring(0, 5), left: i * SW });
    return acc;
  }, []);

  const handleTap = (sl, c) => {
    setTapped(sl);
    if (!c.disabled) onSlot(sl);
  };

  const tappedAvail = tapped ? (avail[tapped] ?? 0) : null;
  const tappedDisabled = tapped ? slotColor(tappedAvail, bar.cap, need).disabled : false;

  return (
    <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <div style={{ width: SLOTS.length * SW, position: "relative" }}>
        {/* Hour labels */}
        <div style={{ position: "relative", height: 16, marginBottom: 3 }}>
          {hourLabels.map(({ label, left }) => (
            <span key={label} style={{
              position: "absolute", left, fontSize: 9, color: "#64748b",
              fontWeight: 700, whiteSpace: "nowrap", letterSpacing: "-0.3px"
            }}>{label}</span>
          ))}
        </div>

        {/* Slot strip — all divs tappable so mobile can check any slot's availability */}
        <div style={{ display: "flex" }}>
          {SLOTS.map((sl, i) => {
            const slotAvail = avail[sl] ?? 0;
            const c = slotColor(slotAvail, bar.cap, need);
            const selected = inRange(i);
            const isTapped = tapped === sl;
            const isHour = sl.endsWith(":00");
            return (
              <div
                key={sl}
                role="button"
                onClick={() => handleTap(sl, c)}
                style={{
                  width: SW, height: SH, flexShrink: 0,
                  backgroundColor: selected ? "#f59e0b" : c.bg,
                  borderLeft: isHour ? "1px solid rgba(0,0,0,0.18)" : "none",
                  outline: selected ? "2px solid #d97706" : isTapped ? "2px solid rgba(0,0,0,0.25)" : "none",
                  outlineOffset: "-2px",
                  cursor: c.disabled ? "default" : "pointer",
                  transition: "background-color 0.08s",
                  userSelect: "none",
                  WebkitTapHighlightColor: "transparent",
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Tap info bar — always rendered below the scroll area, outside the wide div */}
      <div style={{
        marginTop: 8, minHeight: 28, display: "flex", alignItems: "center",
        justifyContent: "space-between"
      }}>
        {/* Availability info */}
        {(() => {
          if (sel.start && sel.end) {
            const rsi = SLOTS.indexOf(sel.start), rei = SLOTS.indexOf(sel.end);
            const minAvail = Math.min(...SLOTS.slice(rsi, rei + 1).map(s => avail[s] ?? 0));
            const ok = need > 0 ? need <= minAvail : true;
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 20, background: ok ? "#eff6ff" : "#fff1f2", border: `1px solid ${ok ? "#bfdbfe" : "#fecdd3"}` }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: ok ? "#1d4ed8" : "#e11d48" }}>{sel.start} ~ {sel.end}</span>
                <span style={{ fontSize: 10, color: "#94a3b8" }}>|</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: ok ? "#1d4ed8" : "#e11d48" }}>최대 {minAvail}명 예약 가능</span>
                {need > 0 && <span style={{ fontSize: 10, fontWeight: 600, color: ok ? "#22c55e" : "#f43f5e" }}>{ok ? `✓ ${need}인 가능` : `${need}인 불가`}</span>}
              </div>
            );
          }
          if (tapped) {
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 20, background: tappedDisabled ? "#f1f5f9" : "#eff6ff", border: `1px solid ${tappedDisabled ? "#e2e8f0" : "#bfdbfe"}` }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: tappedDisabled ? "#94a3b8" : "#1d4ed8" }}>{tapped}</span>
                <span style={{ fontSize: 10, color: "#94a3b8" }}>|</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: tappedDisabled ? "#94a3b8" : "#1d4ed8" }}>잔여 {tappedAvail}석</span>
                {need > 0 && <span style={{ fontSize: 10, fontWeight: 600, color: tappedDisabled ? "#f87171" : "#22c55e" }}>{tappedDisabled ? `(${need}인 부족)` : `(${need}인 가능)`}</span>}
              </div>
            );
          }
          return <div style={{ fontSize: 11, color: "#94a3b8", paddingLeft: 2 }}>👆 슬롯을 탭하면 잔여석을 확인할 수 있어요</div>;
        })()}

        {/* Legend */}
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {[["#1d4ed8","여유"],["#93c5fd","보통"],["#e2e8f0","마감"]].map(([bg, label]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "#64748b" }}>
              <div style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: bg, border: "1px solid rgba(0,0,0,0.08)" }} />
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── BAR CARD ─────────────────────────────────────────────────────
function BarCard({ bar, need, sel, onSlot, onBook, onClear, effectiveAvail }) {
  const cardRef = useRef(null);
  const label = sel.start
    ? sel.end ? `${sel.start} ~ ${sel.end}` : `${sel.start} → 종료 시간을 선택해주세요`
    : null;

  useEffect(() => {
    if (!sel.start) return;
    const handler = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)) onClear();
    };
    document.addEventListener("mousedown", handler, true);
    document.addEventListener("touchstart", handler, true);
    return () => {
      document.removeEventListener("mousedown", handler, true);
      document.removeEventListener("touchstart", handler, true);
    };
  }, [sel.start]);

  return (
    <div ref={cardRef} style={{
      background: "white", borderRadius: 18,
      boxShadow: "0 1px 6px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)",
      overflow: "hidden"
    }}>
      {/* Header */}
      <div style={{ padding: "16px 16px 10px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 46, height: 46, background: "linear-gradient(135deg,#eff6ff,#dbeafe)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
              {bar.emoji}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a", letterSpacing: "-0.3px" }}>{bar.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 2 }}>
                <span style={{ fontSize: 12, color: "#fbbf24" }}>★</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{bar.rating}</span>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>({bar.reviews})</span>
              </div>
            </div>
          </div>
          <span style={{ fontSize: 11, background: "#eff6ff", color: "#1d4ed8", padding: "4px 10px", borderRadius: 20, fontWeight: 700, flexShrink: 0 }}>
            최대 {bar.cap}인
          </span>
        </div>
        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>📍 {bar.addr}</div>
        <div style={{ fontSize: 11, color: "#94a3b8" }}>{bar.desc}</div>
      </div>

      {/* Timetable */}
      <div style={{ padding: "0 16px 10px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
          ⏰ 시간대별 잔여석 &nbsp;<span style={{ fontWeight: 400, color: "#94a3b8" }}>클릭: 시작 → 종료 순으로 선택</span>
        </div>
        <Timetable bar={bar} need={need} sel={sel} onSlot={onSlot} avail={effectiveAvail} />
        {label && (
          <div style={{
            marginTop: 8, padding: "7px 12px", borderRadius: 10,
            background: sel.end ? "#eff6ff" : "#fffbeb",
            border: `1px solid ${sel.end ? "#bfdbfe" : "#fde68a"}`,
            display: "flex", alignItems: "center", gap: 6
          }}>
            <Clock size={13} color={sel.end ? "#1d4ed8" : "#d97706"} />
            <span style={{ fontSize: 12, fontWeight: 700, color: sel.end ? "#1d4ed8" : "#d97706" }}>{label}</span>
          </div>
        )}
      </div>

      {/* CTA */}
      <div style={{ padding: "0 16px 16px" }}>
        <button
          onClick={onBook}
          style={{
            width: "100%", padding: "13px", borderRadius: 13, border: "none",
            background: sel.end ? "linear-gradient(135deg,#1d4ed8,#2563eb)" : "#f1f5f9",
            color: sel.end ? "white" : "#94a3b8",
            fontWeight: 800, fontSize: 14, cursor: sel.end ? "pointer" : "default",
            letterSpacing: "-0.2px", transition: "opacity 0.1s",
          }}
        >
          {sel.end ? "🎉 메뉴 보기 / 예약하기" : "시간대를 먼저 선택해주세요"}
        </button>
      </div>
    </div>
  );
}

// ── MENU SCREEN ──────────────────────────────────────────────────
function MenuScreen({ bar, cart, add, remove, total, count, onBack, onNext, sel, need, setNeed, onSlotClick, date, setDate, effectiveAvail }) {
  const needNum = parseInt(need, 10) || 0;
  const [open, setOpen] = useState(!needNum); // 인원 미설정이면 자동으로 열기
  const timeLabel = sel.start && sel.end ? `${sel.start} ~ ${sel.end}` : sel.start ? `${sel.start} ~` : "시간 미선택";
  const timeOk = !!(sel.start && sel.end);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#f8fafc" }}>
      {/* Header */}
      <div style={{ background: "white", borderBottom: "1px solid #f1f5f9", flexShrink: 0 }}>
        <div style={{ maxWidth: 448, margin: "0 auto", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: "#f8fafc", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ChevronLeft size={20} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>{bar.emoji} {bar.name}</div>
            <div style={{ fontSize: 11, color: timeOk ? "#1d4ed8" : "#f59e0b" }}>{date} · {need ? `${need}명` : "인원 미설정"} · {timeLabel}</div>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px", paddingBottom: 90 }}>
        <div style={{ maxWidth: 448, margin: "0 auto" }}>

          {/* ── 예약 조건 편집 패널 ── */}
          <div style={{ marginBottom: 14, background: "white", borderRadius: 16, border: "1.5px solid #e2e8f0", overflow: "hidden" }}>
            <button
              onClick={() => setOpen(p => !p)}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", border: "none", background: "transparent", cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 14 }}>⚙️</span>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>예약 조건 설정</div>
                  <div style={{ fontSize: 11, color: timeOk ? "#1d4ed8" : "#f59e0b", marginTop: 1 }}>
                    {timeOk ? `${timeLabel}${need ? ` · ${need}명` : ""}` : "시간대를 선택해주세요"}
                  </div>
                </div>
              </div>
              <span style={{ fontSize: 11, color: "#3b82f6", fontWeight: 700 }}>{open ? "접기 ▲" : "수정 ▼"}</span>
            </button>

            {open && (
              <div style={{ borderTop: "1px solid #f1f5f9", padding: "14px 14px 10px" }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 7, background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 11, padding: "9px 11px" }}>
                    <Calendar size={13} color="#3b82f6" />
                    <input type="date" value={date} onChange={e => setDate(e.target.value)}
                      style={{ flex: 1, background: "transparent", border: "none", fontSize: 12, outline: "none", color: "#374151", minWidth: 0 }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 11, padding: "9px 11px", width: 100 }}>
                    <Users size={13} color="#3b82f6" />
                    <input type="number" value={need} min="1" placeholder="인원" onChange={e => setNeed(e.target.value)}
                      style={{ width: "100%", background: "transparent", border: "none", fontSize: 12, outline: "none", color: "#374151" }} />
                  </div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
                  ⏰ 시간대 선택 <span style={{ fontWeight: 400, color: "#94a3b8" }}>시작 → 종료 순으로 탭</span>
                </div>
                <Timetable bar={bar} need={needNum} sel={sel} onSlot={onSlotClick} avail={effectiveAvail} />
              </div>
            )}
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 12 }}>
            메뉴를 선택해주세요 <span style={{ fontWeight: 400, color: "#94a3b8" }}>(선택 안 해도 예약 가능)</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {bar.menu.map(item => {
              const qty = cart[item.id] || 0;
              return (
                <div key={item.id} style={{
                  background: "white", borderRadius: 14, padding: "12px 14px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.05)", border: qty > 0 ? "1.5px solid #bfdbfe" : "1px solid #f1f5f9",
                  display: "flex", alignItems: "center", justifyContent: "space-between"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 26 }}>{item.emoji}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{item.desc}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#1d4ed8", marginTop: 4 }}>{fmt(item.price)}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {qty > 0 && (
                      <button onClick={() => remove(item.id)} style={{ width: 30, height: 30, borderRadius: "50%", background: "#eff6ff", color: "#1d4ed8", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Minus size={14} />
                      </button>
                    )}
                    {qty > 0 && <span style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", minWidth: 20, textAlign: "center" }}>{qty}</span>}
                    <button onClick={() => add(item.id)} style={{ width: 30, height: 30, borderRadius: "50%", background: "#1d4ed8", color: "white", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ background: "white", borderTop: "1px solid #f1f5f9", padding: "12px 16px", flexShrink: 0 }}>
        <div style={{ maxWidth: 448, margin: "0 auto" }}>
          {!needNum && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, padding: "8px 12px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10 }}>
              <span style={{ fontSize: 13 }}>⚠️</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#d97706" }}>예약 조건에서 인원수를 먼저 입력해주세요</span>
            </div>
          )}
          {needNum > 0 && count > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b", marginBottom: 8 }}>
              <span>{count}개 항목 선택</span>
              <span style={{ fontWeight: 700, color: "#1d4ed8" }}>{fmt(total)}</span>
            </div>
          )}
          <button
            onClick={() => { if (!needNum) { setOpen(true); return; } onNext(); }}
            style={{ width: "100%", padding: "14px", borderRadius: 13, background: needNum ? "linear-gradient(135deg,#1d4ed8,#2563eb)" : "#f1f5f9", color: needNum ? "white" : "#94a3b8", fontWeight: 800, fontSize: 14, border: "none", cursor: "pointer" }}
          >
            {!needNum ? "인원수를 입력해주세요" : count > 0 ? `다음 → 정보 입력 (${fmt(total)})` : "메뉴 없이 계속하기 →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── FORM SCREEN ──────────────────────────────────────────────────
function FormScreen({ bar, form, setForm, onBack, onSubmit, sel, need, date, cart, total, errMsg }) {
  const fields = [
    { key: "groupName",   label: "단체명 *",       ph: "예: 컴퓨터공학과 MT", type: "text" },
    { key: "managerName", label: "담당자 이름 *",   ph: "예: 홍길동",           type: "text" },
    { key: "phone",       label: "연락처 *",        ph: "예: 010-1234-5678",    type: "tel"  },
  ];
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#f8fafc" }}>
      <div style={{ background: "white", borderBottom: "1px solid #f1f5f9", flexShrink: 0 }}>
        <div style={{ maxWidth: 448, margin: "0 auto", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: "#f8fafc", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ChevronLeft size={20} />
          </button>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>예약 정보 입력</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>{bar.emoji} {bar.name}</div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px", paddingBottom: 90 }}>
        <div style={{ maxWidth: 448, margin: "0 auto" }}>
          {/* Summary */}
          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 14, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#1d4ed8", marginBottom: 8 }}>📋 예약 요약</div>
            {[["날짜", date], ["시간", `${sel.start} ~ ${sel.end}`], ["인원", `${need}명`]].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#1e40af", marginBottom: 4 }}>
                <span>{k}</span><span style={{ fontWeight: 700 }}>{v}</span>
              </div>
            ))}
            {Object.entries(cart).length > 0 && (
              <>
                <div style={{ borderTop: "1px solid #bfdbfe", marginTop: 8, paddingTop: 8 }}>
                  {Object.entries(cart).map(([id, qty]) => {
                    const item = bar.menu.find(m => m.id === id);
                    return item ? (
                      <div key={id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#1e40af", marginBottom: 3 }}>
                        <span>{item.emoji} {item.name} ×{qty}</span>
                        <span>{fmt(item.price * qty)}</span>
                      </div>
                    ) : null;
                  })}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 800, color: "#1e40af", borderTop: "1px solid #bfdbfe", marginTop: 6, paddingTop: 6 }}>
                  <span>예상 금액</span><span>{fmt(total)}</span>
                </div>
              </>
            )}
          </div>

          {/* Form fields */}
          <div style={{ background: "white", borderRadius: 14, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", border: "1px solid #f1f5f9" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 12 }}>단체 정보</div>
            {fields.map(({ key, label, ph, type }) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 5 }}>{label}</div>
                <input
                  type={type} value={form[key]}
                  onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  placeholder={ph}
                  style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #e2e8f0", borderRadius: 11, fontSize: 13, outline: "none", boxSizing: "border-box", color: "#0f172a" }}
                  onFocus={e => e.target.style.borderColor = "#3b82f6"}
                  onBlur={e => e.target.style.borderColor = "#e2e8f0"}
                />
              </div>
            ))}
            {errMsg && (
              <div style={{ color: "#ef4444", fontSize: 12, fontWeight: 600, marginTop: 4 }}>⚠️ {errMsg}</div>
            )}
          </div>
        </div>
      </div>

      <div style={{ background: "white", borderTop: "1px solid #f1f5f9", padding: "12px 16px", flexShrink: 0 }}>
        <div style={{ maxWidth: 448, margin: "0 auto" }}>
          <button onClick={onSubmit} style={{ width: "100%", padding: "14px", borderRadius: 13, background: "linear-gradient(135deg,#1d4ed8,#2563eb)", color: "white", fontWeight: 800, fontSize: 14, border: "none", cursor: "pointer" }}>
            🎉 예약 완료하기
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MY RESERVATIONS MODAL ────────────────────────────────────────
function MyResModal({ onClose, lookup, setLookup, onLookup, found, onCancel, looking }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: "white", width: "100%", maxWidth: 448, margin: "0 auto", borderRadius: "22px 22px 0 0", maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>내 예약 확인</div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "#f8fafc", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={17} />
          </button>
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: 16 }}>
          {/* Lookup form */}
          <div style={{ background: "#f8fafc", borderRadius: 14, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>단체명과 연락처 뒷 4자리를 입력하세요</div>
            {[
              { key: "groupName",   ph: "단체명",          len: undefined },
              { key: "phoneLast4",  ph: "연락처 뒷 4자리", len: 4         },
            ].map(({ key, ph, len }) => (
              <input
                key={key} type="text" value={lookup[key]} maxLength={len}
                onChange={e => setLookup(p => ({ ...p, [key]: e.target.value }))}
                placeholder={ph}
                style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #e2e8f0", borderRadius: 11, fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 8, background: "white", color: "#0f172a" }}
              />
            ))}
            <button onClick={onLookup} disabled={looking} style={{ width: "100%", padding: "11px", borderRadius: 11, background: looking ? "#93c5fd" : "linear-gradient(135deg,#1d4ed8,#2563eb)", color: "white", fontWeight: 700, fontSize: 13, border: "none", cursor: looking ? "default" : "pointer" }}>
              {looking ? "조회 중..." : "예약 조회하기"}
            </button>
          </div>

          {/* Results */}
          {found !== null && (
            found.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "#94a3b8" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
                <div style={{ fontSize: 13 }}>조건에 맞는 예약이 없습니다</div>
              </div>
            ) : (
              found.map(res => (
                <div key={res.id} style={{ background: "white", border: "1px solid #f1f5f9", borderRadius: 14, padding: 14, marginBottom: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>{res.barName}</div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{res.groupName} · {res.partySize}명</div>
                    </div>
                    <span style={{ fontSize: 11, background: res.cancelled ? "#fef2f2" : "#dcfce7", color: res.cancelled ? "#dc2626" : "#15803d", padding: "3px 9px", borderRadius: 20, fontWeight: 700 }}>{res.cancelled ? "취소됨" : "예약완료"}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.9, marginBottom: 10 }}>
                    <div>📅 {res.date}</div>
                    <div>⏰ {res.startSlot} ~ {res.endSlot}</div>
                    {res.cart?.length > 0 && <div>🍽️ {res.cart.map(c => `${c.name}×${c.qty}`).join(", ")}</div>}
                    {res.totalPrice > 0 && <div>💰 예상: {fmt(res.totalPrice)}</div>}
                    <div>📞 {res.phone}</div>
                  </div>
                  {!res.cancelled && (
                    <button
                      onClick={() => onCancel(res.id)}
                      style={{ width: "100%", padding: "9px", borderRadius: 10, border: "1.5px solid #fecaca", background: "white", color: "#ef4444", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                    >
                      <Trash2 size={13} /> 예약 취소
                    </button>
                  )}
                </div>
              ))
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ─────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen]     = useState("main");
  const [date, setDate]         = useState(todayStr());
  const [need, setNeed]         = useState("");
  const [bar, setBar]           = useState(null);
  const [sels, setSels]         = useState({});
  const [cart, setCart]         = useState({});
  const [form, setForm]         = useState({ groupName: "", managerName: "", phone: "" });
  const [reservations, setRsv]  = useState([]);
  const [modal, setModal]       = useState(false);
  const [lookup, setLookup]     = useState({ groupName: "", phoneLast4: "" });
  const [found, setFound]       = useState(null);
  const [looking, setLooking]   = useState(false);
  const [toast, setToast]       = useState("");
  const [formErr, setFormErr]   = useState("");
  const [bookedRsv, setBookedRsv] = useState([]);
  const emailjsReady = useRef(false);

  // Init EmailJS
  useEffect(() => {
    if (EMAILJS_PUBLIC_KEY !== "YOUR_PUBLIC_KEY") {
      emailjs.init(EMAILJS_PUBLIC_KEY);
      emailjsReady.current = true;
    }
  }, []);

  // Load booked reservations from Sheets whenever date changes
  useEffect(() => {
    if (!sheetsReady()) return;
    sheetsGet({ action: "getAll" })
      .then(data => setBookedRsv(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [date]);

  // Compute effective availability for a bar (base minus already-booked seats)
  const getEffectiveAvail = (bar) => {
    const adjusted = { ...bar.avail };
    const matching = bookedRsv.filter(r =>
      !r.cancelled &&
      String(r.barName).trim() === String(bar.name).trim() &&
      String(r.date).trim().substring(0, 10) === String(date).trim().substring(0, 10)
    );
    if (matching.length > 0) {
      console.log("[잔여석 계산] 적용할 예약:", matching.map(r => `${r.startSlot}~${r.endSlot} ${r.partySize}명`));
    }
    matching.forEach(r => {
      const start = String(r.startSlot).trim();
      const end   = String(r.endSlot).trim();
      const si = SLOTS.indexOf(start);
      const ei = SLOTS.indexOf(end);
      console.log(`[잔여석 계산] ${start}(${si}) ~ ${end}(${ei}), ${r.partySize}명 차감`);
      if (si < 0 || ei < 0) return;
      for (let i = si; i <= ei; i++) {
        adjusted[SLOTS[i]] = Math.max(0, (adjusted[SLOTS[i]] ?? 0) - Number(r.partySize));
      }
    });
    return adjusted;
  };

  const sendEmail = (rsv) => {
    if (EMAILJS_PUBLIC_KEY === "YOUR_PUBLIC_KEY") return;
    const menuText = rsv.cart.length > 0
      ? rsv.cart.map(c => `${c.name} ×${c.qty} (${fmt(c.price * c.qty)})`).join("\n")
      : "메뉴 미선택";
    const params = {
      bar_name:     rsv.barName,
      date:         rsv.date,
      time:         `${rsv.startSlot} ~ ${rsv.endSlot}`,
      party_size:   `${rsv.partySize}명`,
      group_name:   rsv.groupName,
      manager_name: rsv.managerName,
      phone:        rsv.phone,
      menu_items:   menuText,
      total_price:  rsv.totalPrice > 0 ? fmt(rsv.totalPrice) : "미선택",
    };
    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params)
      .then((res) => {
        console.log("EmailJS 성공:", res);
        showToast("예약 확정 메일이 발송되었습니다! 📧");
      })
      .catch(err => {
        console.error("EmailJS 오류 상세:", JSON.stringify(err));
        showToast("⚠️ 메일 발송 실패: " + (err?.text || err?.message || JSON.stringify(err)));
      });
  };

  // ── Sheets API helpers ──────────────────────────────────────
  const sheetsReady = () => SHEETS_URL !== "YOUR_APPS_SCRIPT_URL";

  const sheetsGet = (params) =>
    fetch(`${SHEETS_URL}?${new URLSearchParams(params)}`)
      .then(r => r.json());

  const sheetsSave = (rsv) => {
    if (!sheetsReady()) return;
    sheetsGet({ action: "save", data: JSON.stringify(rsv) })
      .catch(e => console.error("Sheets save error:", e));
  };

  const sheetsCancel = (id) => {
    if (!sheetsReady()) return;
    sheetsGet({ action: "cancel", id })
      .catch(e => console.error("Sheets cancel error:", e));
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const needNum = parseInt(need, 10) || 0;
  const sel     = (id) => sels[id] || {};

  const handleSlot = (barId, sl) => {
    setSels(prev => {
      const cur = prev[barId] || {};
      if (!cur.start || (cur.start && cur.end))
        return { ...prev, [barId]: { start: sl, end: null } };
      const si = SLOTS.indexOf(cur.start), ei = SLOTS.indexOf(sl);
      if (ei <= si)
        return { ...prev, [barId]: { start: sl, end: null } };
      return { ...prev, [barId]: { start: cur.start, end: sl } };
    });
  };

  const openMenu = (b) => {
    if (!sel(b.id).end) { showToast("시작/종료 시간을 선택해주세요."); return; }
    setBar(b);
    setScreen("menu");
  };

  const add    = (id) => setCart(p => ({ ...p, [id]: (p[id] || 0) + 1 }));
  const remove = (id) => setCart(p => { const n = { ...p }; if (n[id] > 1) n[id]--; else delete n[id]; return n; });
  const total  = () => bar ? bar.menu.reduce((s, i) => s + (cart[i.id] || 0) * i.price, 0) : 0;
  const count  = () => Object.values(cart).reduce((a, b) => a + b, 0);

  const submit = () => {
    const { groupName, managerName, phone } = form;
    if (!groupName || !managerName || !phone) { setFormErr("모든 항목을 입력해주세요."); return; }
    setFormErr("");
    const s = sel(bar.id);
    const rsv = {
      id: Date.now().toString(), barName: bar.name, date,
      startSlot: s.start, endSlot: s.end,
      partySize: needNum, groupName, managerName, phone,
      cart: Object.entries(cart).map(([id, qty]) => {
        const item = bar.menu.find(m => m.id === id);
        return item ? { name: item.name, price: item.price, qty } : null;
      }).filter(Boolean),
      totalPrice: total(),
    };
    const updated = [...reservations, rsv];
    setRsv(updated);
    sheetsSave(rsv);
    sendEmail(rsv);
    // 즉시 반영 (optimistic update) — Sheets 응답 기다리지 않고 로컬에 바로 적용
    setBookedRsv(prev => [...prev, {
      barName: rsv.barName,
      date: rsv.date,
      startSlot: rsv.startSlot,
      endSlot: rsv.endSlot,
      partySize: rsv.partySize,
      cancelled: false,
    }]);
    setCart({}); setForm({ groupName: "", managerName: "", phone: "" });
    setSels(p => ({ ...p, [bar.id]: {} }));
    setScreen("main");
    showToast("예약이 완료되었습니다! 🎉");
    // 메일은 별도 토스트로 (emailjs 비동기 콜백에서 표시)
  };

  const doLookup = async () => {
    if (!lookup.groupName || !lookup.phoneLast4) return;
    setLooking(true);
    setFound(null);
    if (sheetsReady()) {
      try {
        const data = await sheetsGet({ action: "lookup", groupName: lookup.groupName, phone4: lookup.phoneLast4 });
        setFound(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Sheets lookup error:", e);
        setFound([]);
      }
    } else {
      // Sheets 미설정 시 현재 세션 데이터에서 검색
      setFound(reservations.filter(r =>
        r.groupName === lookup.groupName &&
        r.phone.replace(/-/g, "").slice(-4) === lookup.phoneLast4
      ));
    }
    setLooking(false);
  };

  const doCancel = (id) => {
    sheetsCancel(id);
    setFound(p => p.map(r => r.id === id ? { ...r, cancelled: true } : r));
    // 취소된 예약 인원을 잔여석에 복구
    if (sheetsReady()) {
      sheetsGet({ action: "getAll" })
        .then(data => setBookedRsv(Array.isArray(data) ? data : []))
        .catch(() => {});
    } else {
      setBookedRsv(p => p.map(r => r.id === id ? { ...r, cancelled: true } : r));
    }
    showToast("예약이 취소되었습니다.");
  };

  // ── SCREEN ROUTING ────────────────────────────────────────────
  if (screen === "menu" && bar) return (
    <MenuScreen bar={bar} cart={cart} add={add} remove={remove}
      total={total()} count={count()}
      onBack={() => setScreen("main")} onNext={() => setScreen("form")}
      sel={sel(bar.id)} need={need} setNeed={setNeed}
      onSlotClick={(sl) => handleSlot(bar.id, sl)}
      date={date} setDate={setDate}
      effectiveAvail={getEffectiveAvail(bar)} />
  );

  if (screen === "form" && bar) return (
    <FormScreen bar={bar} form={form} setForm={setForm}
      onBack={() => setScreen("menu")} onSubmit={submit}
      sel={sel(bar.id)} need={needNum} date={date}
      cart={cart} total={total()} errMsg={formErr} />
  );

  // ── MAIN SCREEN ───────────────────────────────────────────────
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#f1f5f9", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", position: "relative" }}>
      {/* Sticky header */}
      <div style={{ background: "white", borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
        <div style={{ maxWidth: 448, margin: "0 auto", padding: "14px 16px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.5px" }}>🍻 단체 예약</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>대학가 단체 술집 예약 서비스</div>
            </div>
            <button
              onClick={() => setModal(true)}
              style={{ fontSize: 12, background: "linear-gradient(135deg,#1d4ed8,#2563eb)", color: "white", padding: "9px 16px", borderRadius: 22, fontWeight: 700, border: "none", cursor: "pointer", letterSpacing: "-0.2px" }}
            >
              내 예약 확인
            </button>
          </div>

          {/* Filters */}
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 13, padding: "9px 12px" }}>
              <Calendar size={14} color="#3b82f6" />
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                style={{ flex: 1, background: "transparent", border: "none", fontSize: 12, outline: "none", color: "#374151", minWidth: 0 }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 13, padding: "9px 12px", width: 110 }}>
              <Users size={14} color="#3b82f6" />
              <input type="number" value={need} onChange={e => setNeed(e.target.value)} placeholder="인원" min="1"
                style={{ width: "100%", background: "transparent", border: "none", fontSize: 12, outline: "none", color: "#374151" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Bar list */}
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ maxWidth: 448, margin: "0 auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>
            {BARS.length}개 업소&nbsp;·&nbsp;
            {needNum > 0 ? `${needNum}인 기준 가능한 시간대 활성화 중` : "인원수 입력 시 예약 가능 시간대가 표시됩니다"}
          </div>
          {BARS.map(b => (
            <BarCard key={b.id} bar={b} need={needNum} sel={sel(b.id)}
              onSlot={sl => handleSlot(b.id, sl)}
              onBook={() => openMenu(b)}
              onClear={() => setSels(p => ({ ...p, [b.id]: {} }))}
              effectiveAvail={getEffectiveAvail(b)} />
          ))}
          <div style={{ height: 20 }} />
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "absolute", top: 90, left: "50%", transform: "translateX(-50%)",
          background: toast.includes("취소") ? "#ef4444" : "#22c55e",
          color: "white", padding: "10px 20px", borderRadius: 30,
          fontSize: 13, fontWeight: 700,
          boxShadow: "0 4px 16px rgba(0,0,0,0.18)", zIndex: 60,
          display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
        }}>
          {toast.includes("취소") ? <X size={14}/> : <CheckCircle size={14}/>} {toast}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <MyResModal
          onClose={() => { setModal(false); setFound(null); setLookup({ groupName: "", phoneLast4: "" }); }}
          lookup={lookup} setLookup={setLookup}
          onLookup={doLookup} found={found} onCancel={doCancel} looking={looking}
        />
      )}
    </div>
  );
}