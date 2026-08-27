import { router } from "expo-router";
import React from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import {
  draftProblem,
  draftSummary,
  emptyDraft,
  gradeOptions,
  newClimb,
  toLogSessionInput,
  withScale,
  type ClimbDraft,
  type LogSessionDraft,
} from "@sendtally/features/log-session";
import { colors, fonts, radius } from "@sendtally/design/tokens";
import { useApi } from "../../lib/api";

function LabelText({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <Text
      style={{
        fontFamily: fonts.monoMedium,
        fontSize: 10,
        letterSpacing: 0.8,
        color: colors.textSecondary,
      }}
    >
      {children}
    </Text>
  );
}

function Chip({
  label,
  active,
  activeColor = colors.gold,
  activeText = colors.gunmetal,
  onPress,
}: {
  label: string;
  active: boolean;
  activeColor?: string;
  activeText?: string;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        minHeight: 40,
        justifyContent: "center",
        borderRadius: radius.pill,
        backgroundColor: active ? activeColor : "transparent",
        borderWidth: 1,
        borderColor: active ? activeColor : "rgba(64,63,76,0.18)",
      }}
    >
      <Text
        style={{
          fontFamily: fonts.monoMedium,
          fontSize: 10,
          letterSpacing: 0.6,
          color: active ? activeText : "rgba(64,63,76,0.65)",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function StepperButton({
  label,
  disabled = false,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        width: 40,
        height: 40,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "rgba(64,63,76,0.18)",
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text style={{ fontFamily: fonts.monoMedium, fontSize: 16, color: colors.gunmetal }}>
        {label}
      </Text>
    </Pressable>
  );
}

const inputStyle = {
  fontFamily: fonts.sans,
  fontSize: 15,
  color: colors.gunmetal,
  backgroundColor: colors.white,
  borderWidth: 1,
  borderColor: "rgba(64,63,76,0.15)",
  borderRadius: radius.control,
  paddingHorizontal: 13,
  paddingVertical: 12,
} as const;

function ClimbCard({
  climb,
  options,
  removable,
  onChange,
  onRemove,
}: {
  climb: ClimbDraft;
  options: readonly string[];
  removable: boolean;
  onChange: (climb: ClimbDraft) => void;
  onRemove: () => void;
}): React.ReactElement {
  const gradeIndex = options.indexOf(climb.grade);
  return (
    <View
      style={{
        backgroundColor: colors.surfaceSoft,
        borderRadius: radius.card,
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
        <StepperButton
          label="−"
          disabled={gradeIndex <= 0}
          onPress={() => onChange({ ...climb, grade: options[gradeIndex - 1] ?? climb.grade })}
        />
        <Text
          style={{
            width: 52,
            textAlign: "center",
            fontFamily: fonts.monoSemiBold,
            fontSize: 16,
            color: colors.gunmetal,
          }}
        >
          {climb.grade}
        </Text>
        <StepperButton
          label="+"
          disabled={gradeIndex === options.length - 1}
          onPress={() => onChange({ ...climb, grade: options[gradeIndex + 1] ?? climb.grade })}
        />
        <TextInput
          value={climb.name}
          placeholder="Name (optional)"
          placeholderTextColor={colors.textFaint}
          onChangeText={(name) => onChange({ ...climb, name })}
          style={{ ...inputStyle, flex: 1, minWidth: 0 }}
        />
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 9,
        }}
      >
        <View style={{ flexDirection: "row", gap: 6 }}>
          <Chip
            label="✓ SEND"
            active={climb.kind === "send"}
            activeColor={colors.azureInk}
            activeText={colors.white}
            onPress={() => onChange({ ...climb, kind: "send" })}
          />
          <Chip
            label="✗ ATTEMPT"
            active={climb.kind === "attempt"}
            activeColor={colors.gunmetal}
            activeText={colors.white}
            onPress={() => onChange({ ...climb, kind: "attempt" })}
          />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          <StepperButton
            label="−"
            disabled={climb.tries <= 1}
            onPress={() => onChange({ ...climb, tries: climb.tries - 1 })}
          />
          <Text
            style={{
              width: 22,
              textAlign: "center",
              fontFamily: fonts.monoSemiBold,
              fontSize: 15,
              color: colors.gunmetal,
            }}
          >
            {climb.tries}
          </Text>
          <StepperButton
            label="+"
            onPress={() => onChange({ ...climb, tries: Math.min(99, climb.tries + 1) })}
          />
        </View>
      </View>
      {removable && (
        <Pressable onPress={onRemove} style={{ alignSelf: "flex-start", minHeight: 32 }}>
          <Text
            style={{
              fontFamily: fonts.monoMedium,
              fontSize: 10,
              letterSpacing: 0.8,
              color: colors.textFaint,
              paddingTop: 2,
            }}
          >
            REMOVE
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export function LogSessionForm(): React.ReactElement {
  const api = useApi();
  const [draft, setDraft] = React.useState<LogSessionDraft>(() => emptyDraft(new Date()));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const nextKey = React.useRef(2);
  const options = gradeOptions(draft.scale);

  async function save(): Promise<void> {
    const problem = draftProblem(draft);
    if (problem !== null) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { session } = await api.logSession(toLogSessionInput(draft));
      router.replace(`/session/${encodeURIComponent(session.fingerprint)}`);
    } catch {
      setError("Could not save the session. Try again.");
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 24, gap: 14 }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{ minHeight: 32, justifyContent: "center" }}
        >
          <Text
            style={{
              fontFamily: fonts.monoMedium,
              fontSize: 11,
              letterSpacing: 0.4,
              color: colors.watermelonInk,
            }}
          >
            ← SESSIONS
          </Text>
        </Pressable>
        <View style={{ gap: 4 }}>
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 32,
              letterSpacing: -1,
              color: colors.gunmetal,
            }}
          >
            Log a session
          </Text>
          <Text
            style={{
              fontFamily: fonts.monoMedium,
              fontSize: 10,
              letterSpacing: 0.8,
              color: colors.textMuted,
            }}
          >
            MANUAL ENTRY · EFFORT SCORED ON SAVE
          </Text>
        </View>

        <View style={{ gap: 7 }}>
          <LabelText>SESSION NAME · OPTIONAL</LabelText>
          <TextInput
            value={draft.name}
            placeholder="Tuesday board night"
            placeholderTextColor={colors.textFaint}
            onChangeText={(name) => setDraft({ ...draft, name })}
            style={inputStyle}
          />
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1, gap: 7 }}>
            <LabelText>DATE</LabelText>
            <TextInput
              value={draft.date}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textFaint}
              onChangeText={(date) => setDraft({ ...draft, date })}
              style={{ ...inputStyle, fontFamily: fonts.mono, fontSize: 13 }}
            />
          </View>
          <View style={{ flex: 1, gap: 7 }}>
            <LabelText>START</LabelText>
            <TextInput
              value={draft.startTime}
              placeholder="HH:MM"
              placeholderTextColor={colors.textFaint}
              onChangeText={(startTime) => setDraft({ ...draft, startTime })}
              style={{ ...inputStyle, fontFamily: fonts.mono, fontSize: 13 }}
            />
          </View>
          <View style={{ flex: 1, gap: 7 }}>
            <LabelText>END</LabelText>
            <TextInput
              value={draft.endTime}
              placeholder="HH:MM"
              placeholderTextColor={colors.textFaint}
              onChangeText={(endTime) => setDraft({ ...draft, endTime })}
              style={{ ...inputStyle, fontFamily: fonts.mono, fontSize: 13 }}
            />
          </View>
        </View>

        <View style={{ gap: 7 }}>
          <LabelText>LOCATION</LabelText>
          <View style={{ flexDirection: "row", gap: 7 }}>
            <Chip
              label="INDOOR"
              active={draft.location === "indoor"}
              onPress={() => setDraft({ ...draft, location: "indoor" })}
            />
            <Chip
              label="OUTDOOR"
              active={draft.location === "outdoor"}
              onPress={() => setDraft({ ...draft, location: "outdoor" })}
            />
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 7 }}>
              <LabelText>RPE</LabelText>
              <Text
                style={{ fontFamily: fonts.monoSemiBold, fontSize: 17, color: colors.gunmetal }}
              >
                {draft.rpe === null ? "AUTO" : `${draft.rpe}/10`}
              </Text>
            </View>
            {draft.rpe !== null && (
              <Pressable
                onPress={() => setDraft({ ...draft, rpe: null })}
                style={{ minHeight: 32, justifyContent: "center" }}
              >
                <Text
                  style={{
                    fontFamily: fonts.monoMedium,
                    fontSize: 10,
                    letterSpacing: 0.8,
                    color: colors.azureInk,
                  }}
                >
                  RESET TO AUTO
                </Text>
              </Pressable>
            )}
          </View>
          <View style={{ flexDirection: "row", gap: 3 }}>
            {Array.from({ length: 10 }, (_, i) => {
              const value = i + 1;
              const lit = draft.rpe !== null && value <= draft.rpe;
              return (
                <Pressable
                  key={value}
                  onPress={() => setDraft({ ...draft, rpe: value })}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 4,
                    backgroundColor: lit ? colors.azure : colors.dataBarEmpty,
                  }}
                />
              );
            })}
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 2,
          }}
        >
          <Text
            style={{
              fontFamily: fonts.monoMedium,
              fontSize: 10,
              letterSpacing: 0.8,
              color: colors.watermelonInk,
            }}
          >
            CLIMBS · {draft.climbs.length}
          </Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Chip
              label="V"
              active={draft.scale === "v"}
              onPress={() => setDraft(withScale(draft, "v"))}
            />
            <Chip
              label="FONT"
              active={draft.scale === "font"}
              onPress={() => setDraft(withScale(draft, "font"))}
            />
          </View>
        </View>

        <View style={{ gap: 9 }}>
          {draft.climbs.map((climb) => (
            <ClimbCard
              key={climb.key}
              climb={climb}
              options={options}
              removable={draft.climbs.length > 1}
              onChange={(c) =>
                setDraft((d) => ({
                  ...d,
                  climbs: d.climbs.map((x) => (x.key === climb.key ? c : x)),
                }))
              }
              onRemove={() =>
                setDraft((d) => ({ ...d, climbs: d.climbs.filter((x) => x.key !== climb.key) }))
              }
            />
          ))}
          <Pressable
            onPress={() =>
              setDraft((d) => ({
                ...d,
                climbs: [...d.climbs, newClimb(`climb-${nextKey.current++}`, d.scale)],
              }))
            }
            style={{
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: "rgba(64,63,76,0.25)",
              borderRadius: radius.card,
            }}
          >
            <Text
              style={{
                fontFamily: fonts.monoMedium,
                fontSize: 10,
                letterSpacing: 0.8,
                color: colors.azureInk,
              }}
            >
              + ADD CLIMB
            </Text>
          </Pressable>
        </View>

        {error !== null && (
          <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.watermelonInk }}>
            {error}
          </Text>
        )}
      </ScrollView>

      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: colors.lineOnLight,
          paddingHorizontal: 18,
          paddingTop: 12,
          paddingBottom: 10,
          gap: 8,
          backgroundColor: colors.white,
        }}
      >
        <Text
          style={{
            fontFamily: fonts.monoMedium,
            fontSize: 10,
            letterSpacing: 0.8,
            color: colors.textMuted,
            textAlign: "center",
          }}
        >
          {draftSummary(draft)}
        </Text>
        <Pressable
          onPress={() => void save()}
          disabled={saving}
          style={{
            minHeight: 50,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radius.control,
            backgroundColor: colors.watermelonInk,
            opacity: saving ? 0.45 : 1,
          }}
        >
          <Text style={{ fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.white }}>
            {saving ? "Saving…" : "Log session"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
