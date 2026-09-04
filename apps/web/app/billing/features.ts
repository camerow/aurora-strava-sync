export const MEMBER_PLAN = "member";
export const INSIGHTS_FEATURE = "long_term_insights";

export type MemberBenefit = {
  title: string;
  body: string;
  soon?: boolean;
};

export const MEMBER_BENEFITS: MemberBenefit[] = [
  {
    title: "Volume, RPE, average grade and flash rate",
    body: "Every session you log feeds the trend screens - how much you climbed, how hard it felt, where your average send grade is drifting, and how often you read a problem first go.",
  },
  {
    title: "Direct influence on what gets built",
    body: "Members say what comes next. It is one person's project, and the people paying for the server get first call on the roadmap.",
  },
];
