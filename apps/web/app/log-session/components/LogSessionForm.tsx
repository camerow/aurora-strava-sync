import React from "react";
import { useNavigate } from "react-router";
import type { SendtallyApi } from "@sendtally/api-client";
import {
  draftProblem,
  draftSummary,
  emptyDraft,
  gradeOptions,
  newClimb,
  toLogSessionInput,
  withScale,
  type ClimbDraft,
  type GradeScale,
  type LogSessionDraft,
} from "@sendtally/features/log-session";

const monoLabel: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontWeight: 500,
  fontSize: 11,
  letterSpacing: "0.08em",
  color: "rgba(64,63,76,0.72)",
};

const columnHead: React.CSSProperties = {
  ...monoLabel,
  fontSize: 10,
  color: "rgba(64,63,76,0.55)",
};

const inputStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: 15,
  color: "var(--bs-gunmetal)",
  background: "var(--bs-white)",
  border: "1px solid rgba(64,63,76,0.15)",
  borderRadius: "var(--radius-control)",
  padding: "12px 14px",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const chipStyle = (active: boolean): React.CSSProperties => ({
  fontFamily: "var(--font-mono)",
  fontWeight: 500,
  fontSize: 11,
  letterSpacing: "0.06em",
  padding: "10px 16px",
  borderRadius: "var(--radius-pill)",
  cursor: "pointer",
  background: active ? "var(--bs-gold)" : "transparent",
  color: active ? "var(--bs-gunmetal)" : "rgba(64,63,76,0.65)",
  border: active ? "1px solid var(--bs-gold)" : "1px solid rgba(64,63,76,0.18)",
});

const stepperButton: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 8,
  border: "1px solid rgba(64,63,76,0.18)",
  background: "none",
  cursor: "pointer",
  fontFamily: "var(--font-mono)",
  fontSize: 14,
  color: "var(--bs-gunmetal)",
  lineHeight: 1,
};

const CLIMB_GRID = "88px minmax(0, 1fr) 176px 122px 36px";

function Field({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      <span style={monoLabel}>{label}</span>
      {children}
    </div>
  );
}

