// Playoff formats a season can use. Season 1 (and any season that never picked one) is "ipl4".
import type { PlayoffStage, Season } from "./types";

export type PlayoffFormat = "ipl4" | "semis4" | "top3" | "final2" | "none";

export interface PlayoffFormatSpec {
  id: PlayoffFormat;
  /** "Top 4 · IPL style" */
  label: string;
  description: string;
  /** For season summaries: "top 4 to IPL-style playoffs" */
  summary: string;
  /** Teams that make the playoffs (0 = no playoffs, the league winner is champion). */
  qualify: number;
  /** Series in play order. */
  stages: PlayoffStage[];
  /** Bracket columns, left to right. */
  rounds: PlayoffStage[][];
  /** Table colouring: the top `edge.places` get a head start, explained by `edge.label`. */
  edge: { places: number; label: string } | null;
  /** Legend text for the rest of the qualifying places. */
  restLabel: string | null;
  notes: Partial<Record<PlayoffStage, string>>;
  placeholders: Partial<Record<PlayoffStage, [string, string]>>;
  /** Finishing position for a series loser, e.g. Q2 loser = "3rd". */
  loserFinish: Partial<Record<PlayoffStage, string>>;
}

export const PLAYOFF_FORMATS: Record<PlayoffFormat, PlayoffFormatSpec> = {
  ipl4: {
    id: "ipl4",
    label: "Top 4 · IPL style",
    description: "Qualifier 1 (1st v 2nd), Eliminator (3rd v 4th), Qualifier 2, Final. The top two get two chances.",
    summary: "top 4 to IPL-style playoffs",
    qualify: 4,
    stages: ["qualifier_1", "eliminator", "qualifier_2", "final"],
    rounds: [["qualifier_1", "eliminator"], ["qualifier_2"], ["final"]],
    edge: { places: 2, label: "Top 2 · Qualifier 1" },
    restLabel: "3rd–4th · Eliminator",
    notes: {
      qualifier_1: "1st v 2nd. Winner to the Final, loser to Qualifier 2",
      eliminator: "3rd v 4th. Winner to Qualifier 2, loser out",
      qualifier_2: "Loser Q1 v winner Eliminator. Winner to the Final",
      final: "Winner Q1 v winner Q2",
    },
    placeholders: {
      qualifier_1: ["1st place", "2nd place"],
      eliminator: ["3rd place", "4th place"],
      qualifier_2: ["Loser of Q1", "Winner of Eliminator"],
      final: ["Winner of Q1", "Winner of Q2"],
    },
    loserFinish: { qualifier_2: "3rd", eliminator: "4th" },
  },
  semis4: {
    id: "semis4",
    label: "Top 4 · Semi-finals",
    description: "Semi-final 1 (1st v 4th) and Semi-final 2 (2nd v 3rd); the winners meet in the Final.",
    summary: "top 4 to the semi-finals",
    qualify: 4,
    stages: ["semi_final_1", "semi_final_2", "final"],
    rounds: [["semi_final_1", "semi_final_2"], ["final"]],
    edge: null,
    restLabel: "Top 4 · Semi-finals",
    notes: {
      semi_final_1: "1st v 4th. Winner to the Final",
      semi_final_2: "2nd v 3rd. Winner to the Final",
      final: "Winner SF1 v winner SF2",
    },
    placeholders: {
      semi_final_1: ["1st place", "4th place"],
      semi_final_2: ["2nd place", "3rd place"],
      final: ["Winner of SF1", "Winner of SF2"],
    },
    loserFinish: { semi_final_1: "Semi-finalist", semi_final_2: "Semi-finalist" },
  },
  top3: {
    id: "top3",
    label: "Top 3 · 1st straight to the Final",
    description: "1st goes straight to the Final. 2nd v 3rd play the Eliminator for the other Final spot.",
    summary: "top 3 to the playoffs, 1st straight to the Final",
    qualify: 3,
    stages: ["eliminator", "final"],
    rounds: [["eliminator"], ["final"]],
    edge: { places: 1, label: "1st · straight to the Final" },
    restLabel: "2nd–3rd · Eliminator",
    notes: {
      eliminator: "2nd v 3rd. Winner to the Final, loser out",
      final: "1st place v winner of the Eliminator",
    },
    placeholders: {
      eliminator: ["2nd place", "3rd place"],
      final: ["1st place", "Winner of Eliminator"],
    },
    loserFinish: { eliminator: "3rd" },
  },
  final2: {
    id: "final2",
    label: "Top 2 · Final",
    description: "1st v 2nd in the Final.",
    summary: "top 2 to the Final",
    qualify: 2,
    stages: ["final"],
    rounds: [["final"]],
    edge: null,
    restLabel: "Top 2 · Final",
    notes: { final: "1st v 2nd" },
    placeholders: { final: ["1st place", "2nd place"] },
    loserFinish: {},
  },
  none: {
    id: "none",
    label: "No playoffs",
    description: "The team on top of the league table is champion.",
    summary: "league winner is champion",
    qualify: 0,
    stages: [],
    rounds: [],
    edge: null,
    restLabel: null,
    notes: {},
    placeholders: {},
    loserFinish: {},
  },
};

export const PLAYOFF_FORMAT_LIST = Object.values(PLAYOFF_FORMATS);

export function playoffFormat(season: Pick<Season, "playoff_format"> | null | undefined): PlayoffFormatSpec {
  return PLAYOFF_FORMATS[(season?.playoff_format as PlayoffFormat) ?? "ipl4"] ?? PLAYOFF_FORMATS.ipl4;
}

/** The format's playoffs only run when the season has enough teams. */
export const playoffsActive = (spec: PlayoffFormatSpec, teamCount: number) => spec.qualify > 0 && teamCount >= spec.qualify;
