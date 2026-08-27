export type GradeScale = "v" | "font";

export type ClimbDraft = {
  key: string;
  grade: string;
  name: string;
  kind: "send" | "attempt";
  tries: number;
};

export type LogSessionDraft = {
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  location: "indoor" | "outdoor";
  scale: GradeScale;
  rpe: number | null;
  climbs: ClimbDraft[];
};