function RpePicker({
  rpe,
  onChange,
}: {
  rpe: number | null;
  onChange: (rpe: number | null) => void;
}): React.ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={monoLabel}>RPE</span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              fontSize: 17,
              color: "var(--bs-gunmetal)",
            }}
          >
            {rpe === null ? (
              <span style={{ fontSize: 12, color: "rgba(64,63,76,0.55)" }}>AUTO</span>
            ) : (
              <>
                {rpe}
                <span style={{ fontSize: 12, opacity: 0.6 }}>/10</span>
              </>
            )}
          </span>
        </div>
        {rpe !== null && (
          <button
            type="button"
            onClick={() => onChange(null)}
            style={{
              ...monoLabel,
              fontSize: 10,
              color: "var(--bs-azure-ink)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            RESET TO AUTO
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: 3 }}>
        {Array.from({ length: 10 }, (_, i) => {
          const value = i + 1;
          const lit = rpe !== null && value <= rpe;
          return (
            <button
              key={value}
              type="button"
              aria-label={`RPE ${value}`}
              onClick={() => onChange(value)}
              style={{
                flex: 1,
                height: 26,
                borderRadius: 4,
                border: "none",
                cursor: "pointer",
                background: lit ? "var(--data-bar)" : "var(--data-bar-empty)",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function ClimbRow({
  climb,
  scale,
  removable,
  onChange,
  onRemove,
}: {
  climb: ClimbDraft;
  scale: GradeScale;
  removable: boolean;
  onChange: (climb: ClimbDraft) => void;
  onRemove: () => void;
}): React.ReactElement {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: CLIMB_GRID,
        gap: 10,
        alignItems: "center",
        background: "var(--surface-soft)",
        borderRadius: "var(--radius-card)",
        padding: "12px 14px",
      }}
    >
      <select
        value={climb.grade}
        onChange={(e) => onChange({ ...climb, grade: e.target.value })}
        style={{
          ...inputStyle,
          fontFamily: "var(--font-mono)",
          fontWeight: 600,
          padding: "11px 8px",
        }}
      >
        {gradeOptions(scale).map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>
      <input
        value={climb.name}
        placeholder="Name (optional)"
        onChange={(e) => onChange({ ...climb, name: e.target.value })}
        style={inputStyle}
      />
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          onClick={() => onChange({ ...climb, kind: "send" })}
          style={{
            ...chipStyle(false),
            fontSize: 10,
            padding: "8px 12px",
            ...(climb.kind === "send"
              ? {
                  background: "var(--bs-azure-ink)",
                  color: "var(--bs-white)",
                  border: "1px solid var(--bs-azure-ink)",
                }
              : {}),
          }}
        >
          ✓ SEND
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...climb, kind: "attempt" })}
          style={{
            ...chipStyle(false),
            fontSize: 10,
            padding: "8px 12px",
            ...(climb.kind === "attempt"
              ? {
                  background: "var(--bs-gunmetal)",
                  color: "var(--bs-white)",
                  border: "1px solid var(--bs-gunmetal)",
                }
              : {}),
          }}
        >
          ✗ ATTEMPT
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          aria-label="Fewer tries"
          disabled={climb.tries <= 1}
          onClick={() => onChange({ ...climb, tries: climb.tries - 1 })}
          style={{ ...stepperButton, opacity: climb.tries <= 1 ? 0.4 : 1 }}
        >
          −
        </button>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: 600,
            fontSize: 15,
            width: 18,
            textAlign: "center",
          }}
        >
          {climb.tries}
        </span>
        <button
          type="button"
          aria-label="More tries"
          onClick={() => onChange({ ...climb, tries: Math.min(99, climb.tries + 1) })}
          style={stepperButton}
        >
          +
        </button>
      </div>
      <button
        type="button"
        aria-label="Remove climb"
        disabled={!removable}
        onClick={onRemove}
        style={{
          ...stepperButton,
          width: 32,
          height: 32,
          border: "none",
          color: "rgba(64,63,76,0.45)",
          opacity: removable ? 1 : 0,
        }}
      >
        ✕
      </button>
    </div>
  );
}

export function LogSessionForm({ api }: { api: SendtallyApi }): React.ReactElement {
  const navigate = useNavigate();
  const [draft, setDraft] = React.useState<LogSessionDraft>(() => emptyDraft(new Date()));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const nextKey = React.useRef(2);

  const problem = draftProblem(draft);

  function updateClimb(key: string, climb: ClimbDraft): void {
    setDraft((d) => ({ ...d, climbs: d.climbs.map((c) => (c.key === key ? climb : c)) }));
  }

  async function save(): Promise<void> {
    if (problem !== null) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { session } = await api.logSession(toLogSessionInput(draft));
      await navigate(`/app/sessions/${encodeURIComponent(session.fingerprint)}`);
    } catch {
      setError("Could not save the session. Try again.");
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      <div style={{ display: "grid", gridTemplateColumns: "380px minmax(0, 1fr)", gap: 36 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <Field
            label={
              <>
                SESSION NAME <span style={{ color: "rgba(64,63,76,0.45)" }}>· OPTIONAL</span>
              </>
            }
          >
            <input
              value={draft.name}
              placeholder="Tuesday board night"
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              style={inputStyle}
            />
          </Field>
          <Field label="DATE">
            <input
              type="date"
              value={draft.date}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              style={inputStyle}
            />
          </Field>
          <div
            style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}
          >
            <Field label="START TIME">
              <input
                type="time"
                value={draft.startTime}
                onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
                style={inputStyle}
              />
            </Field>
            <Field label="END TIME">
              <input
                type="time"
                value={draft.endTime}
                onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
                style={inputStyle}
              />
            </Field>
          </div>
          <Field label="LOCATION">
            <div style={{ display: "flex", gap: 8 }}>
              {(["indoor", "outdoor"] as const).map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setDraft({ ...draft, location: loc })}
                  style={chipStyle(draft.location === loc)}
                >
                  {loc.toUpperCase()}
                </button>
              ))}
            </div>
          </Field>
          <RpePicker rpe={draft.rpe} onChange={(rpe) => setDraft({ ...draft, rpe })} />
          <div
            style={{
              background: "var(--surface-soft)",
              borderRadius: "var(--radius-card)",
              padding: 18,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <span style={columnHead}>AFTER YOU SAVE</span>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "rgba(64,63,76,0.88)" }}>
              sendtally titles the session and builds the climb log. Leave RPE on auto and it is
              scored against your last 8 weeks of sessions.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 14,
            }}
          >
            <span style={{ ...monoLabel, color: "var(--text-label-accent)" }}>
              CLIMBS · {draft.climbs.length}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={columnHead}>GRADE SCALE</span>
              {(["v", "font"] as const).map((scale) => (
                <button
                  key={scale}
                  type="button"
                  onClick={() => setDraft(withScale(draft, scale))}
                  style={{ ...chipStyle(draft.scale === scale), fontSize: 10, padding: "6px 12px" }}
                >
                  {scale === "v" ? "V" : "FONT"}
                </button>
              ))}
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: CLIMB_GRID,
              gap: 10,
              padding: "0 14px",
            }}
          >
            <span style={columnHead}>GRADE</span>
            <span style={columnHead}>NAME · OPTIONAL</span>
            <span style={columnHead}>RESULT</span>
            <span style={columnHead}>TRIES</span>
            <span />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {draft.climbs.map((climb) => (
              <ClimbRow
                key={climb.key}
                climb={climb}
                scale={draft.scale}
                removable={draft.climbs.length > 1}
                onChange={(c) => updateClimb(climb.key, c)}
                onRemove={() =>
                  setDraft((d) => ({ ...d, climbs: d.climbs.filter((c) => c.key !== climb.key) }))
                }
              />
            ))}
            <button
              type="button"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  climbs: [...d.climbs, newClimb(`climb-${nextKey.current++}`, d.scale)],
                }))
              }
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 9,
                border: "1px dashed rgba(64,63,76,0.25)",
                borderRadius: "var(--radius-card)",
                padding: 15,
                background: "none",
                cursor: "pointer",
                ...monoLabel,
                color: "var(--bs-azure-ink)",
              }}
            >
              + ADD CLIMB
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 26,
          borderTop: "1px solid rgba(64,63,76,0.1)",
          paddingTop: 20,
        }}
      >
        <span style={monoLabel}>{draftSummary(draft)}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {error !== null && (
            <span style={{ ...monoLabel, color: "var(--text-label-accent)" }}>{error}</span>
          )}
          <button
            type="button"
            onClick={() => void navigate("/app")}
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 600,
              fontSize: 15,
              padding: "14px 22px",
              borderRadius: "var(--radius-control)",
              color: "rgba(64,63,76,0.65)",
              border: "1px solid rgba(64,63,76,0.18)",
              background: "none",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 600,
              fontSize: 15,
              padding: "14px 22px",
              borderRadius: "var(--radius-control)",
              background: "var(--bs-azure-ink)",
              color: "var(--bs-white)",
              border: "none",
              cursor: "pointer",
              opacity: saving ? 0.45 : 1,
            }}
          >
            {saving ? "Saving…" : "Log session"}
          </button>
        </div>
      </div>
    </div>
  );
}
